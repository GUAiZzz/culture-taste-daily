# Production status

Status: `NOT DEPLOYED`

Current stage: `④A Build / QA foundation — local, non-production`

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
- desktop, mobile, no-JavaScript, and reduced-motion evidence renders.

Still not implemented or authorized:

- CI or any GitHub Actions workflow;
- preview environment;
- production deployment or GitHub Pages;
- historical migration;
- daily automation;
- automatic editorial, visual, HarryTone, truth, cultural, or rights approval.

The `2026-08-25` source is a non-production technical sample. It cannot satisfy V3 date semantics and must remain blocked by the evidence gate.

No live URL is owned by this repository. Build output, manifest `PASS`, technical QA `PASS`, and a local gate result do not themselves authorize production deployment.
