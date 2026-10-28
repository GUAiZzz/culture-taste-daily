# Culture & Taste — shared reading system

Status: owner approved on 2026-10-28. This is the current implementation contract; actual deployment is established separately by the Preview workflow and live-identity receipt. Authority: [Amendment A3](PRODUCTION_CONTRACT_V3_A3.md). The approved soft homepage and complete reader form one publication. New daily content inherits this system across all three reading styles. A daily candidate must not invent another UI/navigation model or drop one of the approved styles.

## Stable structure and editorial freedom

`core/rooms/render.mjs` is the shared rendering entrypoint. The shared shell, interactions, typography controls and accessibility remain stable. Daily editorial work supplies the date, hierarchy, bilingual text, actual images, captions, sources and curation. Images, their sequence and useful pauses may vary with the subject. UI changes are separate reviewed maintenance work, with complete regression evidence; they cannot be smuggled into a dated content PR.

The homepage presents the current issue, one horizontal category bar, the complete article list, archive access and a sourced daily quotation. Category controls scroll within their own narrow-screen bounds, expose continuation and keep the active item visible; the document must not overflow. Issue contents use two columns on wide screens and one column on narrow screens. An article retains full static content, its end-of-article issue-directory disclosure and previous/next navigation.

The floating `本期文章` shortcut appears only after the original category-controls block has passed its normal document position. It fades in over 180ms and fades out on returning above that position. Hidden state sets `aria-hidden=true`, `tabindex=-1` and no pointer interaction. Reduced motion removes the fade. This is a position-threshold shortcut, not a direction-sensitive contents rail or an automatically hiding article directory.

## Shared interaction contract

| Area | Required behavior |
| --- | --- |
| Reader top bar | Return arrow at left and one settings icon at right. No duplicated language pill, source-count control or sidebar source shortcut. Return has an accessible name and restores the originating homepage category and reading position. |
| Settings entry | The same 24 × 24 adjustment SVG, 1.7px stroke and three slider lines across home/readers. Hit area at least 44 × 44 CSS px; accessible name and title are `阅读设置`. |
| Settings order | `正文语言` (中文 / EN) → `正文字号` → `阅读风格` (场域 / 印刷 / 信号) → `阅读外观` (明亮 / 夜读 / 暖灰) → `工具外观` (实色 / 轻玻璃) → `触感反馈`. No fieldset frame, reset button, visible status paragraph or explanatory hints. |
| Settings geometry | Shared pill controls at least 44px high, two or three equal columns as appropriate, group spacing 18–20px, 12px muted group labels. Settings and image viewers use native dialogs. |
| Live font control | Label at left, live `Npx` output at right and a full-width slider below. The output itself computes to the selected N CSS px on every `input` event, line-height 1.2 and minimum 32px area. Ordinary Chinese/English paragraphs compute to the same selected size, including first paragraphs; headings, captions and source metadata keep their own scales. |
| Language | Chinese is the first-use default. Persist the selected language across routes. Display each complete language body once; moving inline figures between language blocks must not clone the article or duplicate its visible images. Changing language or font size preserves the approximate article paragraph, including changes made inside the dialog. |
| Preferences | Shared language, font size, reading style, reading appearance, tool surface and haptics state across home and all readers. New-entry defaults: field style / light appearance / solid / haptics off / 19px / Chinese. Restore style, appearance and tool material in the head before the body can paint; reading enhancements initialize later and tests must wait for their explicit ready state. Reconcile browser-back restores. No private content enters browser preferences. |
| Style × appearance | Keep `style=field/coral/analog` as three selectable visual-material identities: 场域 Field, 印刷 Coral, 信号 Analog. Independently, `theme=light/dark/warm` controls reading appearance across text, captions, sources, fallbacks and dialogs. All nine combinations use the same structure/settings/navigation and must remain readable. No complex legacy channel mechanism is reintroduced. |
| Legacy links | Old `?theme=field/coral/analog` select the corresponding reading style; they are not merely aliases for light/dark/warm. New `?style=` is explicit. Preserve the user's independently chosen reading appearance and carry both axes through home/archive/article navigation. |
| Glass and touch | Only the floating tool layer may use light glass. Solid is default and the fallback for unsupported/reduced-transparency environments. Haptics are optional, feature-detected and off by default; visual press feedback always works. Never promise iPhone webpage vibration. |
| Dialogs | Escape, close button and deliberate backdrop click close; focus opens at the selected theme and returns to the opener; background scrolling is locked without losing the reading position. Image dialogs remain sized for the image. |
| States | Shared 3px accent focus, selected/expanded state, hover and 1px pressed translation; reduced motion removes transforms/animation. Boundary previous/next states are semantically disabled, not links to an unrelated destination. |

