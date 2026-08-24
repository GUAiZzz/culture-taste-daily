# Daily automation boundary

Status: `DAILY CANDIDATE DRY RUN AUTHORIZED / PRODUCTION AUTOMATION DISABLED`

The first automation version is intentionally narrow:

- one Codex task starts daily at `06:15` in `Asia/Shanghai`;
- it may research, create or repair today's isolated public issue, run deterministic QA, and open or update one dated pull request;
- pull requests targeting the dry-run base receive the same independent Preview build and QA checks, without a deployment job;
- it may not merge, dispatch Pages, deploy Preview, deploy production, modify `main`, modify `gh-pages`, or touch `GUAiZzz/GUAiZzz`;
- any missing dependency, stale research, unsupported claim, uncertain image right, privacy failure, build failure, QA failure, or missing human review returns `BLOCKED` and preserves the current website.

The machine-readable boundary is `automation/daily-policy.json`. The full operating sequence is `automation/DAILY_RUN.md`. `npm run daily:preflight` verifies the date/window, canonical public dependency identities, and no-deploy policy before a run begins.

This daily dry run is intended to collect the three consecutive end-to-end proofs required by Production Contract V3. It does not satisfy or bypass the remaining requirements for unattended production automation: protected named review, approved private-ledger retention, manual production acceptance, deliberate failure proof, rollback proof, and post-deploy verification.
