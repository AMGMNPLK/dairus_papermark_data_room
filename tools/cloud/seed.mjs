import { readFileSync, writeFileSync, existsSync, chmodSync } from "node:fs";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { envPath, runtime, loadCloudEnvironment } from "./common.mjs";
import { assertSeedableDatabase } from "./database.mjs";
import { historicalFixture } from "./fixture.mjs";

loadCloudEnvironment({ seeding: true });
const prisma = new PrismaClient();
try {
  await assertSeedableDatabase(prisma);
  const file = path.join(runtime, "state/investor-communications-2023.json");
  const text = JSON.stringify(historicalFixture, null, 2) + "\n";
  if (existsSync(file) && readFileSync(file, "utf8") !== text) throw new Error("Existing runtime archive preserved; it is not this synthetic fixture.");
  const password = readFileSync(path.join(runtime, "login-password.txt"), "utf8").trim();
  if (password.length < 32) throw new Error("Synthetic password file is invalid.");
  const existingHash = process.env.PAPERMARK_OWNER_PASSWORD_HASH;
  if (existingHash && !(await bcrypt.compare(password, existingHash))) throw new Error("Existing owner hash does not match local synthetic password; preserving it.");
  const hash = existingHash || await bcrypt.hash(password, 12);
  await prisma.$transaction(async tx => {
    await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext('papermark-cloud-synthetic-seed'))`;
    await tx.user.upsert({ where: { id: "cloud-synthetic-owner" }, update: {}, create: { id: "cloud-synthetic-owner", email: "cloud-owner@example.invalid", name: "Synthetic Cloud Owner", plan: "free" } });
    await tx.team.upsert({ where: { id: "cloud-synthetic-team" }, update: {}, create: { id: "cloud-synthetic-team", name: "Synthetic Development Workspace", plan: "free", timezone: "Europe/Madrid", ignoredDomains: [], globalBlockList: [] } });
    await tx.userTeam.upsert({ where: { userId_teamId: { userId: "cloud-synthetic-owner", teamId: "cloud-synthetic-team" } }, update: {}, create: { userId: "cloud-synthetic-owner", teamId: "cloud-synthetic-team", role: "ADMIN", status: "ACTIVE", notificationPreferences: { yearInReview: { enabled: false } } } });
  });
  if (!existsSync(file)) writeFileSync(file, text, { flag: "wx", mode: 0o600 });
  const env = readFileSync(envPath, "utf8");
  if (!/^PAPERMARK_OWNER_PASSWORD_HASH=/m.test(env)) throw new Error("Owner hash field is missing from local environment.");
  writeFileSync(envPath, env.replace(/^PAPERMARK_OWNER_PASSWORD_HASH=.*$/m, () => `PAPERMARK_OWNER_PASSWORD_HASH=${hash}`), { mode: 0o600 });
  chmodSync(envPath, 0o600);
  console.log("Synthetic owner, free ADMIN workspace and fictional 2023 archive ready. No documents, links, invitations or messages created.");
} finally { await prisma.$disconnect(); }
