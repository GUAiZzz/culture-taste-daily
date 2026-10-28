# Daily editorial operations

Owner instruction: 2026-10-27. Objective: a complete, high-quality, verified daily Preview issue. A scheduler run, a source queue, a saved draft, a green PR and a deployment are different outcomes.

## One rule set

`automation/daily-policy.json` owns the current rules. From the owner-approved 2026-10-28 A3, an ordinary first current-day release contains at least ten complete formal articles; later additions have no new ten-article batch quota and validate the cumulative complete package. Historical supplements retain exactly ten. From 2026-09-16, each ordinary article needs at least ten distinct substantive actually read information sources; all authorized historical supplements need ten per article. Radar items and source links do not count as articles. Do not pad counts. The existing coverage, regional lanes, 99-subject discovery scan, independent context, HarryTone, bilingual editorial, official media, rights, privacy, variation, QA, CI and live verification gates remain mandatory.

`scripts/lib/editorial-policy.mjs` is shared by progress reports and final publication checks. Final publication never uses provisional/unlocked progress as approval. `automation/published-baseline.json` pins the 27 structured issues already live at the verified September 22 source commit; its file and manifest fingerprints preserve their original requirements. New issues receive no exemption. The three historical originals remain protected separately by the existing build.

Public CI checks actual article structure and public source links with `editorial:check --public-only`. It cannot certify private source reading. `preview:release` additionally reads the exact private article-source records and the current saved workspace. Its export revision, workspace fingerprint, source records and every article body must still match. Editing a draft or source after export invalidates that handoff; release rechecks it before merge.

## Start or resume one current-day workspace

Use the existing private automation root, outside every public checkout:

```sh
npm run daily:cycle -- --workspace-root /Users/harryhe/.codex/automations/culture-taste-daily-candidate/private --online
```

This resumes `<private-root>/YYYY-MM-DD/editorial/state.json`. It reports concrete per-article reading/draft gaps and the next action. It does not repeatedly install dependencies, rerun unchanged full-site QA or inspect all historical PRs before research. Unavailable online reconciliation is reported separately and never authorizes publishing; private editorial work can still advance.

The command uses actual Shanghai time. Research through 15:00 meets the Production window; late Preview research may continue before 18:00 with honest times and the Production window blocker retained. At and after 18:00 reconcile and report only. No schedule, Production authority, historical date or Pages setting is changed.

## Save actual work incrementally

Use `editorial:workspace apply --workspace <absolute-date-workspace> --input <absolute-private-operation.json>` after a useful reading or drafting step. The input has a unique `operation_id`, the current `expected_revision`, and article/source/scan updates. Keep it outside the repository. An identical retry is a no-op; changed reuse of an operation ID or a stale revision is rejected. Writes are locked, owner-only, fingerprinted, flushed and atomically replaced. A corrupt state or abandoned lock is not silently reset; inspect the owning process and retain the original file before recovery.

An article identifies `story_id`, `title` and one `canonical_event_id`. Its `draft_markdown` is the exact body beneath that article's `##` heading in `content.md`, excluding the heading. Keep the bilingual manifest fields separately authored. Reading records use the existing supplement contract:

```text
article_sources[].story_id / canonical_event_id
sources[].url / kind=information / actually_read=true / substantive=true
underlying_source_id / supports[] / reading_notes / accessed_at (+08:00)
```

Record a search snippet or unopened link as discovery (`actually_read:false`, actual `discovered_at`), never as a read source. Fragments, tracking parameters, repeated underlying sources, image credits, profiles, index pages and search pages do not fill article source counts. A canonical URL is not proof of independence. Official announcements establish only their own stated facts; claims of cultural impact need independent support.

`source_scan` saves each brand's actual `subject_id`, `route_url`, `checked_at`, notes, result and discovered `detail_urls`. Access failure stays `ACCESS_LIMITED`; unresolved identity stays `IDENTITY_UNRESOLVED`. Neither means no news. A saved scan is separate from article reading and never increments substantive source counts.

