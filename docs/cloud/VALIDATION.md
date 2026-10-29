# Cloud handoff validation

Verified on 2026-10-29 from isolated fresh Git worktrees on Ironclad. These are development checks with generated credentials and synthetic records; the actual Codex cloud environment still needs to run its own setup and acceptance checks.

## Verified starting point

- Fresh dependency installation using the committed npm lock, `--ignore-scripts` and `--legacy-peer-deps` succeeded on Node 22.22.0/npm 10.9.4. Prisma generation is explicit.
- `npm run cloud:setup` succeeded against a new, separately named local PostgreSQL/Redis REST stack, created its schema and seeded only a fictional owner/workspace and historical archive.
- With Next.js 16.4.3, `npm run cloud:build` passed compilation, TypeScript checks, page generation and standalone asset preparation.
- All 14 offline cloud configuration, fixture and database-refusal tests passed.
- The standalone synthetic investor-room source ran from the new checkout; all 57 access/persistence checks passed.
- The companion monthly workflow's 13 offline tests passed, including independent review of completion classification. Its synthetic CLI produced private artifacts and no publication/send action.
- Local optional S3 setup passed bucket versioning, conditional object creation, exact byte readback and duplicate-write refusal. The initial metadata-only check missed a volume-allocation failure; the disposable fixture was corrected to eight bounded 64 MiB volumes and its check now verifies actual object I/O. No public bucket policy was installed.
- A real Chromium run passed 15 synthetic checks: owner login/session, anonymous API denial, native documents/rooms/visitors/historical pages, own-team reads and foreign-team denial, private room creation with notifications/bulk download disabled, private PDF upload, worker page rendering, authenticated page-media retrieval and anonymous media denial. The historical page loaded at a mobile viewport with reduced-motion preference; no browser page errors were seen. This is not complete keyboard/accessibility or per-investor authentication coverage.
- Portable synthetic motion source, captions, timeline, deterministic audio generator and pinned renderer metadata were included. Source integrity/syntax/ignore checks passed. Cloud browser/render installation and a fresh video render remain unverified.
- Staged software and fixtures passed a separate privacy review. No real correspondence, credentials, runtime databases, private monthly evidence, screenshots or changed commercial module implementations were included.

## Baseline and dependency provenance

`DEPLOYED_SOURCE_IMPORT.json` identifies the original imported source archive and original file hashes. It records the source baseline, not a claim that the cloud development tree is identical to production. The existing `third-party-notices/` inventory similarly comes from that baseline; changes to dependencies need refreshed notices and source-offer packaging before a release.

The imported Next.js 16.4.0 compiled and type-checked but stopped the build with a security error. The [official October security update](https://nextjs.org/blog/nextjs-security-update-october-14-2026) identifies patched versions starting at 16.4.1; the [16.4.3 maintenance release](https://github.com/vercel/next.js/releases/tag/v16.4.3) includes later bug fixes. The development branch uses a targeted patch rather than bypassing that check. This does not patch the running production application.

## Remaining acceptance work

The first cloud task must read `tools/cloud/dependency-review.json` and rerun the current dependency audit. After the targeted patch, the full tree reported 20 findings (13 high, six moderate, one low); the production dependency tree reported eight (six high, one moderate, one low), with no critical findings in those reports. Resolve or explicitly assess remaining findings before any release. Route reachability has not been certified. A successful build or fixture test is not a security certification. The ESLint configuration/runtime compatibility also requires review before claiming lint passed.

The full monthly native UI, live ClickUp/ERPNext adapters, safe read-only Swarm export, authenticated specialist review and per-investor production access are development backlog. The historical page is a synthetic 2023 archive demonstration. The standalone prototype has fixture identities and is not production investor authentication. Private evidence and production credentials remain on Ironclad; they have not been made available to cloud development.

No production service, DNS, mailbox, sharing link or investor-visible content was changed by this handoff. No invitation, viewer notification, email or schedule was activated. Development service startup/stop and local build checks are separate from deployment and publication.

All temporary native-app/worker test processes and all four services in the dedicated development Compose project were stopped after verification. Its synthetic volumes were preserved. The container resilience check reported no missing restart policies; three unrelated existing stateful containers lacked drain labels. No unrelated service was changed.
