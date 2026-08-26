# Production Contract V3 — Decision Log

Status: `ACTIVE CANONICAL SUPPORTING RECORD`

This file records intentional material changes between the frozen canonical historical Library V2 (`Culture & Taste Daily — Production Prompt v2`) and canonical `docs/PRODUCTION_CONTRACT_V3.md`. The old `GUAiZzz/GUAiZzz/docs/PRODUCTION_CONTRACT_V2.md` was consulted as a non-canonical migration adaptation; it does not supply production authority.

The decisions below became active through V3 activation. Their historical `OLD ASSUMPTION` and `NEW DECISION` entries are intentionally preserved rather than rewritten. “Preserved” means the rule's operational meaning remains; wording and repository paths may still change through the canonical amendment process.

## Activation record

- Human approval: exact draft commit `769c47f16a183f9fd37788070a71cbeab6309b49`
- Activation date: `2026-08-24T12:13:54+08:00` (`Asia/Shanghai`)
- Activation commit: the commit containing this activation record; its immutable SHA is the Git identity merged through PR #1
- Pull request: `GUAiZzz/culture-taste-daily#1`
- Result: Production Contract V3 is the canonical Culture & Taste production contract upon merge of the activation commit to `main`
- Boundary: activation does not authorize implementation, Pages, preview, deployment, historical migration, production cutover, or daily automation

## Amendment A1 — Final-refresh deadline

- Human approval: repository owner instruction to move the daily cutoff to `15:00` Shanghai time
- Approval recorded: `2026-08-25T11:43:38+08:00` (`Asia/Shanghai`)
- Effective date: publication dates on or after `2026-08-26`
- Amendment commit: the commit containing this A1 record; its immutable SHA is the amendment identity
- Activation: canonical upon merge of the amendment commit
- Change: the final-refresh and research-lock window becomes `06:00–15:00`
- Historical boundary: publication dates through `2026-08-25` retain the former `06:00–08:30` rule and are not reclassified
- Authority boundary: A1 changes no Preview, Pages, deployment, review, privacy, HarryTone, or unattended-automation gate

## Amendment A2 — First-party official image gate

- Human approval: repository owner instruction that every story use an image from its official information source, by a rights-cleared local copy or a linked official Preview treatment
- Approval recorded: `2026-08-25T12:05:44+08:00` (`Asia/Shanghai`)
- Effective date: publication dates on or after `2026-08-25`
- Amendment commit: the commit containing this A2 record; its immutable SHA is the amendment identity
- Activation: canonical upon merge of the amendment commit
- Change: each selected story must verify at least one story-specific first-party official image; editorial diagrams and third-party media cannot satisfy the gate
- Rights boundary: official provenance is not permission; unknown rights remain production-blocking and allow only the visibly linked non-production Preview treatment
- Authority boundary: A2 changes no Preview dispatch, Pages, deployment, privacy, HarryTone, or unattended-automation gate

## Operational authorization O1 — Continuing daily candidate and weekly health audit

- Human approval: repository owner instruction to make the current editorial and front-end standard repeatable every day and week
- Approval recorded: `2026-08-25` (`Asia/Shanghai`)
- Daily schedule: primary candidate attempt at `09:30`, recovery/final-refresh attempt at `13:30`, both before the canonical `15:00` deadline
- Stable base: `preview-build-v1`, so new dated issues inherit the reviewed publication container without changing it during content generation
- Added checks: live public source pages, first-party official images, official video routes and posters, plus a weekly read-only whole-site health audit
- Failure boundary: any hard failure is `BLOCKED` and preserves the previous good website
- Authority boundary: O1 permits candidate generation, dated pull requests, and read-only health reporting only; it does not permit merge, Preview dispatch, Pages changes, production deployment, or automated editorial/rights approval

## D01 — Canonical authority and activation

**OLD ASSUMPTION**

Library V2 was a production prompt stored outside version control. The migration adaptation could be mistaken for a second V2 authority, and neither defined a repository activation act.

