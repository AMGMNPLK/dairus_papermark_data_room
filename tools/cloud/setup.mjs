import { fileURLToPath } from "node:url";
import path from "node:path";
import { root, loadCloudEnvironment, run } from "./common.mjs";
import { assertSeedableDatabase } from "./database.mjs";

loadCloudEnvironment({ seeding: true });
// The Redis REST adapter is required for owner authentication/rate limits.
const ready = await fetch(process.env.UPSTASH_REDIS_REST_URL, {
  method: "POST", headers: { Authorization: `Bearer ${process.env.UPSTASH_REDIS_REST_TOKEN}`, "Content-Type": "application/json" },
  body: JSON.stringify(["PING"]), signal: AbortSignal.timeout(5000),
});
const ping = await ready.json();
if (!ready.ok || ping.result !== "PONG") throw new Error("Local Redis REST readiness check failed; start/review only the isolated development services.");
run("npm", ["ci", "--ignore-scripts", "--legacy-peer-deps"]);
const prismaBin = path.join(root, "node_modules/prisma/build/index.js");
run(process.execPath, [prismaBin, "generate", "--schema", "prisma/schema"]);
const { PrismaClient } = await import("@prisma/client");
const prisma = new PrismaClient();
try { await assertSeedableDatabase(prisma); } finally { await prisma.$disconnect(); }
// Disposable local schema only; no migrate reset, data-loss acceptance or live DB.
run(process.execPath, [prismaBin, "db", "push", "--schema", "prisma/schema", "--skip-generate"]);
run(process.execPath, [fileURLToPath(new URL("./seed.mjs", import.meta.url))]);
console.log("Local setup finished. Start the loopback UI with cloud:dev, or cloud:build then cloud:start.");
