import prisma from "@/lib/prisma";
import { HttpError, safe } from "../../../../../server/core";
import { principal } from "../../../../../server/monthly/access";
import { digest } from "../../../../../server/monthly/contract.mjs";
import { readVerifiedEvidence } from "../../../../../server/monthly/evidence";

export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return safe(async () => {
    const reviewer = await principal();
    if (!["finance", "legal"].includes(reviewer.role)) throw new HttpError(403, "Reviewer access required");
    const url = new URL(request.url);
    const candidateId = url.searchParams.get("candidateId") || "";
    const claimId = url.searchParams.get("claimId") || "";
    const rawIndex = url.searchParams.get("index") || "";
    if (!/^(0|[1-9]\d*)$/.test(rawIndex) || !Number.isSafeInteger(Number(rawIndex))) throw new HttpError(400, "Evidence index required");
    const assignment = await prisma.monthlyReviewAssignment.findUnique({ where: { candidateId_principalId_claimId_scope: { candidateId, principalId: reviewer.id, claimId, scope: reviewer.role } } });
    const candidate = assignment && await prisma.monthlyCandidate.findFirst({ where: { id: candidateId, teamId: reviewer.teamId } });
    if (!candidate || digest(candidate.content) !== candidate.hash) throw new HttpError(404, "Evidence unavailable");
    const claim = (candidate.content as any).claims.find((c: any) => c.id === claimId);
    const evidence = claim?.evidence[Number(rawIndex)];
    if (!evidence) throw new HttpError(404, "Evidence unavailable");
    const bytes = await readVerifiedEvidence(reviewer.teamId, evidence);
    return new Response(new Uint8Array(bytes), { headers: { "Content-Type": "application/pdf", "Content-Disposition": 'inline; filename="evidence.pdf"', "Cache-Control": "private, no-store", "X-Content-Type-Options": "nosniff" } });
  });
}
