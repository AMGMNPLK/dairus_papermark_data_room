import prisma from "@/lib/prisma";
import { HttpError, readLimited, safe } from "../../../../server/core";
import { principal } from "../../../../server/monthly/access";
import { digest } from "../../../../server/monthly/contract.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  return safe(async () => {
    const reviewer = await principal();
    if (!["finance", "legal"].includes(reviewer.role)) throw new HttpError(403, "Reviewer access required");
    const id = new URL(request.url).searchParams.get("candidateId") || "";
    const candidate = await prisma.monthlyCandidate.findFirst({ where: { id, teamId: reviewer.teamId } });
    if (!candidate || digest(candidate.content) !== candidate.hash) throw new HttpError(404, "Review packet unavailable");
    const assignments = await prisma.monthlyReviewAssignment.findMany({ where: { candidateId: candidate.id, principalId: reviewer.id, scope: reviewer.role } });
    if (!assignments.length) throw new HttpError(404, "Review packet unavailable");
    const assigned = new Set(assignments.map(a => a.claimId));
    const content = candidate.content as any;
    const claims = content.claims.filter((c: any) => assigned.has(c.id)).map((c: any) => ({ ...c, claimHash: digest(c) }));
    return Response.json({ candidateId: candidate.id, candidateHash: candidate.hash, period: candidate.period, scope: reviewer.role, claims }, { headers });
  });
}
export async function POST(request: Request) {
  return safe(async () => {
    const reviewer = await principal(request, true);
    if (!["finance", "legal"].includes(reviewer.role)) throw new HttpError(403, "Reviewer access required");
    let body: any;
    try { body = JSON.parse((await readLimited(request, 8192)).toString()); } catch { throw new HttpError(400, "Invalid JSON"); }
    if (!body || typeof body.candidateId !== "string" || typeof body.candidateHash !== "string" || typeof body.claimId !== "string" || typeof body.claimHash !== "string" || !["approved", "not_applicable", "rejected"].includes(body.decision) || body.confirmReviewed !== true || typeof body.limitations !== "string" || !body.limitations.trim() || body.limitations.length > 2000) throw new HttpError(400, "Review decision, exact claim and limitations required");
    const receipt = await prisma.$transaction(async tx => {
      const candidate = await tx.monthlyCandidate.findFirst({ where: { id: body.candidateId, teamId: reviewer.teamId } });
      if (!candidate) throw new HttpError(404, "Review packet unavailable");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly:${reviewer.teamId}:${candidate.period}`}))`;
      const latest = await tx.monthlyCandidate.findFirst({ where: { teamId: reviewer.teamId, period: candidate.period }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest?.id !== candidate.id || candidate.hash !== body.candidateHash || digest(candidate.content) !== candidate.hash) throw new HttpError(409, "Candidate changed; review the current version");
      const assignment = await tx.monthlyReviewAssignment.findUnique({ where: { candidateId_principalId_claimId_scope: { candidateId: candidate.id, principalId: reviewer.id, claimId: body.claimId, scope: reviewer.role } } });
      if (!assignment) throw new HttpError(404, "Review assignment unavailable");
      const claim = (candidate.content as any).claims.find((c: any) => c.id === body.claimId);
      if (!claim || digest(claim) !== body.claimHash || !claim.evidence.length) throw new HttpError(409, "Claim, scope or evidence changed");
      const last = await tx.monthlyReviewReceipt.findFirst({ where: { candidateId: candidate.id, claimId: claim.id, scope: reviewer.role }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      return tx.monthlyReviewReceipt.create({ data: { candidateId: candidate.id, candidateHash: candidate.hash, principalId: reviewer.id, scope: reviewer.role, claimId: claim.id, claimHash: body.claimHash, decision: body.decision, limitations: body.limitations.trim(), createdAt: new Date(Math.max(Date.now(), (last?.createdAt.getTime() || 0) + 1)) } });
    });
    return Response.json({ receipt }, { status: 201, headers });
  });
}
