# Monthly review development boundary

The community API stores founder-private immutable candidate rows separately from the
historical correspondence archive. Canonical SHA-256 covers the complete JSON content,
including evidence, exact file versions, audience, visibility and optional video
provenance. A new candidate never replaces an earlier candidate. A scoped specialist
sees only claims explicitly assigned by the founder to that verified, active principal;
a receipt binds the candidate, exact claim hash, decision and limitations. Credentials
are separate from the founder session and checked against the current principal on each
request. There is no registration, invitation, email or principal-provisioning API.

Founder approval is **not available**. The API returns explicit blocking gaps even
when syntactically valid evidence hashes and specialist receipts are supplied: source
artifact bytes have not been resolved and authenticated, and the applicability of
Finance/Legal scopes has not been independently adjudicated. Declared source gaps also
block. The report must match the ordered claim text exactly, so unrelated free-form
prose cannot pass claim checks. Candidate file bytes are checked before the approval
branch could succeed, and optional video remains blocked pending exact-asset validation.
Do not remove these blocks until real evidence verification, scope adjudication and
regression tests are implemented. A JSON receipt, fixture identity, role, preview,
render or API success is not a specialist validation or publication approval.

Room membership and verified investor principals are schema foundations only. No
investor portal, publication, invitation or investor file-serving route is implemented.
Any eventual serving route must recheck the exact approved candidate, live membership,
revocation, expiry, audience and file bytes for every page, API and media/download
request. It must preserve prior snapshots and prevent cross-room access. Existing
founder-only routes remain separate; these schema additions do not authorize sharing.

After following `tools/cloud/README.md` with only disposable services, regenerate Prisma,
apply the disposable schema using the documented setup, and run:

```sh
node --test tools/cloud/tests/monthly-contract.test.mjs
node tools/cloud/tests/monthly-api.mjs
```

The API test creates and deletes synthetic principals, candidates and a private room on
the dedicated local database. It does not test real reviewer identities, investor
serving, publication, email or live integrations.
