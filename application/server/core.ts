import { GetObjectCommand, PutObjectCommand } from "@aws-sdk/client-s3";
import type { Link } from "@prisma/client";
import { type JwtPayload, sign, verify } from "jsonwebtoken";
import { getServerSession } from "next-auth";
import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { authOptions } from "@/lib/core-auth";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { ratelimit } from "@/lib/redis";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}
export const stateDir = () =>
  process.env.PAPERMARK_STATE_DIR || "/var/lib/papermark/state";
export const sha256 = (data: Buffer | string) =>
  createHash("sha256").update(data).digest("hex");
export async function readState<T>(name: string): Promise<T | null> {
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(name))
    throw new Error("Invalid state name");
  try {
    return JSON.parse(await readFile(path.join(stateDir(), name), "utf8"));
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
    throw e;
  }
}
export async function writeState(name: string, value: unknown) {
  if (!/^[a-zA-Z0-9_-]+\.json$/.test(name))
    throw new Error("Invalid state name");
  await mkdir(stateDir(), { recursive: true, mode: 0o700 });
  const temp = path.join(stateDir(), `.${randomUUID()}.tmp`);
  await writeFile(temp, JSON.stringify(value, null, 2) + "\n", {
    mode: 0o600,
    flush: true,
  });
  await rename(temp, path.join(stateDir(), name));
}
export async function owner(request?: Request, mutating = false) {
  if (mutating) {
    const allowed = (
      process.env.PAPERMARK_ALLOWED_ORIGINS ||
      process.env.NEXTAUTH_URL ||
      ""
    ).split(",");
    if (
      !request?.headers.get("origin") ||
      !allowed.includes(request.headers.get("origin")!)
    )
      throw new HttpError(403, "Invalid request origin");
  }
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id;
  if (!id || id !== process.env.PAPERMARK_OWNER_ID)
    throw new HttpError(401, "Owner login required");
  if (mutating) {
    const limited = await ratelimit(30, "1 m").limit("owner-mutations");
    if (!limited.success) throw new HttpError(429, "Too many requests");
  }
  const teamId = process.env.PAPERMARK_TEAM_ID;
  if (!teamId) throw new HttpError(503, "Workspace unavailable");
  const membership = await prisma.userTeam.findUnique({
    where: { userId_teamId: { userId: id, teamId } },
    include: { team: true },
  });
  if (
    !membership ||
    membership.role !== "ADMIN" ||
    membership.status !== "ACTIVE" ||
    membership.blockedAt ||
    membership.team.plan !== "free"
  )
    throw new HttpError(403, "Workspace access denied");
  return { id, teamId, name: membership.team.name };
}
export async function ownedVersion(id: string, teamId: string) {
  const version = await prisma.documentVersion.findFirst({
    where: { id, document: { teamId } },
    include: { document: true, pages: { orderBy: { pageNumber: "asc" } } },
  });
  if (!version) throw new HttpError(404, "Version not found");
  return version;
}
export type RenderState = {
  status: "ready" | "failed" | "running";
  sha256?: string;
  pageCount?: number;
  error?: string;
  updatedAt: string;
};
export async function renderState(versionId: string) {
  return readState<RenderState>(`render-${versionId}.json`);
}
export type Visibility = {
  passwordHash: string;
  expiresAt: string;
  allowDownload: boolean;
  emailProtected: false;
  emailAuthenticated: false;
  allowList: string[];
  denyList: string[];
  enableNotification: false;
};
export type Approval = {
  schema: 1;
  linkId: string;
  documentId: string;
  versionId: string;
  contentSha256: string;
  documentName: string;
  visibility: Visibility;
  controlsSha256: string;
  approvedBy: string;
  approvedAt: string;
};
export function controls(link: Link): Visibility {
  return {
    passwordHash: link.password || "",
    expiresAt: link.expiresAt?.toISOString() || "",
    allowDownload: link.allowDownload === true,
    emailProtected: false,
    emailAuthenticated: false,
    allowList: link.allowList,
    denyList: link.denyList,
    enableNotification: false,
  };
}
export async function approvedLink(linkId: string) {
  const approval = await readState<Approval>(`approval-${linkId}.json`);
  const link = await prisma.link.findUnique({
    where: { id: linkId },
    include: { document: { include: { versions: true } } },
  });
  if (
    !approval ||
    !link ||
    process.env.PAPERMARK_PUBLIC_SHARING_ENABLED !== "true" ||
    link.linkType !== "DOCUMENT_LINK" ||
    !link.document ||
    link.teamId !== process.env.PAPERMARK_TEAM_ID ||
    link.isArchived ||
    link.deletedAt ||
    !link.expiresAt ||
    link.expiresAt <= new Date()
  )
    throw new HttpError(404, "Link unavailable");
  const version = link.document.versions.find(
    (v) => v.id === approval.versionId,
  );
  const state = version && (await renderState(version.id));
  const supported =
    link.emailProtected === false &&
    link.emailAuthenticated === false &&
    !link.enableAgreement &&
    !link.enableWatermark &&
    !link.enableUpload &&
    !link.enableConversation &&
    !link.enableAIAgents &&
    !link.enableNotification;
  if (
    !version?.hasPages ||
    !state ||
    state.status !== "ready" ||
    state.sha256 !== approval.contentSha256 ||
    link.documentId !== approval.documentId ||
    link.document.name !== approval.documentName ||
    !supported ||
    sha256(JSON.stringify(controls(link))) !== approval.controlsSha256
  )
    throw new HttpError(
      404,
      "Approval does not match current content and visibility",
    );
  return { link, version, approval };
}
type Grant = {
  versionId: string;
  page?: number;
  download?: boolean;
  ownerId?: string;
  linkId?: string;
  viewId?: string;
  approvalHash?: string;
};
export function mediaGrant(grant: Grant) {
  const secret = process.env.PAPERMARK_MEDIA_SECRET;
  if (!secret) throw new HttpError(503, "Media unavailable");
  const token = sign(grant, secret, {
    algorithm: "HS256",
    expiresIn: 120,
    issuer: "papermark-community",
    audience: "media",
  });
  return `/api/media?grant=${encodeURIComponent(token)}`;
}
export async function media(request: Request) {
  const token = new URL(request.url).searchParams.get("grant");
  if (!token || !process.env.PAPERMARK_MEDIA_SECRET)
    throw new HttpError(401, "Media access required");
  let grant: JwtPayload & Grant;
  try {
    grant = verify(token, process.env.PAPERMARK_MEDIA_SECRET, {
      algorithms: ["HS256"],
      issuer: "papermark-community",
      audience: "media",
    }) as JwtPayload & Grant;
  } catch {
    throw new HttpError(401, "Media access expired");
  }
  let teamId: string;
  if (grant.ownerId) {
    const user = await owner();
    if (user.id !== grant.ownerId) throw new HttpError(403, "Access denied");
    teamId = user.teamId;
  } else {
    if (!grant.linkId || !grant.viewId)
      throw new HttpError(403, "Access denied");
    const { link, version, approval } = await approvedLink(grant.linkId);
    if (
      version.id !== grant.versionId ||
      grant.approvalHash !== sha256(JSON.stringify(approval))
    )
      throw new HttpError(404, "Approval changed");
    const view = await prisma.view.findFirst({
      where: {
        id: grant.viewId,
        linkId: link.id,
        documentId: link.documentId,
        isArchived: false,
      },
    });
    if (!view || (grant.download && !link.allowDownload))
      throw new HttpError(403, "Download disabled");
    teamId = link.teamId!;
  }
  const version = await ownedVersion(grant.versionId, teamId);
  if (!version.hasPages) throw new HttpError(409, "PDF is still processing");
  const page = grant.page
    ? version.pages.find((p) => p.pageNumber === grant.page)
    : null;
  if (!grant.download && !page) throw new HttpError(404, "Page not found");
  const key = grant.download ? version.file : page!.file;
  if (!key.startsWith(`${teamId}/core/`))
    throw new HttpError(403, "Invalid storage scope");
  const { client, config } = await getTeamS3ClientAndConfig(teamId);
  const result = await client.send(
    new GetObjectCommand({ Bucket: config.bucket, Key: key }),
  );
  if (!result.Body) throw new HttpError(404, "File unavailable");
  if (Number(result.ContentLength) > 20 * 1024 * 1024)
    throw new HttpError(409, "Stored file integrity check failed");
  const bytes = Buffer.from(await result.Body.transformToByteArray());
  const expected = grant.download
    ? (await renderState(version.id))?.sha256
    : (page!.metadata as { sha256?: string } | null)?.sha256;
  if (!expected || sha256(bytes) !== expected)
    throw new HttpError(409, "Stored file integrity check failed");
  return new Response(new Uint8Array(bytes), {
    headers: {
      "Content-Type": grant.download ? "application/pdf" : "image/png",
      "Cache-Control": "private, no-store",
      "Content-Disposition": grant.download
        ? 'attachment; filename="document.pdf"'
        : "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
export async function readLimited(request: Request, max: number) {
  if (Number(request.headers.get("content-length")) > max)
    throw new HttpError(413, "PDF exceeds 20 MB");
  const reader = request.body?.getReader();
  if (!reader) throw new HttpError(400, "Empty upload");
  const parts: Buffer[] = [];
  let length = 0;
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    length += value.byteLength;
    if (length > max) {
      await reader.cancel();
      throw new HttpError(413, "PDF exceeds 20 MB");
    }
    parts.push(Buffer.from(value));
  }
  return Buffer.concat(parts);
}
export async function upload(request: Request) {
  const user = await owner(request, true);
  if (
    !new URL(request.url).searchParams.has("documentId") &&
    (await prisma.document.count({ where: { teamId: user.teamId } })) >= 50
  )
    throw new HttpError(409, "Workspace document limit reached");

  if (request.headers.get("content-type") !== "application/pdf")
    throw new HttpError(415, "Upload a PDF");
  let name: string;
  try {
    name = decodeURIComponent(request.headers.get("x-document-name") || "");
  } catch {
    throw new HttpError(400, "Invalid filename");
  }
  if (
    !name.toLowerCase().endsWith(".pdf") ||
    name.length > 200 ||
    /[\x00-\x1f/\\]/.test(name)
  )
    throw new HttpError(400, "Invalid PDF filename");
  const bytes = await readLimited(request, 20 * 1024 * 1024);
  if (bytes.length < 5 || bytes.subarray(0, 5).toString() !== "%PDF-")
    throw new HttpError(415, "Invalid PDF");
  const oldId = new URL(request.url).searchParams.get("documentId");
  const existing = oldId
    ? await prisma.document.findFirst({
        where: { id: oldId, teamId: user.teamId },
      })
    : null;
  if (oldId && !existing) throw new HttpError(404, "Document not found");
  const key = `${user.teamId}/core/${randomUUID()}/source.pdf`;
  const { client, config } = await getTeamS3ClientAndConfig(user.teamId, {
    requestChecksumCalculation: "WHEN_REQUIRED",
  });
  await client.send(
    new PutObjectCommand({
      Bucket: config.bucket,
      Key: key,
      Body: bytes,
      ContentType: "application/pdf",
      IfNoneMatch: "*",
    }),
  );
  const result = await prisma.$transaction(async (tx) => {
    if (existing)
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${existing.id}))`;
    const latest = existing
      ? await tx.documentVersion.findFirst({
          where: { documentId: existing.id },
          orderBy: { versionNumber: "desc" },
        })
      : null;
    const common = {
      file: key,
      type: "pdf",
      contentType: "application/pdf",
      storageType: "S3_PATH" as const,
    };
    const document =
      existing ||
      (await tx.document.create({
        data: { ...common, name, teamId: user.teamId, ownerId: user.id },
      }));
    const version = await tx.documentVersion.create({
      data: {
        ...common,
        documentId: document.id,
        versionNumber: (latest?.versionNumber || 0) + 1,
        fileSize: BigInt(bytes.length),
        isPrimary: !existing,
      },
    });
    return {
      documentId: document.id,
      versionId: version.id,
      versionNumber: version.versionNumber,
    };
  });
  return {
    ...result,
    sha256: sha256(bytes),
    status: "processing",
    publication: "private",
    message: existing
      ? "Replacement stored as a private draft. Existing links keep their approved version."
      : "PDF stored privately. No link was created.",
  };
}
export async function safe(operation: () => Promise<Response>) {
  try {
    return await operation();
  } catch (error) {
    const status = error instanceof HttpError ? error.status : 503;
    // No external logging transports or raw exception/storage/credential details.
    return Response.json(
      {
        message:
          error instanceof HttpError
            ? error.message
            : "Service temporarily unavailable",
      },
      { status, headers: { "Cache-Control": "no-store" } },
    );
  }
}
