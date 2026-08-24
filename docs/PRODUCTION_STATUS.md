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
- daily Codex candidate dry-run policy, preflight, and regression tests; the run has no merge or deployment authority.

Still not implemented or authorized:

- production deployment or production use of GitHub Pages;
- production acceptance of historical migrations;
- unattended production automation;
- automatic editorial, visual, HarryTone, truth, cultural, or rights approval.

The `2026-08-24` source is the current non-production Preview issue. Its research refresh happened after the V3 same-day window, so it remains blocked by the evidence gate. The `2026-08-25` source is retained as a `future_draft`, excluded from the normal latest/archive feed, and also remains blocked by missing candidate timing and out-of-window research.

The GitHub Pages endpoint created by the Preview workflow is review infrastructure, not a production release. Build output, manifest `PASS`, technical QA `PASS`, a Preview URL, and a local gate result do not themselves authorize production deployment.

The daily candidate task is separate from GitHub Actions and from deployment. It may create or update a dated branch and pull request after research and QA. A failed or incomplete run returns `BLOCKED` and leaves the current Preview unchanged. Manual production acceptance, private-ledger retention, protected review, deliberate failure proof, rollback proof, and production deployment remain outstanding.
