import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/core-auth";
import prisma from "@/lib/prisma";
import { ratelimit } from "@/lib/redis";
import { HttpError } from "../core";

export async function principal(request?: Request, mutating = false) {
  if (mutating) {
    const allowed = (process.env.PAPERMARK_ALLOWED_ORIGINS || process.env.NEXTAUTH_URL || "").split(",");
    if (!request?.headers.get("origin") || !allowed.includes(request.headers.get("origin")!)) throw new HttpError(403, "Invalid request origin");
  }
  const session = await getServerSession(authOptions);
  const id = (session?.user as { id?: string } | undefined)?.id || "";
  const match = /^monthly:([^:]+):(\d+)$/.exec(id);
  if (!match) throw new HttpError(401, "Reviewer login required");
  const user = await prisma.monthlyPrincipal.findUnique({ where: { id: match[1] } });
  if (!user || user.teamId !== process.env.PAPERMARK_TEAM_ID || !user.verifiedAt || user.revokedAt || user.sessionVersion !== Number(match[2])) throw new HttpError(401, "Session revoked or unavailable");
  if (mutating && !(await ratelimit(30, "1 m").limit(`monthly-review:${user.id}`)).success) throw new HttpError(429, "Too many requests");
  return user;
}