**NEW DECISION**

Library V2 remains frozen canonical historical V2. The migration adaptation is non-canonical. Draft V3 has zero production authority and becomes canonical only through explicit owner approval of an exact commit plus an authorized activation change to V3 status, `docs/CONTRACT_STATUS.md`, and `AGENTS.md` merged to `main`.

**WHY**

File presence, merge, or similar naming must not silently change production rules.

**WHAT IT SOLVES**

Removes dual authority and creates an auditable cutover point.

**TRADEOFF / RISK**

Activation requires a separate explicit act; a merged draft may remain non-canonical.

**MIGRATION IMPACT**

No production behavior changes in this PR. A later approved activation change is required.

## D02 — Dedicated repository boundary

**OLD ASSUMPTION**

Library V2 wrote daily artifacts to a local archive path and did not define repository isolation. The legacy implementation lived inside a personal blog repository and production branch.

**NEW DECISION**

`GUAiZzz/culture-taste-daily` is the only intended source repository. It has no runtime/build/write dependency on `GUAiZzz/GUAiZzz`, and it never edits the legacy `gh-pages` branch.

**WHY**

Publication history, permissions, automation, and failures need a bounded blast radius.

**WHAT IT SOLVES**

Prevents cross-project pollution, branch-order confusion, and accidental damage to the old site.

**TRADEOFF / RISK**

Repository setup, permissions, and migration must be maintained independently.

**MIGRATION IMPACT**

Future code, issues, and release configuration live only in the dedicated repository. A redirect, if any, needs separate approval.

## D03 — Publication-date and future-candidate semantics

**OLD ASSUMPTION**

Library V2 resolved “today” in `Asia/Shanghai`, but did not distinguish issue date, candidate creation, research lock, and content lock or define a next-day preparation window.

**NEW DECISION**

Use separate explicit timestamps. A next-day candidate may be prepared from 18:00 on the prior day but remains preview-only. The publication-day refresh must complete within 06:00–08:30, with a fixed 08:30 research lock. Late refreshes use their actual timestamp; nothing is backdated.

**WHY**

The repository already contains a 2026-08-25 candidate created on 2026-08-24, which exposes the ambiguity. The bounded evening window permits useful preparation; the same-day morning window prevents that draft from becoming stale. The 08:30 lock also preserves the former documented daily schedule as a research cutoff, not as deployment permission.

**WHAT IT SOLVES**

Prevents stale news, premature issue dates, and a future candidate being mistaken for production evidence.

**TRADEOFF / RISK**

The fixed window may need later adjustment as real production duration becomes measurable; changes require contract review.

**MIGRATION IMPACT**

The existing candidate remains non-production review evidence. A later public-schema revision must add candidate/research timestamps before implementation.

## D04 — Source ledger becomes strictly private

**OLD ASSUMPTION**

Library V2 stated that the source ledger was part of `issue-manifest.json`, mixing detailed research evidence with a deliverable artifact.

**NEW DECISION**

Private ledger instances stay outside the public repository and Pages artifact. Public manifests contain publishable provenance only. A structural private-ledger schema may be public, but not an instance.

**WHY**

A public Git repository exposes committed files even when the website does not link them.

**WHAT IT SOLVES**

Protects rejected candidates, sensitive notes, inference, contradictions, rights evidence, and private data.

**TRADEOFF / RISK**

Automation needs a separate durable private store and retention policy before cutover.

**MIGRATION IMPACT**

Manifest generation becomes an explicit promotion step from private evidence to publishable metadata. No private instance is migrated here.

## D05 — Credit and usage rights are separate

**OLD ASSUMPTION**

Library V2 required origin and credit but did not require a distinct, explicit permission basis for every published asset.

**NEW DECISION**

The private ledger records usage-rights basis, evidence, scope, territory, term, attribution, restrictions, and uncertainty separately from credit. Unknown or out-of-scope rights block the asset.

**WHY**

