# Shared core v1

`core/` contains repository-native semantic rendering and shared product grammar. It provides:

- full server-rendered reading without JavaScript;
- stable header, archive, source-list, and footer structures;
- responsive, keyboard-visible, reduced-motion-safe foundations;
- shared styling that an issue may extend through its own `issue.css`.

The renderer does not choose stories, judge editorial quality, infer HarryTone rules, or authorize release. Per-issue source and art direction remain independent, and issue CSS may create a distinct expression without replacing the semantic/accessibility contract.

The exact core identity is recorded in `core/version.json` and every build report.
