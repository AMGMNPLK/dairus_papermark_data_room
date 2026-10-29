# Monthly review development boundary

The community API stores founder-private immutable candidate rows separately from the
historical correspondence archive. Canonical SHA-256 covers the complete JSON content,
including evidence, exact file versions, audience, visibility and optional video
provenance. A new candidate never replaces an earlier candidate. A scoped specialist
sees only claims explicitly assigned by the founder to that verified, active principal;
a receipt binds the candidate, exact claim hash, decision and limitations. Each claim
requires both Finance and Legal to independently mark it approved, not applicable or
rejected. A founder-selected scope does not stand in for that adjudication. Credentials
are separate from the founder session and checked against the current principal on each
request. There is no registration, invitation, email or principal-provisioning API.

Founder approval is **not available**. The API returns explicit blocking gaps even
when syntactically valid evidence hashes and specialist receipts are supplied: source
authenticity and provenance of source artifacts and the real-world authority of
reviewer identities have not been established. The assigned reviewer can retrieve an
exact uploaded PDF version through a private route that rechecks its bytes; this does
not establish that the upload truly came from the stated source or date. Declared
source gaps also block. The report must match the ordered claim text exactly, so unrelated free-form
prose cannot pass claim checks. Candidate file bytes are checked before the approval
branch could succeed, and optional video remains blocked pending exact-asset validation.
Do not remove these blocks until source authenticity and reviewer authority can be
independently verified and regression tests cover those checks. A JSON receipt, fixture identity, role, preview,
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
node tools/cloud/tests/monthly-evidence-api.mjs
```

The API test creates and deletes synthetic principals, candidates and a private room on
the dedicated local database. It does not test real reviewer identities, investor
serving, publication, email or live integrations.