Attribution does not grant copying, packaging, transformation, or publication rights.

**WHAT IT SOLVES**

Closes the largest copyright ambiguity in image-led daily production.

**TRADEOFF / RISK**

Some visually strong stories will become text-led or be omitted; legal edge cases still need qualified review.

**MIGRATION IMPACT**

Future private-ledger schema and asset checks need rights fields. Existing candidate assets are not retroactively approved by this draft.

## D06 — HarryTone remains an independent dependency

**OLD ASSUMPTION**

Library V2 required the canonical `$harry-tone` skill but did not define a public-repository dependency boundary or prevent snapshot drift.

**NEW DECISION**

Canonical `GUAiZzz/harry-tone` governs reasoning, truth, judgment, voice, and anti-AI review; V3 governs publication and delivery. Production pins and verifies the canonical private dependency at runtime and never copies its source publicly. A snapshot is dry-run/audit-only.

**WHY**

The two systems evolve for different purposes and have different privacy boundaries.

**WHAT IT SOLVES**

Prevents a stale public fork, invented missing rules, and visual-system rules drifting into HarryTone.

**TRADEOFF / RISK**

Production blocks when authorized private dependency access is unavailable.

**MIGRATION IMPACT**

Only repository/branch/commit identity is public. Runtime dependency resolution is Stage ④ work after V3 approval.

## D07 — Generator self-report loses deployment authority

**OLD ASSUMPTION**

Library V2 let the producing process validate, score, assign `PASS`, and deliver the result; there was no separate deployment authority because the output was a local package.

**NEW DECISION**

Generator manifest status, QA fields, scores, and self-review are reporting only. The generator may repair candidates but cannot authorize production.

**WHY**

The same process must not create and certify the evidence that grants its own production write.

**WHAT IT SOLVES**

Removes self-certification and makes a false `PASS` harmless to deployment.

**TRADEOFF / RISK**

More evidence interfaces and protected roles are required.

**MIGRATION IMPACT**

Existing manifest fields remain useful as reports but workflows must never branch on them as approval.

## D08 — Technical and editorial evidence split

**OLD ASSUMPTION**

Library V2 combined static checks, render inspection, taste judgment, HarryTone, and editorial truth in one producer-run QA protocol.

**NEW DECISION**

Independent deterministic CI proves measurable technical facts. A separate approved reviewer proves judgment-heavy editorial/visual acceptance for the same immutable digest. Initial production requires named human review.

**WHY**

Screenshot capture can be deterministic; taste, cultural appropriateness, image judgment, and authorship cannot.

**WHAT IT SOLVES**

Stops CI from claiming subjective certainty and keeps review independent from generation.

**TRADEOFF / RISK**

Human review adds latency. Unattended review requires a later explicit architecture/contract decision.

**MIGRATION IMPACT**

Stage ④ must define two evidence formats and bind both to artifact digests. No evidence system is implemented in this PR.

## D09 — GitHub Pages becomes artifact hosting

**OLD ASSUMPTION**

Library V2 delivered local HTML/ZIP artifacts and did not define hosting. The legacy site treated a deployed branch as an editable publication surface.

**NEW DECISION**

GitHub Pages hosts only an immutable, validated static artifact handed to a dedicated deployment job after the evidence gate. Source and deployed output remain separate; direct `gh-pages` editing is forbidden.

**WHY**

Static Pages is sufficient for the magazine while artifact deployment reduces mutation risk.

**WHAT IT SOLVES**

Provides clean source history, reproducible releases, protected deployment, and a smaller failure surface.

**TRADEOFF / RISK**

There is no true server-side streaming or runtime personalization; updates arrive as new static releases.

**MIGRATION IMPACT**

Pages remains disabled in Stage ③. Workflow and environment design begins only after V3 approval and separate authorization.

## D10 — Fail-closed release and rollback

**OLD ASSUMPTION**

Library V2 defined `BLOCKED` delivery behavior but not how a hosted previous-good release survives candidate or deployment failure.

