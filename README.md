# Culture & Taste Daily

Independent source repository for Culture & Taste Daily.

Repository stage: **Preview Build — real site, non-production**

Production Contract V3 governs Production. The site is a static, non-production digital magazine. The owner-authorized Preview amendment is [PREVIEW_AUTONOMY](docs/PREVIEW_AUTONOMY.md): complete daily candidates may merge and deploy after the machine gate; Production remains manual.

Read current source, GitHub and live state with `npm run ops:state -- --online`. Do not infer the latest issue from a dated documentation snapshot.

## What is available

- repository-native static rendering from `src/issues/YYYY-MM-DD/`;
- stable latest, archive, dated issue, RSS, and sitemap artifacts;
- public manifest schema v2 and three distinct evidence contracts;
- independent technical QA, including no-JavaScript and viewport renders;
- a named human-review template;
- a local fail-closed gate simulation that has no production authority;
- deterministic regression and failure-path tests;
- a designed homepage and filterable archive;
- provenance-labeled official image links with readable failure fallbacks; unknown reuse rights remain Production-blocking;
- preserved 2026-08-20 and 2026-08-21 self-contained HTML originals;
- an honest 16-page facsimile reader for the supplied 2026-08-22 PDF;
- manually triggered GitHub Pages Preview hosting after CI verification.
- a fail-closed daily candidate preflight and auditable runbook with separately gated Preview authority.
- strict daily live checks for public source pages and official media, plus a weekly read-only site-health audit.

Manifest `status`, generator QA fields, and scores are reporting only. They cannot approve editorial quality or authorize release.

## Local verification

Node.js 22 or later is required.

```sh
npm ci
npm run daily:preflight
npm run build
npm run qa
npm run review:template
npm run gate -- --previous-good <release-id>
npm test
```

Generated output is deliberately ignored by Git:

- `dist/` — static build output;
- `.stage4/evidence/` — local technical, review, and gate evidence;
- `test-results/` and `playwright-report/` — test artifacts.

See [`docs/STAGE4A_BUILD_QA.md`](docs/STAGE4A_BUILD_QA.md) for the evidence model, commands, limitations, and schema migration.

See [`docs/PREVIEW_BUILD.md`](docs/PREVIEW_BUILD.md) for the real-site and historical-migration boundary.

See [`docs/IMAGE_RIGHTS_WORKFLOW.md`](docs/IMAGE_RIGHTS_WORKFLOW.md) for the source-image preference, provenance fields, and fail-closed usage-rights rule.

## Repository map

```text
src/issues/          Canonical public issue source for this repository
src/historical/      Supplied historical originals and migration metadata
src/site/assets/     Local publication-shell cover assets
candidate/           Accepted local candidate snapshots; not production releases
core/                Shared semantic renderer and product grammar
schemas/             Public manifest and public evidence schemas
scripts/             Deterministic local build, QA, review-template, and gate tools
tests/               Regression and fail-closed simulations
deployment/          Preview-only hosting and disabled production boundary
automation/          Daily Preview policy and recovery runbooks
dependencies/        External dependency identities; never copied private source
docs/                Product, editorial, architecture, and authority decisions
```

## Current publication state

Run `npm run ops:state -- --online` for dated source, branch, PR, deployment and live marker reconciliation. A successful workflow alone is not live verification; run `npm run preview:live -- --sha <deployed-commit>`.

## Hard boundaries

- The GitHub Pages site is a non-production Preview only; every page is visibly labeled and `noindex`.
- Production cutover and unattended production automation remain disabled. The daily Preview task is governed by the separate fail-closed Preview gate.
- Private research/source-ledger instances, credentials, tokens, and canonical HarryTone source remain outside this repository.
- HarryTone is represented only by an exact dependency identity.
- `GUAiZzz/GUAiZzz`, its `gh-pages`, the current live site, Library V2, and canonical `GUAiZzz/harry-tone` remain untouched.

See [`docs/DATA_BOUNDARIES.md`](docs/DATA_BOUNDARIES.md).
