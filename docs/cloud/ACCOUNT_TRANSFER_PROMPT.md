# Restart prompt: monthly investor-relations workflow

Use this prompt to start a new Codex cloud task after changing accounts. The new
account must have Git access to both repositories, including the private Swarm
repository. The cloud environment, credentials, services, generated data and chat
history are not transferred by Git.

> Continue developing our monthly investor-relations experience in Papermark.
> Work on the existing feature branches, preserve all prior and unrelated changes,
> and execute the complete task in `docs/cloud/DEVELOPMENT_PROMPT.md`.
>
> Repositories and starting branches:
>
> - `AMGMNPLK/dairus_papermark_data_room`, branch `codex/monthly-investor-development`.
>   The original cloud handoff baseline is `f78dc707`; subsequent development,
>   including the private monthly workspace and review foundations, is on this branch.
> - Private `AMGMNPLK/swarm-edge`, branch `codex/monthly-investor-development`.
>   The original cloud handoff baseline is `5fcafc2`; the branch continues that work.
>
> Verify the checked-out heads and Git status before editing; read applicable
> `AGENTS.md` files. Read Papermark `docs/cloud/DEVELOPMENT_PROMPT.md`,
> `CLOUD_HANDOFF.md`, `VALIDATION.md`, `MONTHLY_DEVELOPMENT_VALIDATION.md`,
> `MONTHLY_REVIEW_BOUNDARY.md`, `DEPENDENCY_SECURITY_REVIEW.md`,
> `IRONCLAD_RELEASE_PROPOSAL.md`, and `tools/cloud/README.md`. Read Swarm
> `docs/investor-relations/CLOUD_HANDOFF.md`, `ACCESS_INTAKE.md`, the
> `investor-relations/README.md` and its contracts and known-gap proposals. The
> original handoff validation predates later commits; inspect code and tests too.
>
> Use Node 22, Python 3.11+ in a virtual environment, synthetic data, and the
> documented disposable services. Inspect the new cloud environment's current
> network policy and credentials, and follow its proxy, CA and Docker guidance.
> Do not assume access to Ironclad, prior local files, live services or browser
> sessions. Do not copy real data or credentials into the public repository.
>
> Continue implementation and verification of the full brief, especially complete
> ClickUp/ERPNext scope inventory and collection, read-only Swarm evidence export,
> independently verified source provenance and Finance/Legal authority, exact-version
> review and approval, native verified investor identities and room isolation, expiry
> and revocation, and optional video. Preserve the existing Papermark UI and motion.
> The current founder approval is intentionally blocked; no investor serving or
> publication path is enabled. Keep those gates blocked until all necessary checks
> are implemented and verified. A synthetic identity, role, API success, file hash,
> render, or review-shaped record is not proof of real source or reviewer authority.
>
> Continue independent work without waiting for live credentials. For real source
> access and business policy, use the private intake checklist: ask for the authorized
> ClickUp and ERPNext scopes and least-privilege read access, status and completion
> semantics, private source evidence and provenance, reviewer authority, and investor
> identity/membership/expiry/revocation policy. Secrets belong in approved bindings,
> not chat, commits or reports. Do not claim live coverage from synthetic fixtures.
>
> Do not deploy, merge to a release branch, publish investor material, provision or
> invite real viewers, send messages, enable viewer notifications, activate schedules,
> replay sync events or reset production cursors. Every outward file/version and its
> audience/visibility require exact founder approval, and every email separately needs
> approval of exact subject/body and To/Cc/Bcc. No paid provider or licence purchase
> is authorized. Return reviewable commits, test evidence and remaining dependencies.

## State at account-transfer preparation

- Cloud handoff commits are ancestors of the monthly-development branches; continue
  from those branches, not from the older handoff commits.
- The latest synthetic companion suite passed 31 tests. A closed ClickUp status is
  not automatically delivered: explicit scope-specific classification is required.
- Node 22 cloud/contract/handoff/bounded-stream checks and authenticated synthetic
  evidence and closed investor-boundary API tests passed. Two fixture investors were
  denied founder/reviewer/media access, including expired and revoked sessions; this
  does not establish a native investor portal or membership-revocation serving path.
- A production-mode native build passed before the latest bounded-stream change;
  TypeScript and its affected tests passed afterward. Synthetic founder login and
  monthly navigation were observed; automated import/save, mobile, keyboard and live
  reduced-motion checks remain unverified. Re-run the appropriate full build and
  browser checks in the new environment.
- The dependency review recorded seven audit findings, five in the production tree,
  at its last audit. Re-audit and assess current reachability and compatibility;
  regenerate the actual release's licence notices and corresponding-source offer.
- Private evidence authenticity, real reviewer authority, full live collection,
  authenticated investor serving and immutable publication remain incomplete. The
  approval gate is blocked. The development environment's synthetic services were
  stopped; local synthetic volumes and ignored files are not included in Git.