**NEW DECISION**

An unapproved or failed candidate never changes production. Releases record immutable artifact and previous-good identifiers, run with concurrency protection, pass public smoke tests, and roll back by protected redeployment—not branch repair.

**WHY**

Daily automation magnifies race, partial-write, and regression risk.

**WHAT IT SOLVES**

Preserves the last known-good site through research, build, review, deploy, and verification failure.

**TRADEOFF / RISK**

Release bookkeeping and tested rollback add implementation complexity.

**MIGRATION IMPACT**

Stage ④ must design evidence-gate inputs; rollback and deployment remain later stages.

## D11 — Automation and deployment are separate

**OLD ASSUMPTION**

Library V2 described one complete daily run and did not separate scheduled generation from production authority. The legacy task wrote toward production directly.

**NEW DECISION**

Scheduling may generate a non-production candidate, but deployment is a separate protected responsibility. Automation stays disabled until V3, safe private dependencies, three dry runs, a deliberate failure test, rollback test, and a manually accepted production release exist.

**WHY**

A daily clock is not evidence and cannot safely hold production write authority.

**WHAT IT SOLVES**

Prevents a bad daily issue or unavailable source from replacing the good site.

**TRADEOFF / RISK**

Initial daily publication requires human acceptance and may publish late or skip a day.

**MIGRATION IMPACT**

The former direct-publish task remains disabled. No schedule or workflow is added in Stage ③.

## D12 — Web and archival editions split

**OLD ASSUMPTION**

Library V2 required one self-contained HTML and ZIP to serve delivery and archival preservation.

**NEW DECISION**

One locked source produces a web edition optimized for static hosting and an archival edition that preserves self-contained HTML/ZIP/report/previews. Content, hierarchy, links, credits, and visual character must match; packaging and progressive enhancement may differ.

**WHY**

Hundreds of fully embedded web issues would create avoidable Pages weight, while a web-only build weakens preservation.

**WHAT IT SOLVES**

Allows scalable web performance without discarding the original archival promise.

**TRADEOFF / RISK**

Two artifacts require digest linkage and equivalence checks; rights may restrict archival retention or publicity.

**MIGRATION IMPACT**

Stage ④ must define deterministic dual-output interfaces and storage thresholds before implementation.

## D13 — Historical issues are archive objects

**OLD ASSUMPTION**

Library V2 described new issues but not migration of existing HTML/PDF artifacts into a shared site.

**NEW DECISION**

Historical originals remain immutable archive objects. Migration preserves content, composition, typography, images, pacing, links, and interaction intent and never normalizes them into the new issue template.

**WHY**

Their visual character is part of the authored publication, not incidental packaging.

**WHAT IT SOLVES**

Prevents a cleaner new architecture from erasing historical design authorship.

**TRADEOFF / RISK**

Migration is slower and some originals may need documented limitations or versioned reconstruction.

**MIGRATION IMPACT**

Historical artifacts remain untouched until a separately authorized migration stage. The best original source is located before any conversion.

## D14 — Shared core and issue-specific expression

**OLD ASSUMPTION**

Library V2 produced self-contained issues and did not define reusable site infrastructure across hundreds of editions.

**NEW DECISION**

A versioned shared core owns accessibility, navigation, archive generation, responsive primitives, and build interfaces. Each isolated issue owns its content, art direction, scoped style/enhancement, and assets and pins a core version.

**WHY**

The site needs maintainable shared behavior without becoming one visual template.

**WHAT IT SOLVES**

Supports hundreds of issues while limiting cross-issue pollution and preserving daily authorship.

**TRADEOFF / RISK**

Core compatibility and upgrade policy require tests; overreach could flatten issue identity.

**MIGRATION IMPACT**

Stage ④ must keep core APIs narrow and test that a core change cannot silently rewrite historical output.

## D15 — Reference system expands and gains evidence rules

**OLD ASSUMPTION**

