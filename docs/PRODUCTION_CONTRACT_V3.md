# Culture & Taste Daily — Production Contract V3

> [!WARNING]
> **DRAFT — ZERO PRODUCTION AUTHORITY.** This document does not authorize a build, preview, GitHub Pages deployment, production cutover, historical migration, or daily automation. The Library document `Culture & Taste Daily — Production Prompt v2` remains the frozen canonical historical V2 until V3 is explicitly approved and activated under section 1. Merge or file presence alone does not make V3 canonical.

- Status: `DRAFT`
- Draft branch: `contract-v3-draft`
- Drafted: 2026-08-24, `Asia/Shanghai`
- Intended repository: `GUAiZzz/culture-taste-daily`
- Reconciliation record: `docs/DECISION_LOG.md`

## 1. Authority, versioning, and activation

Current authority order is:

1. the Library document `Culture & Taste Daily — Production Prompt v2` is canonical historical V2;
2. the former-repository `docs/PRODUCTION_CONTRACT_V2.md` is a reviewed, non-canonical migration adaptation;
3. this V3 file is a draft reconciliation with no production authority;
4. canonical HarryTone remains independently authoritative for the surfaces named in section 8.

V3 becomes canonical only when all of the following are true:

- a human repository owner explicitly approves the exact V3 commit as the canonical successor;
- every unresolved question marked `BLOCKING` in `docs/DECISION_LOG.md` is closed;
- the approved commit and approval date are recorded in an authorized activation change;
- that activation change changes this status to `CANONICAL` and updates `docs/CONTRACT_STATUS.md` and `AGENTS.md` consistently;
- the activation change is reviewed and merged to `main`.

Merging the draft without those acts, a manifest saying `PASS`, or a successful check cannot activate V3. After activation, Library V2 remains frozen historical authority for pre-V3 production; it is never overwritten or relabeled.

Future material contract changes require a reviewed pull request, a version or amendment identifier, and an entry in `docs/DECISION_LOG.md`. No prompt, workflow, issue manifest, or automation may silently weaken this contract.

## 2. Instruction priority

When instructions conflict, use this order:

`truth and safety → source and rights integrity → complete readable content → privacy → accessibility and functional access → editorial judgment → issue-level visual authorship → schedule → spectacle`

The stricter rule controls while a material conflict remains open. A deadline, score, visual ambition, or automation cannot override a higher layer. An unresolved material authority conflict is `BLOCKED`.

## 3. Publication identity and audience

Culture & Taste Daily is a daily bilingual digital culture magazine for Chinese-speaking design, brand, product, and culture practitioners. It should feel like an authored independent magazine or zine: Harry's own editorial world, not a PM dashboard, consulting report, trend database, equal-weight news feed, portfolio case study, fixed blog template, or decorative landing page with thin content.

Chinese carries the complete editorial argument. English gives each main story a title, concise deck, and closing abstract that compress the Chinese judgment without adding facts or certainty. Coverage follows `docs/NORTH_STAR.md` and may span fashion, objects, art, design, architecture, exhibitions, retail, music, film, publishing, city scenes, subcultures, beauty, hospitality, and meaningful technology × culture intersections.

## 4. Repository and isolation boundary

`GUAiZzz/culture-taste-daily` is the only intended production source repository. It must remain independent from `GUAiZzz/GUAiZzz`:

- no runtime import, submodule, shared mutable path, workflow dispatch, or build read from the legacy repository;
- no write to the legacy repository or its `gh-pages` branch;
- no issue may import another issue's mutable style, script, or asset path;
- each issue source, build output, and evidence set must be addressable independently at scale.

A future redirect from the old site is a separately approved cutover action, not a dependency. The browser must never fetch private research, HarryTone, or credentials to render the publication.

## 5. Asia/Shanghai date and candidate semantics

`Asia/Shanghai` is authoritative for every production date and timestamp.

