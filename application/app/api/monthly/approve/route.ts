import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getTeamS3ClientAndConfig } from "@/lib/files/aws-client";
import prisma from "@/lib/prisma";
import { HttpError, ownedVersion, owner, readLimited, renderState, safe, sha256 } from "../../../../server/core";
import { approvalGaps, digest } from "../../../../server/monthly/contract.mjs";
import { MonthlyFileSizeError, readMonthlyFileBytes } from "../../../../server/monthly/bounded-bytes.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function POST(request: Request) {
  return safe(async () => {
    const user = await owner(request, true);
    let body: any;
    try { body = JSON.parse((await readLimited(request, 8192)).toString()); } catch { throw new HttpError(400, "Invalid JSON"); }
    if (!body || typeof body.candidateId !== "string" || typeof body.candidateHash !== "string" || body.confirmReviewed !== true) throw new HttpError(400, "Confirm review of the exact candidate");
    const result = await prisma.$transaction(async tx => {
      const candidate = await tx.monthlyCandidate.findFirst({ where: { id: body.candidateId, teamId: user.teamId } });
      if (!candidate) throw new HttpError(404, "Candidate unavailable");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly:${user.teamId}:${candidate.period}`}))`;
      const latest = await tx.monthlyCandidate.findFirst({ where: { teamId: user.teamId, period: candidate.period }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest?.id !== candidate.id || body.candidateHash !== candidate.hash || digest(candidate.content) !== candidate.hash) throw new HttpError(409, "Candidate changed; review the current version");
      const content = candidate.content as any;
      const receipts = await tx.monthlyReviewReceipt.findMany({ where: { candidateId: candidate.id }, include: { principal: true }, orderBy: [{ createdAt: "asc" }, { id: "asc" }] });
      const reviewed = receipts.map(r => ({ ...r, decision: r.principal.teamId === user.teamId && r.principal.role === r.scope && r.principal.verifiedAt && !r.principal.revokedAt ? r.decision : "revoked" }));
      const gaps = approvalGaps(content, reviewed);
      const room = await tx.dataroom.findFirst({ where: { id: content.audience.roomId, teamId: user.teamId } });
      if (!room) gaps.push("Audience room unavailable");
      for (const id of content.audience.investorIds) {
        const investor = await tx.monthlyPrincipal.findFirst({ where: { id, teamId: user.teamId, role: "investor", verifiedAt: { not: null }, revokedAt: null } });
        const membership = await tx.monthlyRoomMembership.findFirst({ where: { teamId: user.teamId, roomId: content.audience.roomId, principalId: id, revokedAt: null } });
        if (!investor || !membership) gaps.push(`Investor ${id} has no verified active room membership`);
      }
      if (content.video) gaps.push("Video artifact verification is not available");
      for (const file of content.files) {
        const version = await ownedVersion(file.versionId, user.teamId);
        const state = await renderState(version.id);
        if (!version.hasPages || state?.status !== "ready" || state.sha256 !== file.sha256 || !version.file.startsWith(`${user.teamId}/core/`)) { gaps.push(`File ${file.versionId} is not ready or its digest changed`); continue; }
        const { client, config } = await getTeamS3ClientAndConfig(user.teamId);
        const object = await client.send(new GetObjectCommand({ Bucket: config.bucket, Key: version.file }));
        try {
          if (sha256(await readMonthlyFileBytes(object.Body, object.ContentLength)) !== file.sha256) gaps.push(`File ${file.versionId} stored bytes changed`);
        } catch (error) {
          if (error instanceof MonthlyFileSizeError) gaps.push(`File ${file.versionId} is unavailable or too large`);
          else throw error;
        }
      }
      if (gaps.length) return { gaps };
      const receiptHash = digest(receipts.map(({ id, candidateHash, claimHash, decision, limitations }) => ({ id, candidateHash, claimHash, decision, limitations })));
      const approval = await tx.monthlyApproval.create({ data: { candidateId: candidate.id, candidateHash: candidate.hash, approvedBy: user.id, receiptHash } });
      return { approval };
    }, { timeout: 30000 });
    if ("gaps" in result) return Response.json({ message: "Approval requires these items", gaps: result.gaps }, { status: 409, headers });
    return Response.json({ approval: result.approval, publication: false }, { status: 201, headers });
  });
}
