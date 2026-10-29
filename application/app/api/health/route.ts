import prisma from "@/lib/prisma";
import { redis } from "@/lib/redis";

export const dynamic = "force-dynamic";
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    await redis.ping();
    return Response.json({
      status: "ready",
      edition: "community-core",
      emailDelivery: false,
      automaticNotifications: false,
    });
  } catch {
    return Response.json({ status: "unavailable" }, { status: 503 });
  }
}
