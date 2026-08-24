# Culture & Taste Daily — Reference System

Status: documentation baseline for reference selection and future V3 input

Research basis: `docs/REFERENCE_AUDIT_2026-08-23.md`

Production authority: none; this document does not replace Library V2 or authorize Production Contract V3

## Objective

Use external references to improve judgment without turning Culture & Taste Daily into a template-driven design gallery.

The publication should feel like Harry's own Vogue: a recognizable editorial standard capable of producing different issue worlds. It should not feel like six websites averaged together, a Behance case study, or a technical demo proving how much the system can build.

## Priority

When inputs conflict, follow this order:

1. source truth, rights, and cultural appropriateness;
2. today's editorial position and story hierarchy;
3. complete readable content and reader access;
4. issue-level authorship and image judgment;
5. reference-derived techniques;
6. spectacle.

A reference never overrides a higher layer.

## Reference roles

| Role | Sources | Job | Not allowed to decide |
|---|---|---|---|
| Editorial authority | Today's verified material, HarryTone, North Star | Position, truth boundary, story hierarchy, reader consequence | It may not fabricate missing evidence or culture |
| Core teacher: authorship | Codrops/Webzibition | Concept concentration, digital time, mechanism, restraint | The issue's subject or visual skin |
| Core teacher: function | Mobbin | Reader path, states, controls, accessibility, interaction clarity | The magazine aesthetic or conversion goal |
| Specialist: sequence | Behance | Long-form viewing arc, escalation, pause, release | Product validity or editorial truth |
| Specialist: attitude | AWGE | Cultural environment, identity, surprise, deliberate roughness | A ready-made underground style |
| Inspiration library: composition | SiteInspire | Typography, grid, image relationships, subject/style precedents | Art direction from a screenshot |
| Inspiration library: freshness | Recent | Current cross-category discovery | Quality, relevance, or authority from recency |

## Daily selection protocol

### 1. Lock editorial material first

Before opening a reference source, record privately:

- what the issue can responsibly claim today;
- cover story and why it carries the issue;
- the issue's editorial tension or set of independent scenes;
- intended reader movement from entry to ending;
- which visual/material properties already exist in the stories;
- what design problem remains unsolved.

If the unresolved prompt is only “make it look more interesting,” do not browse references. Sharpen the editorial problem first.

### 2. Query by relationship, not look

Good query:

> How can an archive allow wandering while keeping a stable reading structure?

Weak query:

> Find a cool black editorial website.

The reference search must name a relationship, function, or tension that today's issue actually has.

### 3. Discover candidates, then verify detail evidence

Use a homepage, gallery, ranking, category page, tag, or discovery feed only to find candidates. It is not evidence that a project solves today's problem, and it cannot authorize an art direction by itself.

For a candidate that may enter the reference packet:

1. open the specific project detail page;
2. follow through to the live work when it is publicly accessible;
3. read the creator's or studio's case-study article when one exists;
4. distinguish discovery metadata, directly observed behavior, author-stated rationale, and editorial inference;
5. identify the original project's problem before extracting a transferable principle;
6. reject or narrow any claim that exceeds the accessible evidence.

The default operating model is hybrid:

- keep reusable private case cards for previously verified work;
- after today's editorial lock, reopen and verify at least one relevant detail page, live work, or case-study article for the current issue;
- inspect no more than two new cases deeply by default; exceed that only when a material editorial problem remains unresolved, and record why;
- a previously verified case card may support the rest of the packet, but it may not prove current behavior unless the relevant page was rechecked today.

The required daily recheck is not a browsing quota. If no relevant case clears the evidence bar, use no visual reference and continue from the issue's own material.

### 4. Build a small reference packet

Default maximum:

- one primary conceptual teacher;
- one sequencing or composition reference;
- one Mobbin-derived usability constraint.

Recent and SiteInspire may supply candidate discovery, but do not count as a teacher by themselves.

Fewer is valid. Do not fill three slots by quota.

