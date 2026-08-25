# Culture & Taste Daily — Preview Build

Status: `PUBLIC NON-PRODUCTION PREVIEW`

Preview endpoint: <https://guaizzz.github.io/culture-taste-daily/>

The purpose of this phase is to review a real website rather than another architecture document. It joins the publication homepage, archive, current issue, and supplied historical originals without declaring any artifact production-ready.

## What readers can inspect

- a designed homepage with a 2026-08-25 latest-issue entry and the historical/current archive covers;
- a complete archive with optional JavaScript filtering and a full static fallback;
- the scoped 2026-08-25 issue world, readable without JavaScript, with one verified first-party official image origin per story; unknown-rights images remain externally linked and production-blocking;
- the untouched self-contained 2026-08-20 and 2026-08-21 originals inside a modern Preview context page;
- a 16-page historical web edition plus the untouched source PDF for 2026-08-22.

Every generated context and issue page is marked non-production and includes `noindex,nofollow`. `robots.txt` also disallows direct historical binaries/pages as a best-effort Pages control; GitHub Pages cannot provide custom response headers, so this is not a claim of perfect crawler enforcement.

## Historical migration modes

The original 2026-08-20 and 2026-08-21 HTML files are copied byte-for-byte after their supplied SHA-256 values are verified. Their context pages do not rewrite their internal layout, type, images, or editorial content.

The supplied 2026-08-22 PDF contains 16 raster mobile screenshots and no selectable article text. The Preview now gives each exact embedded page a stable web anchor and reading map while preserving the original PDF. It does not invent reconstructed source text. Production eligibility remains blocked until original web source, accessible text, rights review, and human historical-fidelity review are available.

Historical embedded media is under human review and is not represented as production-cleared merely because it appears in Preview.

## Shared publication versus issue worlds

`core/styles/site.css` styles only pages carrying `data-shell="publication"`. It organizes navigation, homepage, archive, and historical context.

Current issue art direction remains in the scoped `src/issues/<date>/issue.css`. Historical originals retain their own internal CSS. The publication shell does not impose its palette, typography, grid, or interaction on issue content.

## Preview CI and hosting

`.github/workflows/preview.yml` runs on pull requests to `main`. It installs pinned dependencies, runs the full verification suite, builds with the GitHub Pages base URL, rechecks the exact artifact, and retains review evidence for seven days.

Deployment occurs only through an explicit `workflow_dispatch`. There is no push-triggered deployment, GitHub Actions schedule, production job, custom domain, or redirect. A separate Codex daily dry-run task may prepare a dated candidate pull request, but it cannot dispatch this workflow or update the Pages endpoint. The Pages endpoint is Preview infrastructure only.

## Production blockers intentionally retained

- 2026-08-24 was refreshed after the canonical same-day production window and is Preview-only;
- 2026-08-25 does not satisfy canonical V3 candidate/research timing and remains non-production;
- historical media rights require human review;
- 2026-08-24 includes five linked, publisher-hosted source-image previews; the public rights summary remains `blocked`, so they are Preview-only and cannot authorize production;
- 2026-08-25 includes eight linked first-party official source-image previews; the public rights summary remains `blocked`, so they are Preview-only and cannot authorize production;
- 2026-08-22 lacks selectable accessible source text;
- named editorial/visual Preview acceptance has not occurred;
- production evidence, rollback, post-deploy verification, and unattended production automation remain unimplemented.