- `publication_date` is the calendar date printed on and used to route the issue.
- `candidate_created_at` is the actual timestamp at which a candidate was first materialized.
- `research_locked_at` is the timestamp after the final research refresh completed.
- `content_locked_at` is the timestamp at which the reader-facing source was hashed and frozen.
- All timestamps use ISO 8601 with an explicit `+08:00` offset; they must not be inferred from Git commit time.

Future-dated candidates are allowed only as non-production preparation:

- a normal next-day candidate may first be generated from `18:00` on `publication_date - 1 day`;
- it is labeled preview-only and cannot satisfy production evidence before the publication day;
- a candidate created earlier than that, or for a date beyond the next day, is a planning/dry-run artifact only;
- no future candidate may be deployed early or described as that day's published issue.

On the publication day, a mandatory final refresh must be completed within `06:00–08:30`, with the research window fixed to lock at `08:30`. At that refresh, every selected story's current status, dates, primary evidence, material contradiction, source availability, and image-rights basis are rechecked. Freshness is measured against `research_locked_at`, not `candidate_created_at`.

If the `08:30` lock is missed, use the actual later refresh and lock time; do not backdate it. Publication may be late, but it may not be stale by fiction. A material change after refresh invalidates the affected editorial and content locks and reruns all dependent checks. A material event discovered after deployment belongs in a correction or later issue; it is never silently inserted into an immutable release.

The existing `2026-08-25` candidate was created on 2026-08-24 before this contract and before the normal next-day preparation window. It is review evidence only and cannot prove production readiness, date correctness, or a completed final refresh.

## 6. Research field and freshness

Research follows `docs/CULTURE_TASTE_SOURCE_MAP.md`. Prioritize material published, announced, released, opened, or newly gaining directly observable momentum within the 24–72 hours preceding `research_locked_at`. Older material needs an explicit current trigger, with the older date and current trigger both recorded.

Required regional scans broaden discovery but are not publication quotas. Search snippets, AI summaries, inaccessible previews, homepages, and repeated press-release copies are not read evidence. Source confidence is assigned before editorial weight. Trend, breakout-object, sensitive, harmful, disputed, and commercial-content claims must pass the additional gates in the source map.

## 7. Private source ledger and truth boundary

Every run creates a private source-ledger instance outside the public repository and outside the Pages artifact. It records candidate events, canonical event IDs, exact URLs, source tier and relationship, publication/event/access times, established facts, source-stated rationale, editorial inference, contradictions, access limits, commercial labels, confidence, selection or rejection, and media provenance.

Facts, attributable source statements, and editorial inference remain distinct. A claim cannot exceed accessible evidence. When sources conflict, narrow the claim, show the disagreement, hold it, or omit it. Never invent inaccessible content, reactions, intent, metrics, or context.

The public repository may contain a structural private-ledger schema, but never a ledger instance. Durable private storage and retention must be approved before automation cutover; this contract does not select or authorize a private storage vendor.

## 8. HarryTone dependency and separation

Canonical HarryTone remains the private repository `GUAiZzz/harry-tone`. It governs reasoning, truth boundaries, judgment, speaking position, writing voice, reasoning closure, and the anti-AI audit. Culture & Taste V3 governs the publication/editorial workflow, research system, visual editorial system, references, build, evidence, and deployment gates.

For each run, the authorized environment must resolve and completely read the required canonical HarryTone files at a pinned repository, branch, and commit, and record that identity plus load time. It must not use memory, infer missing rules, or copy private HarryTone source into this public repository or artifact. If canonical HarryTone cannot be accessed or its pinned commit cannot be verified, production is `BLOCKED`. A snapshot may support a disclosed historical audit or dry run only; it cannot satisfy the production dependency.

## 9. Story selection and hierarchy

When evidence supports it, target 8–12 main stories and 3–6 Upcoming Watch items; these are quality-shaped ranges, not quotas. Use one Cover, two or three Majors, five to eight Signals, and concrete dated Watch items only when each level is earned. A smaller issue is correct when fewer stories clear the evidence bar.

Deduplicate by underlying event rather than headline. Select in this order: truth and evidence, cultural consequence, specificity and timeliness, relation to the issue position, category/geographic contribution, then visual potential. Fame, price, virality language, or a strong image cannot rescue weak evidence.

