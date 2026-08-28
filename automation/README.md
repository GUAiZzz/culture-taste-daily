# Daily automation boundary

Status: `DAILY CANDIDATE AUTHORIZED / HUMAN PREVIEW OVERRIDE ENABLED / PRODUCTION DISABLED`

The continuing automation is intentionally bounded:

- one Codex task runs every day at `11:00` in `Asia/Shanghai`; no automatic recovery run is created or expected;
- it may research, create or repair today's isolated public issue, run deterministic QA, and open or update one dated pull request;
- the stable content base is `preview-build-v1`, so future issues inherit the current homepage, themes, story routes, typography, and interaction container;
- pull requests targeting that base receive the same independent Preview build and QA checks, without a deployment job;
- every daily candidate runs strict live checks for its public source pages, official images, video routes, and posters;
- one weekly read-only health task rechecks all published Preview issues, the live shell, automation drift, and link/media availability;
- the unattended run may not merge or dispatch Preview; from `2026-08-29`, a later explicit owner instruction after completed research may merge the single dated PR and dispatch only the existing non-production Preview workflow;
- the human Preview override keeps `BLOCKED`, rights, source-access, and review disclosures intact and never authorizes production, direct `main`/`gh-pages` edits, Pages-setting changes, or the legacy repository;
- any missing dependency, stale research, unsupported claim, uncertain image right, privacy failure, build failure, QA failure, or missing human review returns `BLOCKED` and preserves the current website.

The machine-readable daily boundary is `automation/daily-policy.json`. The full daily operating sequence is `automation/DAILY_RUN.md`. Weekly health is defined by `automation/weekly-health-policy.json` and `automation/WEEKLY_HEALTH.md`. `npm run daily:preflight` verifies the date/window, current base, canonical public dependency identities, unattended no-deploy policy, and bounded human Preview override before a run begins.

This daily dry run is intended to collect the three consecutive end-to-end proofs required by Production Contract V3. It does not satisfy or bypass the remaining requirements for unattended production automation: protected named review, approved private-ledger retention, manual production acceptance, deliberate failure proof, rollback proof, and post-deploy verification.
