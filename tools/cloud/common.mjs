import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { spawnSync } from "node:child_process";

export const root = fileURLToPath(new URL("../../", import.meta.url));
export const envPath = path.join(root, ".env.cloud.local");
export const runtime = path.join(root, ".cloud");
export function requireNode22() {
  if (Number(process.versions.node.split(".")[0]) !== 22)
    throw new Error("Use Node 22 for this pinned development setup.");
}
export function assertLocalConfiguration(env, { seeding = false } = {}) {
  if (seeding && env.NODE_ENV === "production")
    throw new Error("Synthetic seeding refuses NODE_ENV=production.");
  if (env.PAPERMARK_CLOUD_SYNTHETIC_ONLY !== "true")
    throw new Error("Missing synthetic-only development marker.");
  for (const key of ["POSTGRES_PRISMA_URL", "POSTGRES_PRISMA_URL_NON_POOLING", "POSTGRES_PRISMA_SHADOW_URL"]) {
    const url = new URL(env[key] || "http://invalid");
    if (url.protocol !== "postgresql:" || url.hostname !== "127.0.0.1" || url.port !== "15432" ||
        url.username !== "papermark_cloud" || !["/papermark_cloud", "/papermark_cloud_shadow"].includes(url.pathname))
      throw new Error(`${key} must address the dedicated loopback development database.`);
  }
  for (const key of ["NEXTAUTH_URL", "NEXT_PUBLIC_BASE_URL", "PAPERMARK_ALLOWED_ORIGINS"])
    if (env[key] !== "http://127.0.0.1:3000") throw new Error(`${key} must use the loopback development origin.`);
  for (const key of ["UPSTASH_REDIS_REST_URL", "UPSTASH_REDIS_REST_LOCKER_URL"])
    if (env[key] !== "http://127.0.0.1:18080") throw new Error(`${key} must use the local Redis REST adapter.`);
  if (env.PAPERMARK_PUBLIC_SHARING_ENABLED !== "false") throw new Error("Public sharing must remain disabled.");
  if (env.PAPERMARK_STATE_DIR !== path.join(runtime, "state")) throw new Error("State must remain in this checkout's .cloud/state.");
  if (env.PAPERMARK_OWNER_ID !== "cloud-synthetic-owner" || env.PAPERMARK_TEAM_ID !== "cloud-synthetic-team")
    throw new Error("Only the synthetic owner/workspace are allowed.");
  if (env.NEXT_PUBLIC_UPLOAD_TRANSPORT !== "s3" || env.NEXT_PRIVATE_UPLOAD_ENDPOINT !== "http://127.0.0.1:18333")
    throw new Error("Uploads must target the optional local S3 service.");
  for (const key of ["RESEND_API_KEY", "SENDGRID_API_KEY", "SMTP_URL", "TINYBIRD_TOKEN", "STRIPE_SECRET_KEY"])
    if (env[key]) throw new Error(`Remove inherited external-provider configuration: ${key}`);
}
export function loadCloudEnvironment(options = {}) {
  requireNode22();
  if (!existsSync(envPath)) throw new Error("Run node tools/cloud/environment.mjs first.");
  // Explicit file only. Never source shell code, a home .env, or production configuration.
  const keys = readFileSync(envPath, "utf8").split(/\r?\n/).filter(x => /^[A-Z][A-Z0-9_]*=/.test(x)).map(x => x.split("=", 1)[0]);
  const inherited = Object.fromEntries(keys.filter(k => Object.hasOwn(process.env, k)).map(k => [k, process.env[k]]));
  for (const key of keys) delete process.env[key];
  process.loadEnvFile(envPath);
  for (const [key, value] of Object.entries(inherited)) {
    if (key === "NODE_ENV" && value === "production") throw new Error("Do not run development setup with NODE_ENV=production.");
    if (value !== process.env[key]) throw new Error(`Remove conflicting inherited variable ${key}; this setup uses .env.cloud.local only.`);
  }
  assertLocalConfiguration(process.env, options);
  return process.env;
}
export function run(command, args, options = {}) {
  const result = spawnSync(command, args, { cwd: root, env: process.env, stdio: "inherit", ...options });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`${path.basename(command)} failed with exit ${result.status ?? "signal"}.`);
}
