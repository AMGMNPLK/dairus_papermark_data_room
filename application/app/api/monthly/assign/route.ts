import prisma from "@/lib/prisma";
import { HttpError, owner, readLimited, safe } from "../../../../server/core";
import { digest } from "../../../../server/monthly/contract.mjs";
export async function POST(request: Request) {
  return safe(async () => {
    const founder = await owner(request, true);
    let body: any;
    try { body = JSON.parse((await readLimited(request, 8192)).toString()); } catch { throw new HttpError(400, "Invalid JSON"); }
    if (!body || typeof body.candidateId !== "string" || typeof body.principalId !== "string" || typeof body.claimId !== "string") throw new HttpError(400, "Candidate, reviewer and claim required");
    const assignment = await prisma.$transaction(async tx => {
      const candidate = await tx.monthlyCandidate.findFirst({ where: { id: body.candidateId, teamId: founder.teamId } });
      if (!candidate) throw new HttpError(404, "Candidate unavailable");
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly:${founder.teamId}:${candidate.period}`}))`;
      const latest = await tx.monthlyCandidate.findFirst({ where: { teamId: founder.teamId, period: candidate.period }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest?.id !== candidate.id || digest(candidate.content) !== candidate.hash) throw new HttpError(409, "Candidate changed");
      const reviewer = await tx.monthlyPrincipal.findFirst({ where: { id: body.principalId, teamId: founder.teamId, verifiedAt: { not: null }, revokedAt: null, role: { in: ["finance", "legal"] } } });
      const claim = (candidate.content as any).claims.find((c: any) => c.id === body.claimId);
      if (!reviewer || !claim) throw new HttpError(404, "Reviewer or claim unavailable for this scope");
      return tx.monthlyReviewAssignment.upsert({ where: { candidateId_principalId_claimId_scope: { candidateId: candidate.id, principalId: reviewer.id, claimId: claim.id, scope: reviewer.role } }, create: { candidateId: candidate.id, principalId: reviewer.id, claimId: claim.id, scope: reviewer.role, createdBy: founder.id }, update: {} });
    });
    return Response.json({ assignment }, { status: 201, headers: { "Cache-Control": "private, no-store" } });
  });
}