## 10. Chinese and English editorial system

Before drafting, privately lock what the issue can and cannot claim, cover logic, story hierarchy, tension or independent scenes, complication, intended reader movement, and ending consequence.

The Chinese draft should normally complete `concrete anchor → bounded judgment → evidence or relation → consequence, tension, or next development` across each story without forcing identical paragraph shapes. Run the current canonical HarryTone anti-AI audit after structural drafting.

English is not sentence-by-sentence translation. Each Cover, Major, and Signal receives a title, deck, and closing abstract; each Watch item receives a bilingual name, the same concrete date, and a compact English note. English may not introduce a fact, example, confidence level, or causal claim absent from the Chinese source and verified evidence.

## 11. Visual editorial system

The issue's editorial material determines its visual world. Each issue locks one dominant visual action and privately records mood, position, background, palette, typography, image behavior, density and tempo, cover, desktop behavior, mobile translation, usability constraint, and quiet ending.

Classify major decisions as FORM, MOTION, NARRATIVE, or FUNCTION. NARRATIVE and FUNCTION are mandatory; MOTION is optional. A strong static issue is valid. No shared system may impose a fixed hero, card grid, palette, type pairing, section order, or interaction on every issue.

## 12. Reference-system usage

References are teachers, not templates, and are consulted only after the editorial problem is locked:

- Codrops/Webzibition: core teacher for authorship and world-building;
- Mobbin: core teacher for function, usability, and product grammar;
- Behance: specialist for long-form sequence and presentation rhythm;
- AWGE: specialist for cultural attitude, environment, and surprise;
- SiteInspire: discovery library for composition, typography, and image relationships;
- Recent.design: discovery library for current work and freshness.

Do not average these sources or treat them as six equal style inputs. A factual research source does not authorize visual design, and a visual case does not prove a news claim.

## 13. Detail-level reference evidence

Homepage, gallery, ranking, category, and tag pages discover candidates only. If a reference materially affects an issue, reopen at least one relevant detail page, live work, or attributable case study after editorial lock. Inspect at most two new cases deeply by default; use none when no relevant case clears the bar.

Private reference evidence separates discovery metadata, directly observed behavior, creator-stated rationale, and editorial inference. Every accepted reference completes:

`original project problem → transferable principle → today's issue problem → independent expression → prohibited copied surface`

Inaccessible material is marked partial or unavailable; missing intent is never guessed. Private case cards and third-party research screenshots do not enter the public repository or artifact.

## 14. Seven-issue variation review

Before art direction, compare up to the seven most recent valid issues by teacher/project, concept family, cover geometry, entry behavior, reading direction, background, typography, image logic, motion, navigation, interaction, story rhythm, climax, and ending.

Do not repeat the same dominant background, cover composition, or core mechanism by default. Repetition is allowed only when the day's material requires it; record the reason and materially change at least two other dimensions. The purpose is to catch unconscious template reuse, not force novelty.

## 15. Image and media selection

Prefer current, story-specific, traceable visuals. Every visual records origin, story association, documentary/contextual/archival/generated role, credit, alt text, caption need, and private rights basis. A generic, archival, contextual, or generated image must never be presented as documentary evidence for another event.

Generated imagery is permitted only as clearly labeled non-documentary editorial illustration, texture, divider, collage, or transition. It cannot fabricate a person, product, campaign, event, scene, or evidence. If a story lacks a usable image, prefer verified typographic/data-led composition, then clearly labeled contextual material with rights, then a deliberate text-only passage.

## 16. Usage-rights policy

Credit is not permission. Before an asset enters a candidate, the private ledger must separately record:

- asset origin and rights holder when known;
- the explicit usage-rights basis;
- evidence location or permission reference;
- permitted scope, territory, term, and required attribution when applicable;
- restrictions, transformations, expiry, and uncertainty.

Acceptable bases must be specific, such as owned asset, documented license, written permission, or another reviewed legal basis applicable to the actual use. “Found online,” press access, a visible credit, embedding availability, or presumed fair use is not sufficient by itself. Unknown, expired, contradictory, or out-of-scope rights are `BLOCKED` for that asset: do not copy, publish, or package it. When legal judgment is required, obtain qualified review rather than guessing.

