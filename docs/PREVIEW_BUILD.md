# Culture & Taste Daily — Preview Build

The current owner-approved structure is specified by [Reading System](READING_SYSTEM.md) and [A3](PRODUCTION_CONTRACT_V3_A3.md). The [September 7 rooms release](THREE_ROOMS_RELEASE.md) is historical evidence, not the current daily UI requirement.

Status: `PUBLIC NON-PRODUCTION PREVIEW`

Preview endpoint: <https://guaizzz.github.io/culture-taste-daily/>

The purpose of this phase is to review a real website rather than another architecture document. It joins the publication homepage, archive, current issue, and supplied historical originals without declaring any artifact production-ready.

## What readers can inspect

- a designed homepage with a generated latest-issue entry and the historical/current archive covers;
- a complete archive with optional JavaScript filtering and a full static fallback;
- dated issue worlds, readable without JavaScript, with first-party official image provenance per story; unknown-rights images remain externally linked and production-blocking;
- the untouched self-contained 2026-08-20 and 2026-08-21 originals inside a modern Preview context page;
- a 16-page historical web edition plus the untouched source PDF for 2026-08-22.

Every generated context and issue page is marked non-production and includes `noindex,nofollow`. `robots.txt` also disallows direct historical binaries/pages as a best-effort Pages control; GitHub Pages cannot provide custom response headers, so this is not a claim of perfect crawler enforcement.

## Historical migration modes

The original 2026-08-20 and 2026-08-21 HTML files are copied byte-for-byte after their supplied SHA-256 values are verified. Their context pages do not rewrite their internal layout, type, images, or editorial content.

The supplied 2026-08-22 PDF contains 16 raster mobile screenshots and no selectable article text. The Preview now gives each exact embedded page a stable web anchor and reading map while preserving the original PDF. It does not invent reconstructed source text. Production eligibility remains blocked until original web source, accessible text, rights review, and human historical-fidelity review are available.

Historical embedded media is under human review and is not represented as production-cleared merely because it appears in Preview.

## Shared reading UI versus locked source

`core/rooms/render.mjs` applies the approved shared reading system to structured home/archive/issue/article routes. The same structure and controls support field/coral/analog styles independently combined with light/dark/warm appearance. New content inherits these assets and the required `reading_system_contract` evidence.

Existing issue art-direction and scoped CSS remain source/compatibility records; dated content does not redefine the shared settings, navigation or reader. Supplied historical originals retain their exact internal files and hashes, alongside their Preview context pages. See A3 and `READING_SYSTEM.md` for the current authority; the former three-room document remains historical implementation evidence.

## Preview CI and hosting

`.github/workflows/preview.yml` runs on pull requests to `main` and `preview-build-v1`. The latter is the current shared publication and daily-candidate base. It installs pinned dependencies, runs the full verification suite, builds with the GitHub Pages base URL, rechecks the exact artifact, and retains review evidence for seven days.

Deployment occurs only through an explicit `workflow_dispatch`. There is no push-triggered deployment, GitHub Actions schedule, production job, custom domain, or redirect. A separate Codex daily task may prepare a dated candidate pull request and a weekly task may audit the site read-only, the daily task can dispatch only after the Preview gate passes; the weekly task remains read-only. The Pages endpoint is Preview infrastructure only.

## Production blockers intentionally retained

- 2026-08-24 was refreshed after the canonical same-day production window and is Preview-only;
- 2026-08-25 does not satisfy canonical V3 candidate/research timing and remains non-production;
- historical media rights require human review;
- 2026-08-24 includes five linked, publisher-hosted source-image previews; the public rights summary remains `blocked`, so they are Preview-only and cannot authorize production;
- 2026-08-25 includes eight linked first-party official source-image previews; the public rights summary remains `blocked`, so they are Preview-only and cannot authorize production;
- 2026-08-22 lacks selectable accessible source text;
- named editorial/visual Production acceptance is still required;
- production evidence, rollback, post-deploy verification, and unattended production automation remain unimplemented.

## Current operational authority

Use `npm run ops:state -- --online` to reconcile source, GitHub and live state. The owner-approved [Preview amendment](PREVIEW_AUTONOMY.md) supersedes earlier candidate-only operational descriptions. Policy defines 11:00 start, 13:00/15:00/17:00 recovery and 18:00 final reconciliation in Shanghai. Complete current-day packages may automatically merge and dispatch Preview only after `preview:release` passes. No Production authority is granted. Scheduler availability and next-day unattended execution must be verified independently of local tests.

A3 requires the stable shared renderer and `reading_system_contract` for future updates. Ordinary first publication has a floor of ten complete articles; later qualified additions use a cumulative package. Historical supplement exact-ten, schedule, privacy/rights and Production-disabled boundaries remain. Current source/GitHub/live identity must still be reconciled with `ops:state`; this document is not deployment evidence.
