# Production status

Status: `NOT DEPLOYED`

Current stage: `Preview Build — real site, non-production`

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

Still not implemented or authorized:

- production deployment or production use of GitHub Pages;
- production acceptance of historical migrations;
- daily automation;
- automatic editorial, visual, HarryTone, truth, cultural, or rights approval.

The `2026-08-25` source is a non-production technical sample. It cannot satisfy V3 date semantics and must remain blocked by the evidence gate.

The GitHub Pages endpoint created by the Preview workflow is review infrastructure, not a production release. Build output, manifest `PASS`, technical QA `PASS`, a Preview URL, and a local gate result do not themselves authorize production deployment.