### 5. Record the evidence and translation

For every accepted reference, create or update a private `reference_case_card`:

```text
case_id:
source_role:
source_name:
project_title:
index_url:
detail_url:
live_project_url:
case_study_url:
accessed_at:
access_status: verified | partial | unavailable
observed_structure:
observed_interaction:
author_stated_rationale:
our_inference:
original_project_problem:
transferable_principle:
issue_problem:
why_today_needs_it:
issue_specific_translation:
do_not_copy:
access_limits:
mobile_no_js_constraint:
mechanism_signature:
```

`accessed_at` records the actual verification time with timezone. The evidence fields preserve four different claims:

- `index_url` records where the candidate was discovered; discovery metadata does not establish creator intent or live behavior;
- `observed_structure` and `observed_interaction` record only what was directly inspected;
- `author_stated_rationale` records only reasoning explicitly stated by the creator, studio, or other attributable project source;
- `our_inference` records the editor's bounded interpretation and must never be presented as creator intent.

Use the access labels consistently:

- `verified`: the relevant detail-level source was opened and supports the recorded evidence;
- `partial`: some relevant material was inspected, but a live work, case article, interaction, or other material layer was unavailable;
- `unavailable`: the relevant detail source could not be inspected and supplies no new evidence about its current implementation.

When no written case study exists, direct observation of the live work may support `observed_structure` or `observed_interaction`; leave `author_stated_rationale` empty and keep interpretation in `our_inference`. When a page is inaccessible, record the limit instead of filling the gap. A timestamped older card may support a stable principle, but it cannot be used to claim that the project still behaves the same way today and cannot satisfy the current issue's required detail-level recheck.

Complete this reasoning chain for every accepted visual reference:

`original project problem → transferable principle → today's issue problem → issue-specific expression → prohibited copied surface`

“Use horizontal scroll,” “use giant type,” “it looks good,” and “make it like AWGE” are invalid principles or reasons. State what the mechanism does for reading, hierarchy, identity, or time, and why today's material needs it.

Case cards store URLs, access times, limits, and durable text notes. Do not place third-party screenshots, copied assets, or copyrighted case-study material in the public repository. Credit is not a usage-rights basis.

### 6. Boundary examples

- A Codrops project with an attributable case article may populate `author_stated_rationale`; today's translation remains a separate editorial decision.
- A SiteInspire gallery entry with no inspected project detail remains discovery metadata and cannot authorize the direction.
- AWGE may support directly observed environment or interaction notes without a written case article; any explanation of why it works remains `our_inference` unless AWGE states it.
- A Mobbin surface hidden by login or access controls must carry the relevant access limit. Do not claim to have inspected a flow that was not accessible.
- A retired or offline project may retain a timestamped stable principle, but it cannot support claims about its current implementation.

### 7. Close the references

After the reference packet is recorded, stop browsing and develop the issue from its own material. The first art-direction proposal must be explainable without pointing at a screenshot.

## Seven-issue anti-repetition

Compare up to the previous seven valid issues using:

- primary teacher and consulted projects;
- concept family;
- entry behavior;
- cover geometry;
- reading direction;
- image logic;
- typography behavior;
- motion role;
- navigation model;
- interaction metaphor;
- main climax position;
- ending temperature.

Repeating a teacher is not automatically repetition. Repeating the same mechanism signature is.

Default rule:

- if the proposed issue repeats three or more dominant mechanism dimensions from a recent issue, require a material editorial reason;
- when repetition is justified, change at least two other meaningful dimensions;
- if the reason is “it worked last time,” reject the direction;
- if novelty weakens the issue, keep the stronger form and record the exception.

This threshold is provisional and must be tested in dry runs.

## Pre-output review gates

The generator runs these checks before handing the candidate to separate review. Self-report cannot authorize deployment.

### Content gate

