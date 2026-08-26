# Daily automation boundary

Status: `DAILY CANDIDATE DRY RUN AUTHORIZED / PRODUCTION AUTOMATION DISABLED`

The continuing automation is intentionally bounded:

- one Codex task runs every day at `09:30` in `Asia/Shanghai`, inside the approved `06:00–15:00` window; a manual same-day recovery may refresh the same branch before `15:00`;
- it may research, create or repair today's isolated public issue, run deterministic QA, and open or update one dated pull request;
- the stable content base is `preview-build-v1`, so future issues inherit the current homepage, themes, story routes, typography, and interaction container;
- pull requests targeting that base receive the same independent Preview build and QA checks, without a deployment job;
- every daily candidate runs strict live checks for its public source pages, official images, video routes, and posters;
- one weekly read-only health task rechecks all published Preview issues, the live shell, automation drift, and link/media availability;
- it may not merge, dispatch Pages, deploy Preview, deploy production, modify `main`, modify `gh-pages`, or touch `GUAiZzz/GUAiZzz`;
- any missing dependency, stale research, unsupported claim, uncertain image right, privacy failure, build failure, QA failure, or missing human review returns `BLOCKED` and preserves the current website.

The machine-readable daily boundary is `automation/daily-policy.json`. The full daily operating sequence is `automation/DAILY_RUN.md`. Weekly health is defined by `automation/weekly-health-policy.json` and `automation/WEEKLY_HEALTH.md`. `npm run daily:preflight` verifies the date/window, current base, canonical public dependency identities, and no-deploy policy before a run begins.

This daily dry run is intended to collect the three consecutive end-to-end proofs required by Production Contract V3. It does not satisfy or bypass the remaining requirements for unattended production automation: protected named review, approved private-ledger retention, manual production acceptance, deliberate failure proof, rollback proof, and post-deploy verification.