Replace a weak selected candidate with `retire_articles:[{story_id,reason}]` in the same `apply` operation that adds the replacement. The original draft, sources, findings and reason remain in the private archive; only the active article queue changes. A failed replacement cannot erase the original.

`editorial:workspace plan --workspace <absolute-date-workspace>` reloads the same saved work in a new process. `carry` copies unfinished material to a new current-day workspace while keeping original dates. Recheck carried sources and the exact draft before they become current-day progress; never relabel yesterday's reading as today's.

## Source library and substitution

`npm run sources:plan -- --subject <name-or-id>` returns the subject's verified official discovery entrances. All 99 subjects exist, including explicit unresolved records. A valid library is not a completed daily scan. Verified routes are identity evidence, not proof of readable current news.

Inspect accessible public official posts/reels/captions where useful. Verify an Instagram identity through an official site's outbound link. If blocked, use official news/journal/lookbook, the responsible collaborator or institution, original regional-language reporting, or a public feed/archive. No login/following dependency or access bypass. Read exact detail pages, retain dates and limitations, and replace weak/inaccessible candidates early.

Daily scan notes and access results stay in the private workspace. The public source library contains entrypoints and identity provenance only. Do not publish private source-health notes, research screenshots or rejected candidates.

The final release checks that all 99 subjects have a real current-day scan attempt saved. An unavailable unselected brand is an honestly reported discovery limitation, not an independent veto on complete selected stories. Every selected story still needs all its substantive read sources and official-media evidence.

## Package, verify and release

1. Finish every selected article body and its per-article source set, with at least ten articles for an ordinary first release. Complete the original research/editorial/media/coverage checks. Preserve progress when incomplete; no incomplete selected article is publishable; an existing complete first release does not require ten additional new articles for a subsequent cumulative update.
2. Assemble only today's allowed public package and cover. Export the private ledger with `editorial:workspace export --workspace <absolute-date-workspace> --output <absolute-private-export.json>`. This is not a publication certificate.
3. Run `editorial:check --date YYYY-MM-DD --private-evidence <absolute-private-export.json>`. Repair exact blockers before expensive full verification. Do not edit the saved drafts after export without re-exporting and rerunning dependent checks.
4. Run `npm ci`, `npm run verify`, `health:daily --date YYYY-MM-DD`, `npm audit --audit-level=high` and `git diff --check`. The source-health probe never follows redirects and does not launch an automatic browser fallback: a redirect or restricted route requires separately controlled review, with no retry of a denied destination. Inspect the required desktop/mobile/no-JS/reduced-motion/theme/fallback results. Keep real health limits and rights states intact.
5. Commit/push only the dated allowlist, update its unique PR, wait for CI at the exact head, and prepare the full private Preview attestation from actual evidence. Run `preview:release` without execution first; execute only when eligible. Preserve exact artifact identity through deployment.
6. On interruption, reconcile GitHub and resume the original merge/dispatch with its matching receipt. Never duplicate a candidate or release. Report publication only after `preview:live` verifies the actual homepage, archive, issue and every current story.

The current-day issue takes priority. The separately authorized historical supplement queue cannot consume every run while the daily issue remains at zero. Original unpublished PRs are preserved; no locked date is silently retrofitted.

## Technical repair and reporting

Daily candidates cannot change shared code or dependencies. A shared technical failure produces a separate scoped maintenance change, with the minimal reproduction and verification; repeated unchanged diagnostics are not progress. This maintenance change fixes the known dependency advisories and aligns reading QA with the existing official-media fallback policy. Fallback readability never changes an unavailable source/media health result to PASS or clears rights.

If online reconciliation fails, `daily:cycle` reports a fixed, non-secret diagnostic that distinguishes transport/access failures, explicit GitHub HTTP 401 or 403 responses, and ambiguous authentication output. An apparent invalid-token message alone is not conclusive: a restricted execution context can prevent network or credential-store access. Use the approved scoped execution path and recheck before changing credentials. An unavailable reconciliation still grants no publication authority; this diagnostic does not itself grant network access or guarantee unattended execution.

