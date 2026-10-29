import { GetObjectCommand } from "@aws-sdk/client-s3";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";

import {
  type Approval,
  HttpError,
  controls,
  ownedVersion,
  owner,
  renderState,
  readState,
  safe,
  sha256,
  writeState,
} from "../../../server/core";

export async function POST(request: Request) {
  return safe(async () => {
    const user = await owner(request, true);
    if (process.env.PAPERMARK_PUBLIC_SHARING_ENABLED !== "true")
      throw new HttpError(
        403,
        "Public sharing remains disabled pending platform validation",
      );
    const body = await request.json();
    const version = await ownedVersion(body.versionId, user.teamId);
    const state = await renderState(version.id);
    if (!version.hasPages || state?.status !== "ready" || !state.sha256)
      throw new HttpError(409, "PDF is not ready");
    const expected = `APPROVE ${state.sha256}${body.replaceLinkId ? ` REPLACE ${body.replaceLinkId}` : ""}`;
    if (body.confirmReviewed !== true || body.confirmation !== expected)
      throw new HttpError(
        403,
        "Review the exact PDF, target link and visibility and enter its approval phrase",
      );
    const expires = new Date(body.expiresAt);
    const days = (expires.getTime() - Date.now()) / 86400000;
    if (!Number.isFinite(days) || days <= 0 || days > 90)
      throw new HttpError(400, "Set an expiry within 90 days");
    if (
      typeof body.password !== "string" ||
      body.password.length < 16 ||
      body.password.length > 256 ||
      typeof body.allowDownload !== "boolean"
    )
      throw new HttpError(
        400,
        "Set a password of at least 16 characters and explicit download permission",
      );
    // Validate the approval against current stored PDF bytes, not only cached metadata.
    const { client, config } = await getTeamS3ClientAndConfig(user.teamId);
    const file = await client.send(
      new GetObjectCommand({ Bucket: config.bucket, Key: version.file }),
    );
    const digest = sha256(Buffer.from(await file.Body!.transformToByteArray()));
    if (digest !== state.sha256)
      throw new HttpError(409, "Stored bytes changed. Revalidate this version");
    const password = await bcrypt.hash(body.password, 12);
    // Serialize workspace approval operations in PostgreSQL. Retries must reuse
    // an already committed exact approval rather than create another link.
    return prisma.$transaction(
      async (tx) => {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${"papermark-approval:" + user.teamId}))`;
        const candidates = await tx.link.findMany({
          where: {
            documentId: version.documentId,
            teamId: user.teamId,
            isArchived: false,
            deletedAt: null,
            ...(body.replaceLinkId ? { id: body.replaceLinkId } : {}),
          },
        });
        for (const candidate of candidates) {
          const saved = await readState<Approval>(
            `approval-${candidate.id}.json`,
          );
          if (
            saved?.versionId !== version.id ||
            saved.linkId !== candidate.id ||
            saved.documentId !== version.documentId ||
            candidate.linkType !== "DOCUMENT_LINK" ||
            saved.contentSha256 !== digest ||
            saved.documentName !== version.document.name ||
            saved.approvedBy !== user.id ||
            candidate.expiresAt?.toISOString() !== expires.toISOString() ||
            candidate.allowDownload !== body.allowDownload ||
            !candidate.password ||
            candidate.emailProtected ||
            candidate.emailAuthenticated ||
            candidate.enableNotification ||
            candidate.enableAgreement ||
            candidate.enableWatermark ||
            candidate.enableUpload ||
            candidate.enableConversation ||
            candidate.enableAIAgents ||
            candidate.allowList.length ||
            candidate.denyList.length ||
            sha256(JSON.stringify(controls(candidate))) !==
              saved.controlsSha256 ||
            !(await bcrypt.compare(body.password, candidate.password))
          )
            continue;
          return Response.json(
            {
              linkId: candidate.id,
              url: `/view/${candidate.id}`,
              contentSha256: digest,
              versionId: version.id,
              reused: true,
              visibility: {
                passwordRequired: true,
                expiresAt: expires.toISOString(),
                allowDownload: body.allowDownload,
                emailDelivery: false,
                notifications: false,
              },
            },
            { status: 200, headers: { "Cache-Control": "no-store" } },
          );
        }
        const replace = body.replaceLinkId
          ? await tx.link.findFirst({
              where: {
                id: body.replaceLinkId,
                documentId: version.documentId,
                teamId: user.teamId,
              },
            })
          : null;
        if (body.replaceLinkId && !replace)
          throw new HttpError(404, "Replacement link not found");
        if (
          !replace &&
          (await tx.link.count({ where: { teamId: user.teamId } })) >= 50
        )
          throw new HttpError(409, "Workspace link limit reached");
        const linkId = replace?.id || `link_${randomBytes(20).toString("hex")}`;
        // Approval is persisted before activation. A crash here leaves a harmless orphan receipt.
        const settings = {
          password,
          expiresAt: expires,
          allowDownload: body.allowDownload,
          emailProtected: false,
          emailAuthenticated: false,
          allowList: [],
          denyList: [],
          enableNotification: false,
        };
        const visibility = {
          passwordHash: password,
          expiresAt: expires.toISOString(),
          allowDownload: body.allowDownload,
          emailProtected: false as const,
          emailAuthenticated: false as const,
          allowList: [] as string[],
          denyList: [] as string[],
          enableNotification: false as const,
        };
        const approval: Approval = {
          schema: 1,
          linkId,
          documentId: version.documentId,
          versionId: version.id,
          contentSha256: digest,
          documentName: version.document.name,
          visibility,
          controlsSha256: sha256(JSON.stringify(visibility)),
          approvedBy: user.id,
          approvedAt: new Date().toISOString(),
        };
        await writeState(`approval-${linkId}.json`, approval);
        // A replacement changes only this link's approved version. Other links keep
        // their pinned version. Old grants fail once the approval receipt changes.
        const data = {
          ...settings,
          isArchived: false,
          enableAgreement: false,
          enableWatermark: false,
          enableUpload: false,
          enableConversation: false,
          enableAIAgents: false,
        };
        const link = replace
          ? await tx.link.update({ where: { id: linkId }, data })
          : await tx.link.create({
              data: {
                id: linkId,
                documentId: version.documentId,
                teamId: user.teamId,
                linkType: "DOCUMENT_LINK",
                ...data,
              },
            });
        if (sha256(JSON.stringify(controls(link))) !== approval.controlsSha256)
          throw new HttpError(503, "Visibility validation failed");
        return Response.json(
          {
            linkId: link.id,
            url: `/view/${link.id}`,
            contentSha256: digest,
            versionId: version.id,
            visibility: {
              passwordRequired: true,
              expiresAt: expires.toISOString(),
              allowDownload: body.allowDownload,
              emailDelivery: false,
              notifications: false,
            },
          },
          { status: 201, headers: { "Cache-Control": "no-store" } },
        );
      },
      { maxWait: 10000, timeout: 15000 },
    );
  });
}
