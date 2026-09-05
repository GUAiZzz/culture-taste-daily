# Production status

Status: `PREVIEW DEPLOYED / PRODUCTION NOT DEPLOYED`

Current stage: `Preview Build — real site, non-production`

Preview endpoint: <https://guaizzz.github.io/culture-taste-daily/>

Canonical authority:

- Production Contract V3 is canonical at repository commit `83982d543bb845819b3412cd5b10b273ec3fcf25`.
- Library V2 remains frozen historical authority for pre-V3 production.

Implemented in this stage:

- deterministic static build;
- public issue-manifest schema v2;
- independent technical evidence;
- named human editorial/visual review interface;
- local non-production evidence gate;
- fail-closed regression and negative-path tests;
- desktop, mobile, no-JavaScript, and reduced-motion evidence renders;
- designed homepage and interactive-enhanced archive with full no-JavaScript fallback;
- preview-only historical preservation for 2026-08-20, 2026-08-21, and 2026-08-22;
- pull-request CI and manually triggered GitHub Pages Preview workflow.
- continuing daily Codex candidate policy at `11:00` Shanghai time, with recovery and final closure projected from automation/daily-policy.json;
- strict public source and official-media availability checks for daily candidates;
- a weekly read-only whole-site health audit;
- daily Preview authority is separately gated; weekly health remains read-only.

Still not implemented or authorized:

- production deployment or production use of GitHub Pages;
- production acceptance of historical migrations;
- unattended production automation;
- automatic editorial, visual, HarryTone, truth, cultural, or rights approval.

The historical `2026-08-25` package remains non-production. It remains blocked by missing candidate timing, out-of-window research, and unresolved reuse rights for eight externally linked first-party official images. The image origins are verified for Preview provenance; that verification does not clear production usage rights.

The GitHub Pages endpoint created by the Preview workflow is review infrastructure, not a production release. Build output, manifest `PASS`, technical QA `PASS`, a Preview URL, and a local gate result do not themselves authorize production deployment.

The daily candidate task is separate from GitHub Actions and from deployment. It may create or update a dated branch and pull request after research and QA. A failing Preview gate records its specific reason and leaves the site unchanged. Eligible packages continue through merge, dispatch and live verification. Manual production acceptance, private-ledger retention, protected review, deliberate failure proof, rollback proof, and production deployment remain outstanding.

## Current operational authority

Use `npm run ops:state -- --online` to reconcile source, GitHub and live state. The owner-approved [Preview amendment](PREVIEW_AUTONOMY.md) supersedes earlier candidate-only operational descriptions. Policy defines 11:00 start, 13:00/15:00/17:00 recovery and 18:00 final reconciliation in Shanghai. Complete current-day packages may automatically merge and dispatch Preview only after `preview:release` passes. No Production authority is granted. Scheduler availability and next-day unattended execution must be verified independently of local tests.
