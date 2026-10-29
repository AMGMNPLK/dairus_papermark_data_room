# Local synthetic development setup

This runs the maintained Papermark community UI adaptation, not an unchanged
vendor distribution or its paid services. It needs Node **22**, npm, and isolated
PostgreSQL plus Redis REST services. Docker Compose is one optional way to provide
those dependencies; it must be available in the development environment. No
Ironclad services, owner credentials, database dumps or mailbox are used.

Review `compose.cloud.yml` before starting it. From the checkout root:

```sh
node tools/cloud/environment.mjs
docker compose --env-file .env.cloud.local -f compose.cloud.yml up -d db redis redis-rest
node tools/cloud/setup.mjs
node tools/cloud/run.mjs dev
```

Open `http://127.0.0.1:3000/login`. The password is in the ignored mode-600 file
`.cloud/login-password.txt`; do not paste it into a commit/report. Only the seeded
synthetic owner can sign in. No registration, invitation or real mail is enabled.
The historical Investor updates demo is **fictional 2023 content**, required by the
existing archive schema. It is not September 2026 evidence or a sent email. The
monthly pilot/workflow must use separate synthetic fixtures and maintain exact
content/visibility/reviewer/send gates.

`setup.mjs` uses the checked-in lock (`npm ci --ignore-scripts
--legacy-peer-deps`), explicitly generates Prisma, checks the dedicated database,
pushes the disposable schema without reset/data-loss flags, and seeds the fixture.
It refuses production/inherited conflicting configuration, other endpoints,
foreign records or a changed runtime archive. Rerunning preserves fixture state;
after adding other records, setup may refuse rather than overwrite anything.
Never point it at an existing business database. No reset/delete command is
provided. Environment and data live in `.env.cloud.local`, `.cloud/`, and Compose
project volumes; preserve them or inspect their ownership before cleanup.

For a production-mode **local build** (not a deployment):

```sh
node tools/cloud/run.mjs build
node tools/cloud/run.mjs start
```

The start helper uses `application/.next/standalone/application/server.js` and
copies static/public assets during build. The source tree's original `npm start`
entry expects a packaged runtime and is not a source-checkout development command.
Both local servers bind `127.0.0.1:3000`; public sharing remains false. Existing
host-specific validation scripts are not safe portable cloud setup scripts.

Optional local PDF upload/preview (no external conversion):

```sh
docker compose --env-file .env.cloud.local -f compose.cloud.yml --profile pdf up -d s3
node tools/cloud/storage.mjs
node tools/cloud/run.mjs pdf
```

Keep the app running in another terminal. PDF processing uses the existing Node
worker and MuPDF JS/WASM, the same local state directory, PostgreSQL and private
versioned S3 bucket. Limits are 20 MiB, 80 pages and 120 seconds. No Python,
LibreOffice, AWS account, paid API, Resend, Tinybird or Stripe service is needed.
The local S3 fixture permits eight 64 MiB volumes so initial volume allocation
can succeed without the upstream 30 GiB default volume size. `storage.mjs` tests
an actual conditional object write, exact byte readback and duplicate refusal;
it retains one tiny synthetic private text probe. Bucket creation alone is not
an object-storage readiness check.
Without this optional service/worker, navigation and historical demo work, but
successful PDF processing must not be claimed. Browser and PDF acceptance still
require an actual run; file preparation alone establishes no readiness.

If Docker/services are unavailable in Codex Cloud, run static/offline checks and
report that boundary; do not connect production services or invent browser proof.

## Dependency review remains required

On 29 October 2026, the imported `next@16.4.0` build compiled and type-checked
but failed its security check. This development branch now pins **Next 16.4.3**
and **eslint-config-next 16.4.3**, updating only those direct pins and required
lock entries. React/React DOM remain 19.3.0. Sources: the
[14 October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026)
and [16.4.3 maintenance release](https://github.com/vercel/next.js/releases/tag/v16.4.3).
No security-agent command, bypass or broad automatic dependency fix was run.

After that patch, `npm audit --json` reported 20 findings (13 high, six moderate,
one low, zero critical). `npm audit --omit=dev --json` reported eight findings
(six high, one moderate, one low, zero critical). Remaining production-tree high
findings include direct `@vercel/blob`, `@vercel/functions` and `zod`, plus
transitive `@vercel/cli-config`, `@vercel/oidc` and `undici`. These are dependency
tree findings, not proof that every advisory is reachable through this
adaptation's routes. JSON receipts are ignored under `.cloud/`; rerun the
commands for current advisories. Existing ESLint 8.57.0 is below the updated
config's ESLint >=9 peer range, so lint/config migration is a separate unverified
work item; the documented legacy-peer-deps install is not a successful lint check.

`third-party-notices/` and the imported corresponding-source manifest describe
the original deployed dependency baseline. They have **not** been regenerated
for this development build; the old source archive must not be claimed to match
the patched development dependency tree. See `dependency-review.json`. Before
deployment, review/remediate applicable advisories, regenerate the runtime licence
inventory/notices and complete corresponding-source offer, rebuild and repeat
security/browser regression checks. A successful synthetic setup/build does not
certify production security or authorize deployment.
