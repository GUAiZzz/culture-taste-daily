# Shared core v1

`core/` contains repository-native semantic rendering and shared functional product grammar. It provides:

- full server-rendered reading without JavaScript;
- stable header, archive, source-list, and footer structures;
- responsive safety, keyboard-visible focus, skip-link, safe-media, and reduced-motion foundations;
- a small, explicitly scoped publication shell for the homepage and archive.
- a progressive-enhancement layer for session-scoped reader themes, index filtering, and issue scroll orientation.

The shared core does not set an issue palette, background, display type scale, editorial width, density, image treatment, or spatial rhythm. Those decisions belong to the scoped `issue.css`; they do not inherit a default Culture & Taste visual template.

The three reader themes are atmospheric filters only. They preserve issue content and composition, survive issue navigation for one browser session, and disappear cleanly when JavaScript is unavailable. Motion never gates reading and is removed under `prefers-reduced-motion`.

The renderer does not choose stories, judge editorial quality, infer HarryTone rules, or authorize release. Per-issue source and art direction remain independent without replacing the semantic/accessibility contract.

The exact core identity is recorded in `core/version.json` and every build report.
