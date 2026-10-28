# Culture & Taste Daily mobile reading protocol

Current authority: [READING_SYSTEM.md](READING_SYSTEM.md) and owner-approved [A3](PRODUCTION_CONTRACT_V3_A3.md), 2026-10-28. V3/A1/A2 truth, rights, privacy and historical-original safeguards remain. This replaces separate complex channel interfaces and daily redesign; it retains all three selectable style identities inside the same shared structure.

## Invariants

- Preserve locked text, article order, dates, captions, source links and manifests. Supplied historical originals retain their exact hashes.
- One shared soft publication/reader system renders every new daily package. Daily work changes editorial data and image sequence, not controls or shared CSS/JavaScript.
- Reading styles are independently `field`, `coral`, `analog`; reading appearances are `light`, `dark`, `warm`. Old `?theme=field/coral/analog` select style, and new `?style=` is explicit. All nine combinations remain functional and visibly distinguish their styles. Preferences persist across home, archive and articles. Field/light/solid/19px/Chinese/haptics-off are the new-entry defaults.
- Full Chinese, available complete English, source indexes and navigation are served HTML, readable without JavaScript. No fetch-only text or modal-only essential content.

## Layout, touch and scrolling

- Use safe-area-aware gutters: normally 20px on mobile and 16px on compact phones. Declare `viewport-fit=cover`; stable stages use svh and bounded overlays use dvh.
- There is no page-level horizontal overflow. Intentional category/contents rails scroll internally, show continuation, keep selection visible and support keyboard arrows/Home/End.
- Category controls form one horizontal internally scrolling bar. Issue-directory order remains editorial: two columns on wide screens, one on narrow screens; article readers keep a static native issue-directory disclosure. The floating `本期文章` shortcut fades in over 180ms after passing the original category-controls block, and fades out when returning above it. Hidden state has aria-hidden=true, tabindex=-1 and pointer-events:none; reduced motion removes the fade. It does not hide/reveal based on scroll direction.
- Controls and source destinations have at least 44×44px hit regions, visible 3px accent focus, selected/open state and restrained press feedback. Motion/transforms stop in reduced motion. No daily scroll gimmick is required.
- Reader top bar has only a named back-arrow and the shared 24×24 adjustment icon. Language lives inside `阅读设置`; sources live at the article end.

## Settings and typography

Settings order: `正文语言` (中文/EN), `正文字号`, `阅读风格` (场域/印刷/信号), `阅读外观` (明亮/夜读/暖灰), `工具外观` (实色/轻玻璃), `触感反馈`. Use equal-width shared 44px pills, 12px muted group titles and 18–20px group gaps. No fieldset borders, reset button, visible status explanation or switch hint text.

The live Npx output itself measures N CSSpx immediately on input, line-height 1.2 and minimum 32px area; a full-width accent slider sits below the left label/right output row. Ordinary paragraphs in both languages, including the first paragraph, compute to the selected Npx; independent titles, captions and source metadata keep their own type hierarchy. Default 19px; verify 17/19/25px in actual browsers.

Native settings and image dialogs close with Escape, close button or deliberate backdrop click, lock background scroll and return focus. Settings initially focus the selected theme. Language/size changes preserve the current article paragraph when the dialog closes. Glass is limited to tools, solid by default; unsupported devices keep working visual feedback and no vibration guarantee.

## Images, sources and navigation

- Successful hero/inline images use natural width 100% / height auto. Complete work remains visible, with 18px corners on the image. Paired images may have different heights; no imposed crop or large contain frame. A native viewer fits the actual image to the viewport.
- Place useful verified artwork/process visuals within the related text. Do not repeat the hero as filler. Captions are concise, and source/credit remain visible; longer rights/provenance notes use native disclosure.
- Failed media preserve readable text, an explicitly identified fallback and exact official-origin access. Health/rights evidence is independent; fallback success cannot turn a remote failure into PASS.
- One complete article source index stays at the end; native disclosure never removes its static links. Previous/next boundaries have true disabled semantics.
- Return to home preserves legitimate category context and saved position. Missing/invalid category means all; never infer a fresh entry from stale session state. Cross-article links retain originating context and preferences.

## Daily quotation and archive

The shared seven-item sourced quotation pool rotates daily by Shanghai date and repeats weekly; it includes original, Chinese translation, attribution and source. It does not claim daily fresh quote research. Homepage follows actual Shanghai date; dated archive/issue representations remain stable. It is separate from preserved legacy editorial coda metadata. Historical originals are not restyled or reconstructed by daily work.

## Acceptance

Test 320×568, 390×844, 430×932, 768×1024, 844×390 and desktop 1440×900. Include keyboard, no-JavaScript, reduced motion, all three styles × three appearances, solid/glass fallback, unavailable media, actual live typography, dialog focus/scroll locks, floating-shortcut threshold/hidden states and return restoration. A screenshot alone is not interaction evidence. `reading_system_contract` is required machine evidence; full build/QA/tests/health/CI and actual Preview live verification remain separately required.
