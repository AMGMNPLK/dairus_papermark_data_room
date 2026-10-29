import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { HttpError, owner, readLimited, safe } from "../../../server/core";
import { approvalGaps, digest, validateCandidate } from "../../../server/monthly/contract.mjs";

export const dynamic = "force-dynamic";
const headers = { "Cache-Control": "private, no-store" };
export async function GET(request: Request) {
  return safe(async () => {
    const user = await owner();
    const period = new URL(request.url).searchParams.get("period") || "";
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(period)) throw new HttpError(400, "Invalid period");
    const candidate = await prisma.monthlyCandidate.findFirst({ where: { teamId: user.teamId, period }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], include: { receipts: { orderBy: [{ createdAt: "asc" }, { id: "asc" }], include: { principal: true } }, approvals: { orderBy: { approvedAt: "desc" }, take: 1 } } });
    if (!candidate) return Response.json({ period, candidate: null, receipts: [], approval: null }, { headers });
    if (digest(candidate.content) !== candidate.hash) throw new HttpError(409, "Candidate integrity check failed");
    const { receipts, approvals, ...record } = candidate;
    const visibleReceipts = receipts.map(({ principal, ...r }) => ({ ...r, reviewer: { id: principal.id, role: principal.role }, active: !!principal.verifiedAt && !principal.revokedAt && principal.teamId === user.teamId && principal.role === r.scope }));
    const reviewed = visibleReceipts.map(r => ({ ...r, decision: r.active ? r.decision : "revoked" }));
    const receiptHash = digest(receipts.map(({ id, candidateHash, claimHash, decision, limitations }) => ({ id, candidateHash, claimHash, decision, limitations })));
    const approval = approvals[0];
    const valid = !!approval && approval.receiptHash === receiptHash && approval.candidateHash === candidate.hash && approvalGaps(candidate.content, reviewed).length === 0;
    return Response.json({ period, candidate: record, receipts: visibleReceipts, approval: valid ? { ...approval, status: "historical", liveAccessChecked: false } : null }, { headers });
  });
}
export async function POST(request: Request) {
  return safe(async () => {
    const user = await owner(request, true);
    let data: any;
    try { data = JSON.parse((await readLimited(request, 1024 * 1024)).toString()); } catch { throw new HttpError(400, "Invalid JSON"); }
    const problem = validateCandidate(data?.period, data?.content);
    if (problem) throw new HttpError(400, problem);
    const hash = digest(data.content);
    const candidate = await prisma.$transaction(async tx => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`monthly:${user.teamId}:${data.period}`}))`;
      const latest = await tx.monthlyCandidate.findFirst({ where: { teamId: user.teamId, period: data.period }, orderBy: [{ createdAt: "desc" }, { id: "desc" }] });
      if (latest?.hash === hash) throw new HttpError(409, "This candidate is already current");
      const createdAt = new Date(Math.max(Date.now(), (latest?.createdAt.getTime() || 0) + 1));
      return tx.monthlyCandidate.create({ data: { teamId: user.teamId, period: data.period, content: data.content as Prisma.InputJsonValue, hash, createdBy: user.id, createdAt } });
    });
    return Response.json({ period: data.period, candidate, receipts: [], approval: null }, { status: 201, headers });
  });
}
