# Cloud development handoff

Primary repository: `AMGMNPLK/dairus_papermark_data_room`, branch `codex/investor-relations-cloud` (public). Companion repository: `AMGMNPLK/swarm-edge`, branch `codex/investor-workflow-cloud` (private). Attach both repositories to the Codex cloud environment when available. They do not need production credentials for synthetic development.

## What was brought into source control

The primary branch imports software from the source offer corresponding to the deployed community adaptation: original UI components, an explicit owner-only compatibility boundary, local document processing, private rooms/visitor records and the historical correspondence interface with reduced-motion support. `docs/cloud/DEPLOYED_SOURCE_IMPORT.json` records the upstream and source-package hashes. Runtime state and all real business content were excluded.

`application/` is the actual app root. This is a community adaptation with explicit supported routes, not every upstream commercial server module. Preserve the working native components rather than replacing the product with another dashboard. Unsupported operations fail closed.

`development/investor-room/` is a separate synthetic functional prototype: overview, update, exact document, persisted private question and investment-status flow. It is not integrated production investor authentication. Its synthetic identities are test fixtures only.

The companion's `investor-relations/` package contains the portable monthly-workflow foundation, synthetic examples, contracts and tests. It is separate from private monthly evidence retained on the server.

## Setup

Use Node 22, npm, Python 3.11+ and git. Python's standard library is enough for the standalone prototype and companion package. A Python virtualenv alone does not install the Next.js stack.

```bash
python3 -m venv --without-pip .venv
npm run cloud:env
docker compose --env-file .env.cloud.local -f compose.cloud.yml up -d db redis redis-rest
npm run cloud:setup
npm run cloud:check
npm run cloud:build
```

For the native app, start only disposable backends using `compose.cloud.yml`, then seed and start through the cloud tools. Read the tool output and `tools/cloud/README.md` for exact commands. If Docker is unavailable, the synthetic prototype and companion workflow tests remain runnable; do not claim the native backend is working. In a managed cloud runtime, inspect its current network policy/credentials through supported tools and follow its proxy/CA guidance before Docker/network operations. Never print credentials or copy the host's existing environment.

```bash
python3 development/investor-room/server.py --port 7936
# In another terminal:
python3 development/investor-room/checks/access-flow.py
```

Generate synthetic state locally. The historical interface intentionally uses a synthetic 2023 archive shape. That does not make it a monthly report store: the real historical schema is hard-coded to 2023 and must remain separate from new monthly candidate editions.

## Implement in this order

1. Establish a reproducible native-app baseline in disposable services: owner login, documents, private rooms, visitors, upload/PDF processing and source notices. Record which routes are implemented versus unavailable. Keep the app's native look and existing professional motion.
2. Integrate the synthetic investor-room experience as an owner-only native preview first. Add monthly editions separately from the historical correspondence archive. Reuse cards, tabs, tables, document rendering and the current authenticated media boundary.
3. Wire a private monthly preparation flow to the companion contracts: reporting period/timezone, source coverage, complete pagination, source-ID deduplication, mirror and parent/subtask overlap reconciliation, dated outcomes/evidence, missing/conflicting data, previous commitments, risks, next milestones and specific asks.
4. Implement adapters through official supported clients and existing scoped identities. Start with fixtures. Live credentials/connectivity require explicit configuration and validation; never assume Ironclad sessions or files transferred into the cloud.
5. Address the known read gaps before claiming automation: ClickUp can return short nonterminal pages, and archived scopes need explicit tested handling. Some Swarm task-list/detail GET routes can perform queue recovery; provide a genuinely read-only, paginated, business-scoped monthly evidence export before using them for reporting. Do not reset sync cursors or replay events silently, because downstream ERP writes can result.
6. Add claim-specific Finance/Legal review packets, immutable candidate versions and approval invalidation. An API read, AI summary or role badge is not a completed specialist validation.
7. Only after private preview/access tests, implement verified per-investor identity and room membership with server-side checks on every page/API/file request. Separate the founder's source archive from outward editions and private relationship records. Test at least two investors plus founder, including identifier tampering, revocation, direct upstream access and download boundaries.
8. Bind outward approval to exact content, evidence, document versions, audience, visibility/download/expiry and review receipts. Keep prior published snapshots pinned. Content or audience changes create a new pending candidate.
9. Start from `development/motion-sample/README.md` for the portable source of the previously previewed synthetic video. Add optional short video from the same reviewed script/timeline, with local rendering, captions, asset provenance, timestamped frame review and final-file/audio checks. Paid narration/avatars are not required. Treat the exact rendered asset as a separately reviewable version.
10. Finish with end-to-end synthetic monthly flow, desktop/mobile/keyboard/live reduced-motion checks, privacy/access tests, clear source coverage and recoverable errors. Prepare deployment, storage provenance, local backup/restore, rollback and dependent-service checks for later Ironclad review.

## Definition of done for cloud development

A fresh checkout runs the documented checks; a complete synthetic month produces a private candidate with traceable claims and explicit gaps; the founder can review it in the native UI; simulated investors cannot access other rooms or internal sources; every changed edition/visibility returns to review. No outward content or email is sent automatically. Report remaining real-data, specialist-review, access and deployment dependencies rather than inventing success.

## Hard boundaries

No real investor content, credentials, bank/tax/contracts, coaching or product source belongs in this public repository. Do not import the server's private pilot directory. No paid-module activation or commercial-code copying. No production deployment, real viewer provisioning, publication, invitation, notification, email or schedule activation is authorized by this development handoff. Exact founder content/visibility and separate exact email approvals remain required.

Work on feature branches and return reviewed commits/diffs plus test evidence. Keep both repositories' ownership and unrelated changes intact.