Library V2 treated Codrops/Webzibition, Behance, and Mobbin as complementary teachers but did not distinguish specialist/discovery roles or require detail-level evidence.

**NEW DECISION**

Preserve Codrops and Mobbin as core teachers; Behance and AWGE are specialists; SiteInspire and Recent are discovery libraries. References solve a post-lock problem, require detail-level verification when materially used, and separate observation, creator statement, and inference.

**WHY**

Index-page taste and six-source style averaging create derivative, unsupported design decisions.

**WHAT IT SOLVES**

Turns reference research into bounded learning rather than template selection.

**TRADEOFF / RISK**

Some runs will use fewer or no references, and inaccessible projects cannot support strong claims.

**MIGRATION IMPACT**

Private case-card evidence stays outside the public repository. No third-party screenshots are migrated.

## D16 — Seven-issue comparison uses mechanism signatures

**OLD ASSUMPTION**

Library V2 compared eight visual dimensions and discouraged repetition of background, cover, and interaction.

**NEW DECISION**

Preserve the previous-seven window and extend comparison to reference/project, concept, navigation, reading direction, motion, climax, and ending. Repetition remains valid when content requires it and the reason plus two changed dimensions are recorded.

**WHY**

Different colors can conceal repeated mechanics; forced novelty can also weaken a good issue.

**WHAT IT SOLVES**

Detects structural repetition while preserving justified continuity.

**TRADEOFF / RISK**

Mechanism judgment belongs in editorial/visual review, not deterministic CI alone.

**MIGRATION IMPACT**

Future private variation evidence becomes richer; current issue files are unchanged.

## D17 — No-JavaScript reading becomes a deployment red line

**OLD ASSUMPTION**

Library V2 required complete content without JavaScript but treated it among several build and validation requirements.

**NEW DECISION**

Complete no-JavaScript reading is explicitly non-degradable and independently checked before deployment. Client-loaded text, `.txt` reconstruction, and interaction-to-reveal basic content are forbidden.

**WHY**

The legacy archive behavior demonstrated that a visually present shell can hide unavailable publication content.

**WHAT IT SOLVES**

Guarantees durable access, progressive enhancement, and archive readability.

**TRADEOFF / RISK**

Some experimental routing and loading patterns are unavailable.

**MIGRATION IMPACT**

Historical migration and Stage ④ tests must verify served HTML content, not only rendered JavaScript state.

## D18 — Status and deployment are different decisions

**OLD ASSUMPTION**

Library V2 defined `PASS`, `DEGRADED`, and `BLOCKED` primarily for artifact delivery. `PASS` followed a producer score and red-line checklist; `DEGRADED` could cover unavailable rendering.

**NEW DECISION**

Keep exactly the three statuses, but bind them to independently evidenced candidate condition. Deployment is a separate gate decision. A `DEGRADED` candidate deploys only under an approved allowlist and protected human acceptance; missing required render/review evidence remains deployment-blocking.

**WHY**

Hosted production needs stronger authority than a local delivery label.

**WHAT IT SOLVES**

Prevents status text from acting as a production credential while retaining honest degraded delivery.

**TRADEOFF / RISK**

Some truthful readable candidates will remain unpublished when required evidence is unavailable.

**MIGRATION IMPACT**

Current manifest enums can remain reporting fields. Evidence and deployment schemas require later proposals.

## D19 — Artifact identity and public verification

**OLD ASSUMPTION**

Library V2 checked that declared files existed but did not bind source, reviews, deployment, and rollback to one immutable digest.

**NEW DECISION**

Content, web artifact, archival artifact, technical evidence, review evidence, deployment, and rollback records use explicit hashes/identifiers. Post-deploy checks verify the actual public release.

**WHY**

Passing evidence for an older candidate must not approve a changed artifact.

**WHAT IT SOLVES**

Closes time-of-check/time-of-use and stale-review gaps.

**TRADEOFF / RISK**

