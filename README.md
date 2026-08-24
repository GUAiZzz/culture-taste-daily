# Culture & Taste Daily

An independent source repository for Culture & Taste Daily.

Repository stage: **② Source Architecture**

This repository is intentionally isolated from `GUAiZzz/GUAiZzz`. It currently contains the approved local candidate for `2026-08-25`, its public source files, public QA evidence, and the minimum documentation needed to prepare later build and deployment work.

## Current authority

Allowed now:

- maintain source content and public issue metadata;
- review the `2026-08-25` candidate;
- design the future shared core, deterministic QA, and deployment evidence gate.

Not enabled now:

- GitHub Pages;
- production deployment;
- preview deployment;
- daily automation;
- any workflow under `.github/workflows/`;
- Production Contract V3 as canonical authority.

Manifest and QA `PASS` fields are reporting only. They cannot authorize deployment.

## Repository map

```text
src/issues/          Canonical public issue source for this repository
candidate/           Accepted local candidate snapshots; not production releases
core/                Reserved boundary for the future shared renderer
schemas/             Public-data schemas only
scripts/             Reserved boundary for future deterministic build tooling
tests/               Required QA contract before pipeline implementation
deployment/          Disabled deployment boundary and future evidence-gate notes
automation/          Disabled daily-automation boundary
dependencies/        External dependency references, never copied private source
docs/                Product, editorial, architecture, and boundary decisions
```

## Candidate

The current candidate is at [`candidate/2026-08-25/index.html`](candidate/2026-08-25/index.html). It is a local review artifact and has never been deployed.

## Private-data rule

Private research, source-ledger instances, credentials, tokens, and canonical HarryTone source must remain outside this repository. See [`docs/DATA_BOUNDARIES.md`](docs/DATA_BOUNDARIES.md).
