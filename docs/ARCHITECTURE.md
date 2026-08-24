# Source architecture

## Boundary

`GUAiZzz/culture-taste-daily` is the future source of truth for Culture & Taste Daily code, public issue source, candidate artifacts, and—only after later approval—its build and deployment configuration.

It has no runtime, workflow, Pages, or content dependency on `GUAiZzz/GUAiZzz`.

## Layers

```text
private research workspace (outside repository)
        ↓ selected publishable facts only
src/issues/<date>/
        ↓ future deterministic build
candidate/<date>/
        ↓ future independent CI evidence gate
preview
        ↓ explicit human approval
production release
```

Only the first two repository layers exist today. The arrows after `candidate/` describe future stages, not active infrastructure.

## Public issue source

Each issue source directory may contain:

- `content.md` — locked reader-facing content;
- `art-direction.json` — issue-specific visual decisions;
- `issue-manifest.public.json` — publishable metadata and reporting fields.

Private research and private source-ledger instances never enter `src/`.

## Shared core versus issue expression

Future `core/` code may own accessibility, archive navigation, source rendering, responsive primitives, and deterministic output rules. It must not flatten every issue into the same visual template.

Issue-specific art direction may control composition, palette, rhythm, typography, imagery, and content-driven interaction while preserving the shared accessibility and no-JavaScript contract.

## Candidate snapshots

`candidate/2026-08-25/` preserves the locally accepted static candidate and public QA evidence. It is not `dist/`, a release artifact, or a deployable branch.

## Future deployment invariant

When deployment is later implemented, it must publish a new immutable artifact only after independent deterministic evidence and explicit approval. Failure at any step must leave the previous good production release untouched.
