import test from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { assertLocalConfiguration, runtime } from "./common.mjs";
import { assertSeedableDatabase } from "./database.mjs";
import { historicalFixture } from "./fixture.mjs";

function configuration() {
  return {
    NODE_ENV: "development", PAPERMARK_CLOUD_SYNTHETIC_ONLY: "true",
    POSTGRES_PRISMA_URL: "postgresql://papermark_cloud:fake@127.0.0.1:15432/papermark_cloud",
    POSTGRES_PRISMA_URL_NON_POOLING: "postgresql://papermark_cloud:fake@127.0.0.1:15432/papermark_cloud",
    POSTGRES_PRISMA_SHADOW_URL: "postgresql://papermark_cloud:fake@127.0.0.1:15432/papermark_cloud_shadow",
    NEXTAUTH_URL: "http://127.0.0.1:3000", NEXT_PUBLIC_BASE_URL: "http://127.0.0.1:3000", PAPERMARK_ALLOWED_ORIGINS: "http://127.0.0.1:3000",
    UPSTASH_REDIS_REST_URL: "http://127.0.0.1:18080", UPSTASH_REDIS_REST_LOCKER_URL: "http://127.0.0.1:18080",
    PAPERMARK_STATE_DIR: path.join(runtime, "state"), PAPERMARK_PUBLIC_SHARING_ENABLED: "false",
    PAPERMARK_OWNER_ID: "cloud-synthetic-owner", PAPERMARK_TEAM_ID: "cloud-synthetic-team",
    NEXT_PUBLIC_UPLOAD_TRANSPORT: "s3", NEXT_PRIVATE_UPLOAD_ENDPOINT: "http://127.0.0.1:18333",
  };
}
test("loopback-only synthetic configuration accepted", () => assertLocalConfiguration(configuration(), { seeding: true }));
for (const [name, delta] of [
  ["production seed", { NODE_ENV: "production" }],
  ["production database", { POSTGRES_PRISMA_URL: "postgresql://real:fake@db.example.invalid:5432/business" }],
  ["another local database", { POSTGRES_PRISMA_URL: "postgresql://papermark_cloud:fake@127.0.0.1:15432/company" }],
  ["public sharing", { PAPERMARK_PUBLIC_SHARING_ENABLED: "true" }],
  ["foreign owner", { PAPERMARK_OWNER_ID: "someone-else" }],
  ["private runtime path", { PAPERMARK_STATE_DIR: "/var/lib/production" }],
  ["remote Redis", { UPSTASH_REDIS_REST_URL: "https://redis.example.invalid" }],
  ["real mail provider", { RESEND_API_KEY: "fake-test-key" }],
]) test(`refuses ${name}`, () => assert.throws(() => assertLocalConfiguration({ ...configuration(), ...delta }, { seeding: true })));
test("fictional history remains explicitly 2023 and zero sent messages", () => {
  assert.equal(historicalFixture.audience.year, 2023);
  assert.equal(historicalFixture.coverage.matchingSentMessages, 0);
  assert.equal(historicalFixture.updates.length, 1);
  assert.match(historicalFixture.updates[0].subject, /SYNTHETIC/);
  assert.match(historicalFixture.updates[0].sourceUrl, /synthetic-demo-not-a-message$/);
  assert.match(historicalFixture.updates[0].sourceNotes.join(" "), /not the September 2026/);
});
test("foreign data blocks seed before any write", async () => {
  await assert.rejects(() => assertSeedableDatabase({ $queryRaw: async () => [{ tablename: "OtherBusinessTable" }] }), /unfamiliar/);
});
test("non-fixture occupied table blocks seed", async () => {
  await assert.rejects(() => assertSeedableDatabase({ $queryRaw: async () => ["User", "Team", "UserTeam", "Document"].map(tablename => ({ tablename })), $queryRawUnsafe: async () => [{ occupied: true }] }), /non-fixture/);
});
test("empty dedicated database is seedable", async () => assertSeedableDatabase({ $queryRaw: async () => [] }));
test("another user is never overwritten", async () => {
  const prisma = { $queryRaw: async () => ["User", "Team", "UserTeam"].map(tablename => ({ tablename })),
    user: { findMany: async () => [{ id: "other-user", email: "other@example.invalid" }] },
    team: { findMany: async () => [] }, userTeam: { findMany: async () => [] } };
  await assert.rejects(() => assertSeedableDatabase(prisma), /preserving it unchanged/);
});