Any material repair invalidates downstream evidence and increases rerun cost.

**MIGRATION IMPACT**

A later schema revision and Stage ④ evidence interface must add digests; no schema changes occur now.

## D20 — Explicit privacy, secret, and retention boundaries

**OLD ASSUMPTION**

Library V2 did not define public Git history, CI logs, secret stores, or retention because it targeted local artifacts.

**NEW DECISION**

Private material is forbidden from repository, artifact, and public logs. Secrets require least-privilege environment-scoped storage. Private-ledger, evidence, and artifact retention policies must be approved before automation.

**WHY**

Moving production to public GitHub introduces persistent public history and automation credentials.

**WHAT IT SOLVES**

Prevents private research, HarryTone source, permissions, tokens, and user data from becoming public or durable by accident.

**TRADEOFF / RISK**

Private infrastructure and operational policy remain necessary outside this repository.

**MIGRATION IMPACT**

Stage ④ must design redaction/private-file checks. No secret, ledger instance, or private dependency source is migrated.

## Rules intentionally preserved from Library V2

- `Asia/Shanghai` remains the only publication timezone.
- Chinese carries the full argument; English is bounded and cannot introduce facts.
- Truth, source integrity, readable completeness, accessibility, and function outrank visual spectacle and deadlines.
- Research is broad but selection is quality-shaped, deduplicated, and not quota-filled.
- HarryTone must be read from canonical source and cannot be replaced by memory.
- Daily art direction originates in the day's editorial material.
- Progressive enhancement, complete no-JavaScript reading, reduced motion, keyboard access, semantic order, mobile integrity, source visibility, and a quiet ending remain required.
- Documentary, contextual, archival, and generated media remain visibly distinct; generated imagery is never evidence.
- The previous-seven review prevents unconscious repetition without forcing novelty.
- `PASS`, `DEGRADED`, and `BLOCKED` remain the only publication statuses; deadlines never override a red line.
- Declared artifacts and checks must actually exist; delivery claims remain factual.

## Contradictions resolved in this draft

- **Two V2 authorities:** Library V2 is historical canonical; the repository V2 is explicitly only migration input.
- **Ledger inside manifest vs public privacy:** ledger instances are private; public manifest is a promoted publishable subset.
- **One process generates and approves:** generator reporting, deterministic CI, editorial/visual review, and deployment authority are separated.
- **One self-contained file vs scalable Pages site:** one locked source produces linked web and archival editions.
- **Daily schedule vs fail-closed safety:** the schedule can create a candidate but cannot force a release.
- **Credit vs permission:** rights basis is independent and unknown rights reject the asset.
- **Reference inspiration vs evidence:** discovery indexes are not design authority; detail evidence and inference labels are required.
- **Historical migration vs common core:** shared infrastructure cannot normalize historical issue character.
- **Future issue date vs current evidence:** creation, final refresh, research lock, content lock, and publication date are distinct.
- **Manifest `PASS` vs deployment permission:** status reports condition; only the protected evidence gate grants deployment.

## Open implementation questions — not authority contradictions

These choices must be closed before the named later stage, but do not justify inventing infrastructure during contract reconciliation:

1. **Private-ledger store and retention** — choose before automated research or daily automation.
2. **Named editorial/visual approver(s)** — choose before any production evidence gate can pass.
3. **Degradation allowlist** — default is empty; define and approve exact cases before the first `DEGRADED` production release.
4. **Pages environment, public URL, and optional custom domain** — choose before preview/production enablement.
5. **Archival artifact storage and rights visibility** — choose before full artifact retention; a private archive may be required.
6. **Artifact size and retention thresholds** — measure real issues before setting repository/release limits.
7. **Private dependency access method** — choose a least-privilege method for canonical HarryTone before Stage ④ can run in CI.
8. **Legal escalation owner** — name before publishing assets whose basis needs jurisdiction-specific judgment.

Until each is resolved, its dependent stage is `BLOCKED`; no silent default expands authority.
