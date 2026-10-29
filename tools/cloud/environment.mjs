import { mkdirSync, writeFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { root, envPath, runtime, requireNode22, loadCloudEnvironment } from "./common.mjs";

requireNode22();
if (existsSync(envPath)) {
  loadCloudEnvironment({ seeding: true });
  console.log("Existing local synthetic environment preserved.");
} else {
  if (process.env.NODE_ENV === "production") throw new Error("Development setup refuses NODE_ENV=production.");
  if (existsSync(runtime)) throw new Error("Existing .cloud directory preserved; inspect it before creating an environment.");
  mkdirSync(runtime, { mode: 0o700 });
  mkdirSync(path.join(runtime, "state"), { mode: 0o700 });
  const secret = () => randomBytes(32).toString("hex");
  const dbPassword = secret(), redisPassword = secret(), redisToken = secret();
  const s3Key = `cloud${randomBytes(8).toString("hex")}`, s3Secret = secret();
  const values = {
    NODE_ENV: "development", NEXT_TELEMETRY_DISABLED: "1", PAPERMARK_CLOUD_SYNTHETIC_ONLY: "true",
    PAPERMARK_CLOUD_DB_PASSWORD: dbPassword, PAPERMARK_CLOUD_REDIS_PASSWORD: redisPassword,
    POSTGRES_PRISMA_URL: `postgresql://papermark_cloud:${dbPassword}@127.0.0.1:15432/papermark_cloud?schema=public`,
    POSTGRES_PRISMA_URL_NON_POOLING: `postgresql://papermark_cloud:${dbPassword}@127.0.0.1:15432/papermark_cloud?schema=public`,
    POSTGRES_PRISMA_SHADOW_URL: `postgresql://papermark_cloud:${dbPassword}@127.0.0.1:15432/papermark_cloud_shadow?schema=public`,
    NEXTAUTH_URL: "http://127.0.0.1:3000", NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3000", PAPERMARK_ALLOWED_ORIGINS: "http://127.0.0.1:3000",
    NEXTAUTH_SECRET: secret(), PAPERMARK_MEDIA_SECRET: secret(), PAPERMARK_OWNER_ID: "cloud-synthetic-owner",
    PAPERMARK_TEAM_ID: "cloud-synthetic-team", PAPERMARK_OWNER_PASSWORD_HASH: "", PAPERMARK_PUBLIC_SHARING_ENABLED: "false",
    PAPERMARK_STATE_DIR: path.join(runtime, "state"), UPSTASH_REDIS_REST_URL: "http://127.0.0.1:18080",
    UPSTASH_REDIS_REST_TOKEN: redisToken, UPSTASH_REDIS_REST_LOCKER_URL: "http://127.0.0.1:18080", UPSTASH_REDIS_REST_LOCKER_TOKEN: redisToken,
    NEXT_PUBLIC_UPLOAD_TRANSPORT: "s3", NEXT_PRIVATE_UPLOAD_ENDPOINT: "http://127.0.0.1:18333",
    NEXT_PRIVATE_UPLOAD_REGION: "us-east-1", NEXT_PRIVATE_UPLOAD_BUCKET: "papermark-cloud-synthetic",
    NEXT_PRIVATE_UPLOAD_ACCESS_KEY_ID: s3Key, NEXT_PRIVATE_UPLOAD_SECRET_ACCESS_KEY: s3Secret,
  };
  writeFileSync(envPath, Object.entries(values).map(([k, v]) => `${k}=${v}`).join("\n") + "\n", { flag: "wx", mode: 0o600 });
  writeFileSync(path.join(runtime, "login-password.txt"), secret() + "\n", { flag: "wx", mode: 0o600 });
  writeFileSync(path.join(runtime, "seaweed-s3.json"), JSON.stringify({ identities: [{ name: "synthetic-development", credentials: [{ accessKey: s3Key, secretKey: s3Secret }], actions: ["Admin", "Read", "Write", "List", "Tagging"] }] }, null, 2), { flag: "wx", mode: 0o600 });
  console.log("Created ignored local development configuration and synthetic password file; no credentials printed.");
  console.log(`Local password location: ${path.join(root, ".cloud/login-password.txt")}`);
}
