# Preview autonomy — owner-authorized operating amendment

Approved in the owner task on 2026-09-05; scheduled behavior effective from 2026-09-06.
This operational amendment supersedes previous statements that every non-production Preview requires a new daily human publish instruction. Production Contract V3 and A1/A2 are preserved byte-for-byte. Production remains unimplemented and manually controlled.

A complete daily candidate may automatically merge to `preview-build-v1` and dispatch the existing Preview workflow, only through `scripts/preview-release.mjs`. No production, Pages-setting, default-branch, historical-original, private-HarryTone, or other-repository authority is granted.

## Machine decision

`COLLECTING → PACKAGE_COMPLETE → TECHNICALLY_VERIFIED → PREVIEW_ELIGIBLE → PREVIEW_MERGED → PREVIEW_DISPATCHED → PREVIEW_DEPLOYED`.
`STOPPED`, `MISSING_DAY`, `PR_OPEN`, and `PREVIEW_IN_PROGRESS` are operation states. Public manifest PASS/BLOCKED remains production reporting; it does not authorize Preview.

| Condition | Automatic Preview | Production |
|---|---|---|
| Complete research + pinned technical evidence + unknown externally linked rights | Yes, visible Preview-only, official origin link and fallback required | Blocked |
| Source health REVIEW_REQUIRED, exact page read in connected browser today | Yes, record dated private verification | Pending separate review |
| Official media temporarily unavailable, verified provenance and working fallback | Yes, report limitation; never call availability PASS | Blocked for unresolved asset |
| Official media was never verified | No | No |
| Incomplete research, wrong repo/base/head, nondeterministic build, failed QA/privacy | No; cannot be overridden | No |
| GitHub transient network error | Three attempts; then stop with exact transport reason | No |
| Missing named editorial/visual approval | Permitted for review infrastructure after full editorial checks | Blocked |
| Research lock after 15:00, same day before 18:00 | Honest late Preview, keep actual timestamps | Window blocker retained |

The evaluator checks date, explicit authority, scope, exact source/base SHA, artifact and candidate digests, policy digest, evidence freshness, a complete research-check list, the hash of an existing private evidence file, official-source/media records, independent CI, local deterministic rebuild, technical QA, and privacy. Evidence completeness is not a proof of truth: the agent must actually read the source and private dependency. Model scores are not accepted. Passing this evaluator never grants Production authority.

## Evidence input (private, outside Git)

The CLI accepts `--evidence /absolute/private/run.json --private-evidence /absolute/private/research.json`. The research file is the original run evidence; it is not an empty placeholder. Keep all browsing/rejected-source/rights/HarryTone records outside the repository.

The attestation uses `schema_version: 1`, `kind: preview_run_attestation`, `target_date`, `checked_at` (real timestamp), `source_commit`, `base_commit`, `candidate_digest`, `artifact_digest`, `policy_digest` (from exported `policyDigest`), and:

- `research.complete`, `research.private_evidence_sha256`, `research.harrytone_commit`, `research.checks` containing every exported `RESEARCH_CHECKS`, `research.within_production_window`;
- `health.source_pages[]`: exact `url`, `status` PASS or REVIEW_REQUIRED, plus same-day `browser_verified_at` for restricted pages;
- `health.media[]`: exact `url`, same-day `provenance_verified_at`, `linked_origin: true`, `fallback_verified: true`, status PASS or TEMPORARILY_UNAVAILABLE, and `production_rights` unknown or cleared.

Timestamps must be honest and use +08:00. Every actual public source/media URL must have its matching record. A PASS health record must come from the source-health tool's actual response, not a guessed result. Browser confirmations are retained privately. The script verifies presence and binding; it does not read or certify the meaning of the private ledger.

## Release and recovery

1. Run `npm run ops:preflight -- --daily --online` on the clean dated branch, after fetching the exact base. The public allowlist is today's `src/issues/YYYY-MM-DD/` plus exactly `src/site/assets/covers/YYYY-MM-DD.svg`. The latter is required by the current build and is not permission to edit the publication shell.
2. Run full native verification, health/browser review, and secret scanning. Commit/push only allowed public files; create/update the unique PR. Wait for Preview CI at this exact head.
3. Run `npm run preview:release -- --evidence … --private-evidence …` for a non-mutating gate report; when eligible, run the same command with `--execute`. Runtime facts are re-read before mutation; head-pinned merge and base recheck prevent routine stale-candidate release.
4. Dispatch uses `expected_sha` and is accepted only on the Preview base. PR CI has a separate cancellation group; deployment is serialized and not cancelled by new PRs. The artifact receives `preview-release.json`; live checks compare the actual HTML hash for homepage, archive, issue and every current story.
5. If interrupted after merge/dispatch, `npm run ops:state -- --online` finds the existing PR. `npm run preview:resume -- --date YYYY-MM-DD` requires the original eligible receipt bound to the merged PR head and current policy, then checks existing dispatch; `--execute` dispatches only when absent or retries the same failed run at most three attempts. A running run is never duplicated. Repeat state/live verification to reach a terminal result.
6. A stale local release lock must be inspected against its PID and GitHub operation before removal. Never automatically expire a lock while a release may still be active. All task entries use one saved checkout; per-task temporary worktrees must not run competing release helpers.

No endpoint is declared successful from an HTTP dispatch response. On post-deploy failure stop further publication and retain the exact receipt. Rollback uses a reviewed revert to the last-known-good source followed by the same workflow, or retained Pages artifact with explicit operator control. Automatic rollback has not yet been proven and is not enabled. No direct gh-pages changes or history rewrite.

## Single schedule and receipts

`automation/daily-policy.json` is the authority for 11:00 primary, 13:00/15:00/17:00 bounded recovery, and 18:00 final reconciliation, Asia/Shanghai. Production research deadline stays 15:00. The external task is a projection; verify with `npm run ops:check -- --automation-file <actual automation.toml>`. Weekly health reads this policy rather than repeating times.

At 18:00 finish existing deployment verification; do not start new research. Missing work becomes MISSING_DAY and one actionable notification. At earlier checkpoints, resume only missing/incomplete current-day work, never manufacture a new date or duplicate PR. No GitHub schedule is introduced.

Local scheduled tasks need the computer on and app running. Multiple local recovery points reduce missed runs but cannot detect a completely offline machine. An independent always-on monitor remains a future infrastructure decision, not an implemented uptime guarantee.

Final local receipt is `.stage4/operations/YYYY-MM-DD.json`; live verification is `.stage4/operations/live.json`. At completion append a small final operational entry to the task's own memory with date, commit, PR, merge SHA, run ID, live result and unresolved state. Never include research or secrets. GitHub + live hashes outrank old memory. The global Codex memory registry is not the automation state store.