## 17. Historical archive behavior

Historical issues are immutable archive objects. Migration preserves, to the extent supported by original evidence, editorial text, source links, cover authority, composition, palette, typography behavior, image behavior, interaction intent, desktop/mobile distinctions, density, and pacing. Do not normalize them into the new shared template.

Use the best original artifact, not a later reconstruction, as migration authority. Search for original source before reconstructing from PDF. If an asset or behavior cannot be restored, document the limit and choose an honest contextual or text-only treatment; never fill the gap with invented content. A migration or correction creates a new version and evidence trail without erasing the original artifact.

## 18. Web edition and archival edition

One locked editorial source may produce two verified representations:

- **Web edition:** optimized local assets, stable issue URL, latest/archive navigation, and static Pages delivery; no remote display-critical dependency and no JavaScript requirement for reading.
- **Archival edition:** self-contained HTML plus ZIP, public manifest, QA report, and required preview captures; designed to open independently and preserve the issue as an archive object.

The two editions may differ only in packaging, optimization, and explicitly documented progressive enhancement. They must preserve the same locked content, hierarchy, source links, credits, visual character, and accessibility. Both outputs record the source hash and artifact digests. Rights scope may require an archival artifact to remain private; that restriction must be recorded rather than silently dropping the artifact.

## 19. Public manifest boundary

The public manifest contains publishable metadata and provenance only: issue identity, publication and lock timestamps, source links intended for readers, public limitations, art-direction metadata, content/core/HarryTone versions, asset credits and public rights labels where appropriate, and generator reporting fields.

It must not contain private ledgers, rejected candidates, internal scores or rationales, unpublished inference, source-health notes, sensitive evidence, permission documents, personal data, secrets, or private review discussion. Manifest `status`, `qa`, and score fields are reporting only. They cannot authorize deployment.

The current public schema is provisional. Before implementation, propose a reviewed schema revision for `candidate_created_at`, `research_locked_at`, artifact digests, and evidence references; do not mutate the schema or existing candidate during this documentation phase.

## 20. Shared core and issue package

The versioned shared core owns semantic reading order, accessibility defaults, archive/source navigation, responsive primitives, public-manifest interfaces, and deterministic build hooks. Each issue package owns editorial content, art direction, scoped style, scoped enhancement, and local assets.

Canonical public issue source lives in an isolated `src/issues/YYYY-MM-DD/` directory containing `content.md`, `art-direction.json`, `issue-manifest.public.json`, and that issue's local publishable assets. Non-production snapshots may live under `candidate/YYYY-MM-DD/`, but that location and its contents never grant release authority.

An issue pins a core version. A core upgrade cannot silently rewrite a previous issue. Issue CSS/JS must be scoped to its root and cannot mutate other issue packages, the archive, or shared global state. Archive order is derived from validated publication dates, never commit order.

## 21. Build requirements

A deterministic build consumes only reviewed public source and pinned dependencies and emits a complete static artifact. It must:

- reproduce the same output bytes for the same declared inputs, excluding explicitly normalized build metadata;
- reject duplicate IDs/dates, directory/date mismatch, content-hash mismatch, unpinned core or HarryTone identity, missing local assets, private-file patterns, and required remote display dependencies;
- render complete story text, Sources & Dates, credits, captions, and navigation in semantic DOM order;
- generate latest, archive, stable date routes, RSS, and sitemap from validated public manifests;
- never rewrite an earlier issue without an explicit migration/correction record.

No browser-side call to a private API, private repository, or research store is allowed.

## 22. Accessibility and progressive enhancement

Use semantic landmarks, a skip link, clear headings, descriptive links, visible focus, keyboard-operable controls, sufficient contrast, meaningful alt text, captions, touch-safe targets, readable line lengths, and a complete `prefers-reduced-motion` path. Essential information must not depend on hover, sound, autoplay, pointer precision, animation, canvas, WebGL, or a custom scroll effect.