## Materials, glass and type hierarchy

Preserve the original five texture assets rather than generating replacements. Field keeps green paper and its blue wordmark; Coral keeps its warm red ink field, paper stock and restrained text-ink mask. Analog keeps the original warm brown-black screen, worn asymmetric enclosure, 4px scanline cycle, original grain, inner-edge shading and faint glass reflection. The original dark palette is `#1b1917 / #eee7d5 / #dfb876`. Light/warm adapt illumination while retaining the same material layers. These noninteractive decorations never cover or filter official images. A brief, throttled edge rustle stops for reduced motion, offscreen content, blur and hidden pages.

The website follows [Apple materials guidance](https://developer.apple.com/design/human-interface-guidelines/materials) and [adoption guidance](https://developer.apple.com/documentation/TechnologyOverviews/adopting-liquid-glass): a limited navigation layer supports the content. It is a web material inspired by those principles, not the native system renderer. Glass targets are the floating reader toolbar, floating list-return/article-top shortcuts and homepage settings entry. Settings sheets, article bodies, source lists and image content remain solid. A transparent toolbar parent lets scrolled content reach its local backdrop. The shared material combines a theme-tinted translucent base, 24px blur, modest saturation, a directional reflection, 1px edge highlight, inset rim and two-depth shadow. Dark appearance increases the protective tint. Unsupported blur, reduced transparency and forced colors retain solid usable controls; motion preferences remove transitions. No lens distortion is applied to text or images.

Type uses the platform sans stack (PingFang SC / Microsoft YaHei for Chinese) for controls and Chinese paragraphs; English paragraphs use Georgia with serif fallback. Chinese body defaults to 19px, 1.95 line height and .025em spacing; English uses the same selected size, 1.85 line height and normal tracking. Reader headings use Songti SC/STSong/Georgia at responsive 35–62px, with a separate 40–70px English display scale. Labels/captions stay 11–12px with their own line height. The shared image / panel / control radius family is 18px / 24px / full capsule; the asymmetry of the original TV enclosure is a deliberate material detail. Accent marks selection and action; glass highlights do not introduce a second accent palette.

## Images and article rhythm

Images are editorial content. A long article must not default to a single hero followed by an uninterrupted wall of text when directly relevant verified work/process images are available. Place documentary work, production or process images beside the paragraph they clarify; use single or paired images according to the material. Do not impose an arbitrary picture quota or repeat the hero to fill a slot.

Successful hero and inline images use their natural aspect ratios: width 100%, height auto, complete work visible, rounded corners on the image. Paired images may have different natural heights. No fixed cover/contain frame may crop work or create large empty bands. Image viewers constrain the real image to the viewport and adapt their width rather than placing a small portrait inside a large empty frame. Placeholder dimensions are allowed only for loading/unavailable states.

Each figure has a concise useful caption, exact source link, alt text and required credit. Put longer provenance/rights evidence in the image-information disclosure, not repeated cautionary paragraphs beneath every photograph. A diagram is explicitly `编辑图解`; it cannot impersonate a work, exhibition installation or news photograph. Every selected story still needs the first-party official-image evidence required by A2.

Official availability is not reuse permission. Unknown rights allow only the existing visibly non-production, linked official Preview treatment. Do not download or package an unknown-rights image. Remote image failure preserves readable text, a clearly identified fallback and an exact official-source link; it does not become a health PASS or clear rights.

## Sources, bilingual content and archives

Every article has one complete source index at the end. Native disclosure may collapse its presentation; all source links remain in the served HTML, keyboard accessible and readable without JavaScript. Image-source links next to figures identify those figures and do not create another duplicated article source index. The full original bilingual text is the source of truth; a layout change cannot summarize it, repeat it, truncate it or invent an English body from metadata. Newly prepared ordinary structured issues from 2026-10-28 require complete `### 中文` and `### English` body blocks in `content.md`; title/deck/abstract fields do not substitute for either body. Earlier locked issues keep their honest existing English scope.

Archive/current-issue lists and article navigation use the same UI. Keep real issue dates and cumulative article counts. Preserve all already-published locked source and the three supplied historical originals byte-for-byte. A current-day addition is a new identified, revalidated cumulative release with its own lock/hash and publication receipt; it is not a silent mutation of a previous artifact.

## Daily quotation

The current reading system uses the verified attributed pool at `core/rooms/daily-quotes.public.json`, independently of the legacy original-editorial coda pool. Display the original text, attributed author, Chinese translation with its translation note, and a working source link identifying the work/chapter/year. No invented quote, attribution or source is allowed. Prefer primary works/transcripts and stay within permitted quotation scope.

The current verified pool contains seven quotations. The homepage advances deterministically by the actual `Asia/Shanghai` date and repeats the same seven-day sequence each week until the reviewed pool changes. This is daily rotation of sourced material, not daily fresh quote research or an infinitely unique feed. Dated issue/archive representations use their own fixed date, preserving historical meaning. No random text swap, invented freshness or author-less slogan may satisfy this rule. The daily task reuses the verified shared pool; changing that pool is maintenance work, not permission to edit shared files in a content-only PR. Legacy locked `closing_quotation` and palette records remain valid historical data and are not rewritten.

## Daily quantity and cumulative updates

From 2026-10-28, the first ordinary current-day release requires **at least ten** complete formal articles. Eleven or twelve are valid; ten is a floor, not a ceiling. Later additions may contain one or more new qualified articles without assembling another ten-article batch. Validate the resulting cumulative package: every selected article, including the eleventh or twelfth, must have its complete body, bounded English, at least ten distinct substantive actually-read sources, official-media evidence and all other applicable quality checks. Ten complete articles do not excuse an incomplete eleventh.

This does not change the explicitly authorized historical supplements: each retains exactly ten formal articles and ten qualifying sources per article. Published baseline fingerprints, historical originals, privacy, rights and source requirements stay protected. The existing five checkpoints, 15:00 Production deadline, 18:00 reconciliation boundary, Preview authority and Production-disabled status are unchanged by A3; schedule restructuring is separate work.

## Implemented scope and pending operations

This release implements the shared rendering contract and the ordinary cumulative-package quantity floor. It does not introduce an autonomous same-day append publisher: the current `daily:cycle` still verifies an already-live current date and takes its existing no-op path. Approval to add one or more qualified articles is a content rule; passing an eleven-article validator test is not evidence that a second same-day release has run.

A later append implementation must verify revision/PR identity, retain the original release receipt, bind the cumulative package to fresh evidence and independently verify its resulting live artifact. This UI release retains the current scheduling/time policy; the requested timing-flexibility work remains a separate operational change, not a lack of owner authorization.

## Machine verification and future updates

The required technical check is `reading_system_contract`, referenced by `automation/daily-policy.json` and enforced by the shared QA/evidence schema, not just this document or a task prompt. Public editorial checks and the private workspace/source binding enforce the ordinary quantity floor and complete evidence for every selected article. The shared renderer applies the structure to every new issue automatically.

Verify representative desktop and 320/390/430px mobile, portrait/landscape, keyboard, no-JavaScript, reduced-motion and image-unavailable routes. Inspect actual computed font sizes at 17/19/25px for the live output and both ordinary language bodies; inspect all three styles × three appearances, both tool surfaces and native-dialog focus/close/scroll behavior. Test category/position restoration, category scrolling and static issue-directory layout, disabled boundaries and source disclosure. A screenshot or a passing unit test alone is insufficient.

A daily content-only change must run the same renderer, editorial/private-source checks, `npm run verify`, daily health, security and exact-head CI. `reading_system_contract` must PASS for the exact candidate/artifact before the guarded Preview handoff. Existing build/merge/dispatch/live-identity checks remain required. A successful build or dispatch is not publication; verify actual live routes and hashes.

## Three-style compatibility clarification

The owner explicitly retained Field / Coral / Analog after approving the common layout. A3 removes the obligation to build a different interface for every issue or style; it does not remove these three selectable cultural/material identities. A successful update must render the shared structure in every style, with each style visibly distinct and with independent light/dark/warm appearance preferences. One soft green skin with three lighting labels is insufficient.
