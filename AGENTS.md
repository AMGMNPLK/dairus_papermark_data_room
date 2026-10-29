# Papermark community adaptation

Read `docs/cloud/CLOUD_HANDOFF.md` before implementation. This branch imports the deployed community adaptation, not a pristine upstream application. `application/` is the Next.js entry point and reuses the upstream components and Prisma schema. The upstream README is preserved in `docs/UPSTREAM_README.md`; its setup commands are not the commands for this adaptation.

Use Node 22+ and the pinned npm lockfile. Use official SDKs and existing application components. Keep implementation decisions within the authorized task; preserve unrelated work. Prefer codebase graph tools when available, then normal repository search.

## Development and checks

- `npm run cloud:env` creates ignored local development configuration.
- `npm run cloud:setup` installs the locked dependencies and generates Prisma.
- `npm run cloud:check` checks the cloud setup tools.
- `npm run cloud:build` builds the community application.
- `npm run cloud:dev` starts the application after disposable backend setup and synthetic seeding.
- `python3 development/investor-room/checks/access-flow.py` validates the separate fixture preview while its server is running on localhost:7936.

Check the actual scripts and handoff for complete prerequisites. If infrastructure or a connected repository is missing, finish independent work and report that boundary honestly. Never substitute a successful build or fixture for verified real investor authentication or live source access.

## Data and approval boundary

This repository is public. Commit software, synthetic examples and sanitized documentation only. Never add environment files, credentials, databases, real investor correspondence, reports, financial/legal records, private coaching, product source or production exports. Ignored runtime data stays outside commits.

ClickUp and ERPNext remain monthly work sources. Process the entire previous calendar month, preserve actual completion dates, follow authoritative pagination, reconcile repeated records and overlapping work, and inspect outcomes and evidence. Swarm execution receipts supplement these sources. Missing evidence is unknown, not zero activity or zero revenue. Finance and Legal validate relevant claims within explicit scope.

Every investor-visible file/version, including a replacement behind an existing link, needs founder approval of exact content, audience and visibility. Every email separately needs exact subject/body and To/Cc/Bcc approval. Scheduling, draft completion or specialist review never authorizes sending. No automatic invitations or viewer notifications.

Do not change Ironclad, production volumes, DNS, auth, schedules or live agent services from the cloud task. Prepare releases and rollback plans for later review. The private source appendix and relationship-specific records remain internal.

## Licensing and UI

Preserve upstream copyright, AGPL notices and third-party provenance. Commercial directories retain their own terms; do not activate their handlers or bypass entitlement checks. Build requested free features independently on the community surface, without copying commercial implementations. Reuse the established UI and restrained motion; honor live reduced-motion preferences and preserve unsaved input.
