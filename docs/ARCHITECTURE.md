# Source architecture

Current shared publication structure: [Reading System](READING_SYSTEM.md), approved by [A3](PRODUCTION_CONTRACT_V3_A3.md) on 2026-10-28. [Three rooms release](THREE_ROOMS_RELEASE.md) remains historical implementation evidence.

## Boundary

`GUAiZzz/culture-taste-daily` is the source of truth for Culture & Taste Daily code, public issue source, historical Preview objects, build configuration, and non-production Preview configuration.

It has no runtime, workflow, Pages, or content dependency on `GUAiZzz/GUAiZzz`.

## Layers

```text
private research workspace (outside repository)
        ↓ selected publishable facts only
src/issues/<date>/ + reviewed historical originals
        ↓ deterministic build
immutable Preview artifact
        ↓ CI verification + manual Preview dispatch
public non-production Preview
        ↓ explicit human approval
production release
```

The pipeline ends at the non-production Preview today. The production arrow remains inactive and separately gated.

The daily candidate task operates before the public-source layer. It resumes a private persistent date workspace, uses `preview-build-v1` as the stable current publication container, may promote only publishable issue source to a dated branch, and follows the machine-gated Preview state machine in PREVIEW_AUTONOMY.md. The policy owns 11:00 start, 13:00/15:00/17:00 recovery and 18:00 closure. Production retains its original window and review requirements.

A separate weekly read-only task checks automation drift, deterministic QA, live publication routes, and all public source/media links. It writes no repository state and has no pull-request or deployment authority.

## Public issue source

Each issue source directory may contain:

- `content.md` — locked reader-facing content;
- `art-direction.json` — issue-specific visual decisions;
- `issue-manifest.public.json` — publishable metadata and reporting fields.

Private research and private source-ledger instances never enter `src/`.

## Shared core versus issue expression

`core/` owns the reviewed shared homepage, issue/article readers, archive navigation, settings, natural-ratio image display, source disclosures, responsive behavior and deterministic output. `core/rooms/render.mjs` is the stable entrypoint. All new daily packages inherit it; source-only candidates do not replace the interface.

Daily packages supply editorial hierarchy, locked bilingual text, verified images/inline placements, captions, sources, cover and preserved public metadata. Their scoped style must not override shared reading controls or require JavaScript for content. Shared assets include `reading-system.css/js` and `interaction.css/js`; maintenance changes run the required `reading_system_contract` and full independent QA. Field/Coral/Analog retain their visual-material identities via one shared structure and independent light/dark/warm appearance. Legacy room assets and issue art-direction fields remain compatibility data, not instructions to create separate channel interfaces or vary the UI each day.

## Historical Preview objects

`src/historical/<date>/` stores only the three explicitly supplied historical originals, public migration metadata, and required facsimile assets. Exact original hashes are verified during build. These objects are Preview-only until rights, accessibility, and historical-fidelity review is complete.

## Candidate snapshots

`candidate/2026-08-25/` preserves the locally accepted static candidate and public QA evidence. It is not `dist/`, a release artifact, or a deployable branch.

## Deployment invariant

The current workflow may deploy only an exact-SHA, visibly labeled Preview authorized by the owner or the daily Preview gate after deterministic checks pass. Production remains unimplemented. Any later production deployment must use a distinct protected evidence gate and leave the previous good release untouched on failure.

`automation/daily-policy.json` and `automation/DAILY_RUN.md` define the externally scheduled candidate boundary. `automation/weekly-health-policy.json` and `automation/WEEKLY_HEALTH.md` define the weekly read-only audit. GitHub Actions still has no cron schedule. Candidate generation, health audit, pull-request verification, Preview dispatch, and production deployment are separate authorities.
