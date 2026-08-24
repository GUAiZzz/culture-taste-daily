# Culture & Taste Daily

Independent source repository for Culture & Taste Daily.

Repository stage: **④A Build / QA foundation — local, non-production**

Production Contract V3 is canonical. This branch implements only a deterministic static-build and evidence-gate foundation. It does not enable hosting, preview, deployment, Pages, workflows, or daily automation.

## What is available

- repository-native static rendering from `src/issues/YYYY-MM-DD/`;
- stable latest, archive, dated issue, RSS, and sitemap artifacts;
- public manifest schema v2 and three distinct evidence contracts;
- independent technical QA, including no-JavaScript and viewport renders;
- a named human-review template;
- a local fail-closed gate simulation that has no production authority;
- deterministic regression and failure-path tests.

Manifest `status`, generator QA fields, and scores are reporting only. They cannot approve editorial quality or authorize release.

## Local verification

Node.js 22 or later is required.

```sh
npm ci
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

## Repository map

```text
src/issues/          Canonical public issue source for this repository
candidate/           Accepted local candidate snapshots; not production releases
core/                Shared semantic renderer and product grammar
schemas/             Public manifest and public evidence schemas
scripts/             Deterministic local build, QA, review-template, and gate tools
tests/               Regression and fail-closed simulations
deployment/          Disabled production boundary
automation/          Disabled daily-automation boundary
dependencies/        External dependency identities; never copied private source
docs/                Product, editorial, architecture, and authority decisions
```

## Current candidate

The `2026-08-25` source can be built and technically checked, but it predates canonical V3 timing requirements. Its missing `candidate_created_at` and out-of-window research lock make it ineligible for release. The local evidence gate must return `BLOCKED` for it.

The accepted snapshot at [`candidate/2026-08-25/index.html`](candidate/2026-08-25/index.html) remains unchanged and has never been deployed.

## Hard boundaries

- GitHub Pages, preview hosting, production deployment, workflows, and daily automation remain disabled.
- Private research/source-ledger instances, credentials, tokens, and canonical HarryTone source remain outside this repository.
- HarryTone is represented only by an exact dependency identity.
- `GUAiZzz/GUAiZzz`, its `gh-pages`, the current live site, historical publication artifacts, Library V2, and canonical `GUAiZzz/harry-tone` are outside this work.

See [`docs/DATA_BOUNDARIES.md`](docs/DATA_BOUNDARIES.md).
