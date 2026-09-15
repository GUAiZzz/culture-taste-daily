# Culture & Taste Daily weekly health audit

Status: `AUTHORIZED READ-ONLY AUDIT / NO REPOSITORY OR DEPLOYMENT AUTHORITY`

Run every Sunday at `16:30` in `Asia/Shanghai`. This audit verifies that the continuing daily system and the public non-production Preview remain healthy. It never edits content, commits, opens or merges a pull request, dispatches Preview, changes Pages, or deploys production.

## Base and automation drift

1. Use the configured Culture & Taste repository and read `AGENTS.md` plus its mandatory files.
2. Fetch and inspect `preview-build-v1` without modifying it.
3. Confirm the daily candidate automation is active, uses the same repository, targets `preview-build-v1`, matches every checkpoint in `automation/daily-policy.json`, and uses the guarded Preview-only release helper. Run `npm run ops:check -- --automation-file <actual config>`; Production authority must remain false.
4. Confirm `.github/workflows/preview.yml` has no schedule or push trigger and deploys only after an explicit manual dispatch.

Any drift is `BLOCKED` and must be reported exactly. Do not repair it during the audit.

## Repository and live checks

Run from a clean temporary worktree of `preview-build-v1`:

```text
npm ci
npm run verify
npm run health:weekly
npm audit --audit-level=high
git diff --check
```

Then inspect the public Preview homepage, archive, latest issue, every latest story route, and at least one historical issue in desktop and 390px mobile view. Verify:

- no broken internal route or page-level horizontal overflow;
- complete reading without JavaScript and a stable reduced-motion path;
- three theme controls, homepage randomization before manual selection, and session inheritance after selection;
- official-image cards load or expose the designed local fallback plus an exact official-source link;
- no private material, credentials, research notes, or HarryTone source appear in the repository or public artifact;
- current external source and image failures are separated from image-rights clearance.

## Result

Report `PASS` only when every required check succeeds. A source-health `REVIEW_REQUIRED` result must be checked in the connected interactive browser and listed with the final result; it cannot be silently treated as a pass. The report must name the inspected base commit, artifact digest, latest issue, live endpoint, target count, and any transient retries.

On failure, report `BLOCKED` with the exact route, URL, image, automation drift, or check that failed. Preserve the existing website and leave all repositories, branches, pull requests, workflows, and deployments unchanged.