Experimental behavior may enhance relation, sequence, or atmosphere only when the static reading path remains coherent. Remove unreliable spectacle before weakening access.

## 23. No-JavaScript reading requirement

With JavaScript disabled or failed, every issue must still expose the full article order, titles, Chinese content, bounded English layer, captions, credits, source links, Sources & Dates, archive navigation, and quiet ending in the served HTML. No text fetch, hidden placeholder, `.txt` reconstruction, client-only route, or interaction-to-reveal requirement may gate basic reading.

A failed no-JavaScript check is non-degradable and `BLOCKED`.

## 24. Mobile translation

Mobile is an intentional vertical magazine, not collapsed desktop stacking. It preserves hierarchy and visual world while simplifying motion, spatial effects, and density. There must be no page-level horizontal overflow, unreadable type, inaccessible control, or essential desktop-only interaction. The basic mobile reading path is non-degradable.

## 25. Generator role and candidate reporting

The generator may research, create the private ledger, select, write, design, build a candidate, inspect it, repair it, and report proposed status, QA, or score. It cannot approve its own editorial/visual evidence, change protected approval records, authorize deployment, or write directly to production.

Candidate reports are evidence inputs, never gate decisions.

## 26. Independent deterministic technical evidence

An execution isolated from the generator's self-report must produce machine-verifiable evidence for:

- schema and content-lock validity;
- deterministic build and artifact digests;
- HTML parsing, language, landmarks, headings, required text, and no-JS reading;
- local asset resolution, media decoding, internal links, archive/RSS/sitemap integrity, and absence of private files;
- automated accessibility checks;
- render capture at desktop `1440 × 900`, mobile `390 × 844`, and a reduced-motion path;
- package contents and declared artifact existence.

External source availability checks run separately and report staleness; a publisher's temporary outage after content lock does not mutate a validated artifact by itself. CI may capture renders and detect measurable failures, but it cannot certify taste, truth, pacing, or authorship.

## 27. Separate editorial and visual review evidence

Review evidence must be produced by an approved reviewer identity or process separate from candidate generation. It records the exact candidate/artifact digest and evaluates source-bounded truth, HarryTone, cultural appropriateness, image judgment and rights disposition, story hierarchy, reference integrity, authorship, pacing, mobile translation, and historical fidelity where applicable.

The initial production policy requires named human approval. Replacing it with an unattended reviewer requires a later explicit contract/ADR approval and demonstrated independence; V3 approval alone does not authorize that change. A review against an older digest is invalid after any material change.

## 28. Status semantics

Use exactly one candidate/publication status:

- `PASS`: all non-degradable rules pass and all mandatory candidate artifacts, independent technical evidence, and separate editorial/visual evidence exist for the same digest.
- `DEGRADED`: truth, rights, complete no-JS reading, core mobile access, and required safety evidence pass, but an explicitly allowed non-critical capability is unavailable or removed and the limitation is recorded.
- `BLOCKED`: a non-degradable rule fails, required evidence/approval is missing, a dependency or rights basis is unresolved, content cannot be supported, or a contradiction remains material.

`DEGRADED` is not a shortcut to deployment. It may pass the deployment gate only when the approved degradation allowlist covers the exact limitation and a protected human approver accepts it. Missing final research refresh, canonical HarryTone, content integrity, rights basis, no-JS reading, basic mobile reading, independent CI, editorial/visual review, or artifact identity is never degradable.

Repair or changes-requested is workflow state, not a fourth publication status. A score cannot compensate for a red line.

## 29. Deployment evidence gate

Deployment authority belongs only to a protected evidence gate. For one immutable artifact digest, it must verify:

- the canonical contract/version and source commit;
- final research and content locks for the publication date;
- pinned core and verified canonical HarryTone identity;
- complete independent technical evidence;
- current editorial/visual review evidence;
- asset-rights clearance and private-data absence;
- allowed status and any explicit degradation approval;
- protected production approval, concurrency lock, and known previous-good release.

Only the gate may hand the immutable artifact to a dedicated Pages deployment job. The gate must derive its decision from protected evidence, not trust public manifest fields or generator output.

