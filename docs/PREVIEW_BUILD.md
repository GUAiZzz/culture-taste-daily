# Culture & Taste Daily — Preview Build

Status: `PUBLIC NON-PRODUCTION PREVIEW`

Preview endpoint: <https://guaizzz.github.io/culture-taste-daily/>

The purpose of this phase is to review a real website rather than another architecture document. It joins the publication homepage, archive, current issue, and supplied historical originals without declaring any artifact production-ready.

## What readers can inspect

- a designed homepage with a latest-issue entry and four distinct issue covers;
- a complete archive with optional JavaScript filtering and a full static fallback;
- the scoped 2026-08-25 issue world, readable without JavaScript;
- the untouched self-contained 2026-08-20 and 2026-08-21 originals inside a modern Preview context page;
- a 16-page facsimile reader plus the untouched source PDF for 2026-08-22.

Every public page is marked non-production and includes `noindex,nofollow`.

## Historical migration modes

The original 2026-08-20 and 2026-08-21 HTML files are copied byte-for-byte after their supplied SHA-256 values are verified. Their context pages do not rewrite their internal layout, type, images, or editorial content.

The supplied 2026-08-22 PDF contains 16 raster mobile screenshots and no selectable article text. The Preview therefore uses the exact embedded page images as an honest facsimile and preserves the original PDF. It does not invent a reconstructed source. Production eligibility remains blocked until original web source, accessible text, rights review, and human historical-fidelity review are available.

Historical embedded media is under human review and is not represented as production-cleared merely because it appears in Preview.

## Shared publication versus issue worlds

`core/styles/site.css` styles only pages carrying `data-shell="publication"`. It organizes navigation, homepage, archive, and historical context.

Current issue art direction remains in the scoped `src/issues/<date>/issue.css`. Historical originals retain their own internal CSS. The publication shell does not impose its palette, typography, grid, or interaction on issue content.

## Preview CI and hosting

`.github/workflows/preview.yml` runs on pull requests to `main`. It installs pinned dependencies, runs the full verification suite, builds with the GitHub Pages base URL, rechecks the exact artifact, and retains review evidence for seven days.

Deployment occurs only through an explicit `workflow_dispatch`. There is no push-triggered deployment, schedule, production job, custom domain, redirect, or daily automation. The Pages endpoint is Preview infrastructure only.

## Production blockers intentionally retained

- 2026-08-25 does not satisfy canonical V3 candidate/research timing;
- historical media rights require human review;
- 2026-08-22 lacks selectable accessible source text;
- named editorial/visual Preview acceptance has not occurred;
- production evidence, rollback, post-deploy verification, and daily automation remain unimplemented.