- Every material claim is supported or visibly bounded.
- Story selection expresses judgment rather than equal-weight novelty.
- The cover is supported by cultural consequence, tension, or specificity—not only by the best available image.
- The English layer introduces no new fact or confidence.
- Media origin, credit, usage-rights basis, and documentary/contextual status are recorded privately.
- Harm, grief, conflict, community evidence, or culturally sensitive material is not aestheticized for visual drama.

Failure behavior: correct, narrow, omit, or return BLOCKED. Do not design around unsupported content.

### Reference-integrity gate

- The issue's visual action can be explained from today's material.
- Homepage, gallery, ranking, category, and tag pages were used only for discovery, not as sole evidence for an accepted reference.
- At least one relevant candidate detail page, live work, or case-study article was reopened and verified after today's editorial lock, even if the resulting decision is to use no visual reference.
- Every accepted reference has a detail-level URL or an explicit access limit, and its case card records the actual access time and status.
- Discovery metadata, directly observed behavior, author-stated rationale, and editorial inference remain distinguishable.
- Every accepted visual reference completes the chain from the original project problem to today's issue-specific expression and prohibited copied surface.
- Every reference contributes a principle or relationship, not a copied arrangement.
- No single source supplies the cover, section order, typography behavior, and interaction together.
- Reference assets, code, copy, and branded visual signs are not copied without an independent valid basis.
- AWGE-like cultural signs are not used as generic shorthand for subculture.

Failure behavior: discard the derivative direction and return to the editorial lock.

### Style-soup gate

- One dominant visual action governs the issue.
- Supporting techniques do not compete for attention.
- Motion has a reading or identity job; otherwise remove it.
- A reader can describe the issue's world without listing effects.

Failure behavior: remove mechanisms until the issue has one coherent rule.

### Not-a-portfolio gate

- The reader and subject remain the protagonists.
- Device mockups, process diagrams, award language, fake metrics, and designer self-explanation are absent from the reader-facing issue unless they are themselves reported facts.
- The page does not exist to prove the generator's sophistication.
- Long-form sequence serves editorial understanding rather than a design reveal reel.

Failure behavior: translate presentation devices back into publication functions or remove them.

### “My own Vogue” gate

This is a judgment gate, not permission to copy Vogue.

- The issue has a clear editorial position.
- The cover establishes authority and curiosity without empty spectacle.
- Image selection and sequence make an argument, not decoration.
- Story hierarchy creates anticipation, density change, pause, climax, and aftertaste.
- Recurring publication standards remain recognizable while today's world is distinct.
- The ending leaves a consequence, tension, or next cultural moment rather than a project-summary victory lap.

Failure behavior: separate review returns the issue for editorial/art-direction repair. Technical completion does not compensate.

### Reader-access gate

- Core reading order and sources remain clear without motion or JavaScript.
- Mobile is an intentional vertical publication, not a collapsed desktop scene.
- Controls, focus, reduced motion, contrast, touch targets, and source destinations remain understandable.
- Experimental navigation never traps the reader.

Failure behavior: simplify to the strongest safe version.

## Evidence and authority

- Generator manifest `PASS`, QA, or score fields are reporting only.
- Independent CI produces technical evidence.
- Separate editorial/visual review evaluates content-derived authorship, reference integrity, cultural appropriateness, publication quality, and image judgment.
- Deployment requires the approved evidence gate defined by the future canonical contract.

## Reference storage boundary

Private reference plans and comparison notes belong with private generation evidence. Public issue metadata may name public inspirations only when editorially useful, but must not expose internal scoring or copyrighted reference screenshots.

The `reference_case_card` contract in this document describes private generation evidence; it is not a new public manifest schema. Store durable text notes, source URLs, access times, statuses, and limits. Do not build an uncontrolled archive of third-party screenshots or publish private case-card instances in the public repository or Pages artifact.

## V3 boundary

This system is input to a future V3 reconciliation. It does not modify `docs/PRODUCTION_CONTRACT_V2.md`, does not authorize a deploy workflow, and does not re-enable daily automation.
