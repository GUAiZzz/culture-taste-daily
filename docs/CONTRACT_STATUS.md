# Production Contract authority

Production Contract V3 is the canonical Culture & Taste production contract upon merge of the activation commit in PR #1 to `main`.

Canonical identity:

- contract: `docs/PRODUCTION_CONTRACT_V3.md`
- approved draft commit: `769c47f16a183f9fd37788070a71cbeab6309b49`
- activation date: `2026-08-24T12:13:54+08:00` (`Asia/Shanghai`)
- activation commit: the commit containing this status record; its immutable SHA is the Git identity merged through PR #1
- activation PR: `GUAiZzz/culture-taste-daily#1`
- approved amendment: `docs/PRODUCTION_CONTRACT_V3_A1.md` (`A1 — final-refresh deadline`), canonical upon merge of its amendment commit
- amendment approval: `2026-08-25T11:43:38+08:00` (`Asia/Shanghai`)
- amendment effect: publication dates on or after `2026-08-26` use a `15:00` Shanghai research-lock deadline; earlier dates retain the historical `08:30` rule
- amendment identity: the immutable commit containing the A1 record
- approved amendment: `docs/PRODUCTION_CONTRACT_V3_A2.md` (`A2 — first-party official image gate`), canonical upon merge of its amendment commit
- amendment approval: `2026-08-25T12:05:44+08:00` (`Asia/Shanghai`)
- amendment effect: every selected story must verify a story-specific image from a first-party official source; official provenance remains separate from usage permission
- amendment identity: the immutable commit containing the A2 record

The Library document `Culture & Taste Daily — Production Prompt v2` is frozen historical V2 and remains authority for pre-V3 production only. The public-repository `PRODUCTION_CONTRACT_V2.md` previously reviewed in `GUAiZzz/GUAiZzz` remains a non-canonical migration adaptation.

Canonical contract activation does **not** authorize implementation, preview hosting, GitHub Pages, production deployment, historical migration, production cutover, workflows, or daily automation. Those stages remain separately gated. QA and manifest results remain reporting only, and the previous good production release must not be mutated without later explicit authorization and the V3 evidence gate.

Upon merge, amendment A1 changes only the final-refresh deadline. It does not expand deployment authority, enable a GitHub Actions schedule, permit unattended publication, or retroactively change the eligibility of an earlier issue.

Upon merge, amendment A2 changes only the story-level official-image and provenance gate. It does not clear image rights, authorize asset copying, dispatch Preview, change Pages, permit deployment, or enable unattended publication.
