import test from "node:test";
import assert from "node:assert/strict";
import config from "../../application/next.config.mjs";

const productionPolicy = "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; connect-src 'self'; frame-src 'self'; object-src 'none'; base-uri 'self'; form-action 'self'; frame-ancestors 'self'";

test("CSP permits eval only for synthetic cloud development", async () => {
  const originalNode = process.env.NODE_ENV;
  const originalSynthetic = process.env.PAPERMARK_CLOUD_SYNTHETIC_ONLY;
  try {
    for (const [mode, synthetic] of [["production", "true"], ["production", "false"], ["development", "false"], ["development", "true"]]) {
      process.env.NODE_ENV = mode;
      process.env.PAPERMARK_CLOUD_SYNTHETIC_ONLY = synthetic;
      const routes = await config.headers();
      const policy = routes[0].headers.find(header => header.key === "Content-Security-Policy").value;
      const expected = mode === "development" && synthetic === "true"
        ? productionPolicy.replace("script-src 'self' 'unsafe-inline'", "script-src 'self' 'unsafe-inline' 'unsafe-eval'")
        : productionPolicy;
      assert.equal(policy, expected);
    }
  } finally {
    if (originalNode === undefined) delete process.env.NODE_ENV;
    else process.env.NODE_ENV = originalNode;
    if (originalSynthetic === undefined) delete process.env.PAPERMARK_CLOUD_SYNTHETIC_ONLY;
    else process.env.PAPERMARK_CLOUD_SYNTHETIC_ONLY = originalSynthetic;
  }
});
