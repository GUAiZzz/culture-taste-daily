# Stage ④A — deterministic build and QA foundation

Status: `LOCAL NON-PRODUCTION FOUNDATION`

This stage turns canonical public issue source into a deterministic static artifact and tests the fail-closed evidence model required by Production Contract V3. It does not add CI, hosting, preview, Pages, deployment, historical migration, or daily automation.

## Source and output model

Input for one issue lives under `src/issues/YYYY-MM-DD/`:

- `content.md` — complete publishable article source;
- `art-direction.json` — public issue-specific art direction;
- `issue.css` — optional issue-specific expression layered over core grammar;
- `issue-manifest.public.json` — publishable metadata and reporting state.

`npm run build` produces ignored `dist/` with:

- `/index.html` — latest source included in this non-production build;
- `/archive/index.html` — static complete archive;
- `/issues/YYYY-MM-DD/index.html` — stable dated issue URL;
- `/feed.xml` and `/sitemap.xml` — static discovery artifacts;
- `/build-report.json` — input identities, eligibility reasons, and content/artifact digests.

All article text is present in HTML. JavaScript is not required for the cover, article, archive, Sources & Dates, navigation, or links.

## Shared core and issue expression

`core/styles/base.css` is deliberately functional. It owns box sizing, skip-link and focus mechanics, safe media sizing, navigation overflow/touch safety, responsive safety, reduced motion, and a homepage/archive shell scoped to `data-shell="publication"`.

It does not choose an issue palette, background, typography personality or display scale, editorial width, density, image treatment, decoration, or spatial rhythm. Those choices live explicitly in each scoped `src/issues/YYYY-MM-DD/issue.css`. This is a boundary, not a configurable theme system.

## Determinism and identity

The build verifies and records:

- exact canonical contract repository commit, activation commit, and contract-file hash from `dependencies/contract.json`;
- exact shared-core version;
- exact HarryTone repository/branch/commit reference from the public manifest;
- hashes of content, art direction, and issue styling;
- candidate, issue-payload, and complete-artifact SHA-256 digests.

Timestamps do not enter rendered artifacts or their digest. Rebuilding unchanged input produces byte-identical files and identical digests.

## Public manifest schema v2

Schema v2 separates generator reporting from evidence and deployment authority. Compared with the stage-② manifest, it adds:

- `candidate_created_at`, `research_locked_at`, and `content_locked_at` for V3 timing evaluation;
- exact contract and core identities;
- source-file hashes and issue-payload digest location;
- publishable rights summary, never private permission evidence;
- references to separate evidence artifacts;
- explicit limitations.

`status`, `qa`, and any score remain reporting only. They are not inputs that can independently authorize the gate.

The `2026-08-25` manifest is migrated without inventing historical facts. `candidate_created_at` is `null`, and the recorded research lock falls outside the V3 same-day window. The builder discloses this, and the gate blocks the issue. The accepted candidate snapshot remains untouched.

## Four separated evidence roles

### A. Generator report

The public manifest and build report describe what the generator produced. They carry zero independent release authority.

### B. Independent technical evidence

`npm run qa` validates the artifact rather than trusting generator fields. It checks schema and digest integrity, HTML, landmarks/headings, full static article presence, Sources & Dates, internal links, assets, keyboard focus, basic accessibility, no-JavaScript reading, and private-material patterns. Private-material rejection is layered with repository ignore rules; neither layer replaces the other. It captures:

- desktop `1440×900`;
- mobile `390×844`;
- mobile `390×844` with JavaScript disabled;
- desktop `1440×900` with reduced motion.
- Preview homepage at desktop and mobile widths;
- Preview archive at desktop width, including filter interaction.

Technical evidence explicitly cannot judge factual/editorial quality, HarryTone, cultural appropriateness, visual authorship, viewing rhythm, reference integrity, or rights rationale.

### C. Named human editorial/visual review

`npm run review:template` creates a digest-bound `PENDING` form. A named human must inspect truth judgment, HarryTone, cultural appropriateness, image-rights disposition, hierarchy, reference integrity, visual authorship, desktop/mobile translation, and historical fidelity where applicable.

The command never completes that judgment or converts a technical result into human approval.

### D. Evidence gate

`npm run gate` requires all of the following for a local `AUTHORIZED` simulation:

- candidate and artifact digests match across evidence;
- the artifact digest is recomputed at decision time and still matches the evidence;
- independent technical evidence is `PASS`;
- named human review is `APPROVE`, with all applicable checks approved;
- image-rights summary is clear;
- V3 candidate/research/content timing is valid;
- canonical contract and core identities match.

Otherwise it returns `BLOCKED` and selects the provided previous-good release. Gate output is constrained to `production_authority: false`; it cannot deploy.

## Commands

```sh
npm ci
npm run build
npm run qa
npm run review:template
npm run gate -- --previous-good <release-id>
npm test
```

`npm run verify` runs build, technical QA, and the complete test suite.

Outputs are intentionally untracked. A reviewer can inspect `.stage4/evidence/<issue>/technical-evidence.json`, its render PNGs, `editorial-review.json`, and `gate-decision.json` locally.

## Fail-closed simulations

The regression suite proves that malformed HTML, missing assets, JavaScript-only reading, prohibited private material, missing or stale evidence, post-evidence artifact mutation, failed technical evidence, unknown rights, and mismatched digests cannot authorize the local gate. Prohibited fixtures include `.env`, credentials JSON, `private/`, `vendor/harry-tone/`, and `source-ledger.private.json`. It also proves that a manifest `PASS` cannot bypass independent failure, that the previous-good identifier is preserved on block, and that shared core CSS stays functional rather than becoming an issue template.

## Dependency rationale

All dependencies are pinned development tools:

- `markdown-it` renders complete Markdown to static HTML;
- `ajv` and `ajv-formats` validate explicit JSON contracts;
- `html-validate` provides an implementation-independent HTML structure check;
- `playwright` exercises real browser behavior and evidence renders. It uses an available local Chrome binary, with Playwright's bundled Chromium as a fallback.

There is no application framework, production server, database, cloud SDK, GitHub API client, analytics SDK, deployment SDK, or private repository dependency.

## Known limitation and next boundary

This stage proves a repository-native local foundation. It does not prove GitHub-hosted CI reproducibility, preview acceptance, production immutability, Pages compatibility, release retention, or automation recovery. Those require a separately authorized stage and cannot be inferred from local `PASS` results.