## 30. Fail-closed deployment, rollback, and post-deploy verification

GitHub Pages is validated static artifact hosting, not the source of truth and not an editable production workspace. A failed, stale, incomplete, or unapproved candidate leaves the previous valid public release unchanged. Overlapping runs are serialized or cancelled before deployment; no partial artifact may become public.

Every successful gate records source commit, artifact digest, Pages deployment/release identifier, previous-good identifier, approval evidence, and time. Post-deploy checks must verify the public homepage, issue and archive routes, local assets, source links, desktop/mobile basic reading, no-JS reading, and deployed digest. Until those checks pass, the release is provisional.

If verification fails, stop new releases and redeploy the recorded previous-good immutable artifact through the same protected mechanism. Do not repair production by editing `gh-pages`. If rollback fails, declare an incident `BLOCKED`, keep automation disabled, and require human recovery.

## 31. Daily automation enable and disable conditions

Daily automation remains disabled until all of these are explicitly verified:

- V3 is canonical under section 1;
- the dedicated build, evidence gate, preview, production, post-deploy, and rollback paths exist without legacy-repository coupling;
- canonical HarryTone and private-ledger storage can be resolved safely at runtime;
- private/public separation and secret handling are tested;
- independent CI and named editorial/visual approval are protected from generator writes;
- at least three consecutive end-to-end dry runs pass without production writes;
- a deliberately failed candidate proves the previous release remains unchanged;
- rollback to a known-good artifact is tested;
- production is first deployed and accepted manually.

Generation scheduling and deployment remain separate. Any failed dependency, refresh, lock, build, evidence, approval, deployment, or smoke test disables that run's deployment without changing the current site. Repeated systemic failure, credential exposure, rights uncertainty, or rollback failure pauses the schedule until explicit human re-enable. The clock never converts `BLOCKED` into `PASS`.

## 32. Privacy, secrets, and retention

Never commit or package private ledger instances, research notes, rejected-candidate notes, private case cards, permission evidence, credentials, tokens, cookies, keys, `.env` files, browser data, private HarryTone source, or unnecessary personal data. Public logs must redact protected values and must not serialize private inputs.

Secrets live only in an approved secret store with least-privilege, environment-scoped access and rotation. Artifact retention, private-ledger retention, reviewer evidence retention, and deletion rules must be approved before automation; public Git history is not private storage.

## 33. Required artifacts and evidence

A full production candidate requires, for one locked source and digest family:

- public issue source: `content.md`, `art-direction.json`, and public manifest;
- built web edition with local display-critical assets;
- archival self-contained HTML and ZIP, subject to recorded rights scope;
- public QA report and desktop, mobile, and reduced-motion captures;
- independent technical evidence with build/artifact digests;
- separate editorial/visual review evidence;
- private source-ledger and rights evidence outside the public repository;
- deployment attestation and post-deploy report only if a release is authorized.

Every declared path and digest must resolve before it is reported. Missing mandatory production evidence is `BLOCKED`; a candidate may still be retained honestly as non-production review material.

## 34. Evolution, explicit non-goals, and next-stage boundary

The source map, reference system, visual grammar, and thresholds may evolve through reviewed evidence. A proposal must state the current assumption, replacement, benefit, tradeoff, migration cost, and impact on HarryTone, authorship, accessibility, archive integrity, privacy, and deployment safety. No reference source becomes permanent aesthetic doctrine.

V3 does not require one visual template, motion, WebGL, a fixed issue length, a story/category/geography quota, or copying Vogue or any reference site. It does not authorize a real-time streaming service, server runtime, client-side private API, third-party asset archive, private data in Git, automatic truth judgment by CI, generator self-approval, silent historical normalization, direct `gh-pages` edits, or production changes from this draft.

After explicit V3 activation, the next authorized stage is limited to Stage ④: design and implement the source build, deterministic QA, review-evidence interface, and deployment evidence gate in non-production. Pages enablement, preview publication, historical migration, production deployment, and daily automation each still require their later explicit authorization.