Notify on first verified publication, missed primary delivery, material recovery progress/new blockers and the final daily result. Include last verified live date, article and read-source counts, exact remaining work and next checkpoint. A successful command with no complete issue is not a successful daily publication.

## References and experiments before changes

Before an optimization, record the observed failure, relevant source/example, chosen bounded change and a test that could disprove it. Reopen references when their current behavior matters. Reuse a useful skill only when it matches the work; do not add tools merely because they exist.

| Decision | Reference actually consulted | Applied principle | Verification |
| --- | --- | --- | --- |
| Unified editorial gates | Existing historical supplement validator and its negative tests | Share one structural/read-source contract without weakening original rules | Under/over-count, unread/duplicate source and stale timestamp tests |
| Resumable work | [LangGraph persistence](https://docs.langchain.com/oss/javascript/langgraph/persistence) | Persist workflow state across processes; a conversation summary is insufficient | Real process exit/reload, replay and carry experiments |
| Reliable storage | [Node file handles](https://nodejs.org/api/fs.html#filehandlesync) | Exclusive lock, flushed temporary file, atomic replacement and revision checks | Competing writers, truncated state, stale revision and source mutation tests |
| Release continuity | [GitHub workflow artifacts](https://docs.github.com/en/actions/tutorials/store-and-share-data) | Verify and deploy the same identified artifact | Existing digest/route/dispatch tests remain in force |
| GitHub failure diagnosis | [GitHub CLI authentication status](https://cli.github.com/manual/gh_auth_status) and [Node child process errors](https://nodejs.org/api/child_process.html#child_processexecfilesyncfile-args-options) | Classify available failure signals conservatively and never echo raw output or secrets | Synthetic 401/403, timeout, access-denial, ambiguous token and secret-redaction tests; real restricted-environment smoke test |
| Source-health safety | [Playwright page.route](https://playwright.dev/docs/api/class-page#page-route) and [Node HTTPS](https://nodejs.org/api/https.html) | Disable automatic browser fallback; bind checked public DNS addresses to the HTTPS connection and stop all redirects for review | Synthetic internal targets, redirects and DNS rebinding checks, plus a safe public-source smoke test |
| Dependency repair | [markdown-it advisory](https://github.com/advisories/GHSA-gfr2-rv44-r23c), [fast-uri advisory](https://github.com/advisories/GHSA-w74x-v6f9-j3xg) | Apply patched compatible versions; keep the security check active | Clean install, audit and full build/regressions |
| Source substitution | Official brand/institution sites linked in the maintained library | Verify identity and exact details; separate access from reading and rights | Real source handoff plus failed-route/scan-count tests |

Synthetic experiments remain clearly marked and never enter a public issue. A real-source recovery experiment may retain an unfinished article while correctly reporting fewer than ten sources and zero publishable issues. Passing infrastructure tests does not prove future unattended daily output; inspect the first actual scheduled runs and their live receipts.

## Approved shared reading structure

Use `docs/READING_SYSTEM.md` and A3 for every future content update. The shared `core/rooms/render.mjs` applies the approved structure; `reading_system_contract` is required technical evidence for the exact artifact. The daily candidate allowlist remains dated content/cover only. Maintenance changes to core, settings, the daily quote pool, policy or workflows are separate reviewed work. Reuse UI and reference evidence honestly; legacy `detail_reference`/`seven_issue_variation` attestation IDs now refer to the approved system and current editorial/image review, not a fictitious daily UI redesign. Original truth/source/rights gates remain.

A3 implementation scope: cumulative packages with eleven or more complete articles pass the quantity/binding gates. The current already-live-date cycle remains verification/no-op; this does not certify autonomous same-day append publication. See READING_SYSTEM.md for the pending revision/receipt path and the current seven-item, weekly-repeating quotation rotation. This UI release retains the existing time policy while the requested flexibility work remains separate.
