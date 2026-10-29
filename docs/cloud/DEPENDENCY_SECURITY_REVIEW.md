# Dependency security review

Reviewed 2026-10-29 against the registry with Node 22.23.4 and the committed lockfile. `npm audit` initially reproduced the handoff's 20 findings (13 high, six moderate, one low; no critical). These are dependency-tree findings, not a route-reachability assessment.

The lockfile was refreshed within existing dependency ranges using `npm audit fix --package-lock-only --legacy-peer-deps --ignore-scripts`. The direct `sanitize-html` pin was updated from 2.18.0 to 2.18.1, which removes its vulnerable `deepmerge` dependency and fixes GHSA-c9rx-x947-fp3h. After these changes, `npm audit` reports seven findings (five high, two moderate); `npm audit --omit=dev` reports five high. Audit counts include affected dependants, not seven distinct vulnerabilities.

Remaining issues require further compatibility and exposure work before release:

- GHSA-mrhx-c7xc-m3w5: Zod versions below 4.6.6 can exhaust memory validating oversized constrained collections. The direct pin is Zod 3.25.76; application validation includes bounded arrays. Upgrading the direct dependency to Zod 4 needs a compatibility review of schemas and consumers. `@vercel/cli-config` separately pins 4.1.11, reached through `@vercel/oidc` by `@vercel/blob` and `@vercel/functions`. npm suggests older Vercel versions; downgrading identity/storage libraries without exercising their integrations would be unsafe. Request-size limits and path reachability have not been certified as mitigations.
- GHSA-rj75-hqrm-r3gf: `postcss-selector-parser` below 6.1.5 permits quadratic CPU use on crafted selectors. The remaining pinned 6.0.10 is a build-time dependency of `@tailwindcss/typography`. Its upstream exact dependency needs a compatible update or a tested override; application routes have not been assessed for exposure.

A clean audit is not a security certification. Re-run the current audit, verify route reachability and regressions, and regenerate the package/licence inventory, notices and corresponding-source offer for the actual release tree. The previous source archive and third-party notices describe the imported baseline and do not cover these changes. The documented ESLint 8 / eslint-config-next 16 compatibility gap also remains; no lint pass is claimed here. No release, production change, or external communication is authorized by this review.
