# Source architecture

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

The daily candidate task operates before the public-source layer. It starts from an ephemeral private workspace, uses `preview-build-v1` as the stable current publication container, may promote only publishable issue source to a dated branch, and follows the machine-gated Preview state machine in PREVIEW_AUTONOMY.md. The policy owns 11:00 start, 13:00/15:00/17:00 recovery and 18:00 closure. Production retains its original window and review requirements.

A separate weekly read-only task checks automation drift, deterministic QA, live publication routes, and all public source/media links. It writes no repository state and has no pull-request or deployment authority.

## Public issue source

Each issue source directory may contain:

- `content.md` — locked reader-facing content;
- `art-direction.json` — issue-specific visual decisions;
- `issue-manifest.public.json` — publishable metadata and reporting fields.

Private research and private source-ledger instances never enter `src/`.

## Shared core versus issue expression

`core/` owns accessibility, archive navigation, source rendering, responsive primitives, and deterministic output rules. It must not flatten every issue into the same visual template.

Issue-specific art direction may control composition, palette, rhythm, typography, imagery, and content-driven interaction while preserving the shared accessibility and no-JavaScript contract.

The publication homepage/archive uses `core/styles/site.css`, which is never loaded into an issue page. Current issues use scoped `issue.css`; preserved historical originals keep their supplied visual systems.

## Historical Preview objects

`src/historical/<date>/` stores only the three explicitly supplied historical originals, public migration metadata, and required facsimile assets. Exact original hashes are verified during build. These objects are Preview-only until rights, accessibility, and historical-fidelity review is complete.

## Candidate snapshots

`candidate/2026-08-25/` preserves the locally accepted static candidate and public QA evidence. It is not `dist/`, a release artifact, or a deployable branch.

## Deployment invariant

The current workflow may deploy only an exact-SHA, visibly labeled Preview authorized by the owner or the daily Preview gate after deterministic checks pass. Production remains unimplemented. Any later production deployment must use a distinct protected evidence gate and leave the previous good release untouched on failure.

`automation/daily-policy.json` and `automation/DAILY_RUN.md` define the externally scheduled candidate boundary. `automation/weekly-health-policy.json` and `automation/WEEKLY_HEALTH.md` define the weekly read-only audit. GitHub Actions still has no cron schedule. Candidate generation, health audit, pull-request verification, Preview dispatch, and production deployment are separate authorities.
