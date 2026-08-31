# Culture & Taste Daily mobile editorial protocol

This document is the single rule source for mobile behavior in this
repository. It extends, and never overrides, Production Contract V3,
`ARCHITECTURE.md`, `DATA_BOUNDARIES.md`, or the repository hard stops.

## Invariants

- Preserve locked editorial text, story order, dates, source links, issue
  identity, and public manifests.
- Preserve the three reader themes: `field`, `coral`, and `analog`.
- Preserve asymmetric editorial composition, long-form pacing, and deliberate
  visual tension. Mobile is a vertical magazine, not a generic card feed.
- Keep every issue fully readable without JavaScript. Enhancements may change
  atmosphere and navigation convenience, never content availability.
- Shared core owns access, safe layout, theme state, and motion lifecycle.
  Each issue package owns color, type scale, geometry, collage, and art
  direction.

## Responsive baseline

- Mobile layout begins at `800px` (`50rem`). Compact-phone corrections begin
  at `479px` (`29.9375rem`). These are the only shared mobile breakpoints.
- Use a `20px` content gutter on mobile and `16px` on compact phones, extended
  by `env(safe-area-inset-*)` where needed.
- Every HTML shell declares `viewport-fit=cover` before safe-area insets are
  used.
- Core reading text must remain at least `15px`. Necessary metadata must remain
  at least `11px`; `9px` is reserved for non-interactive decoration.
- Buttons, theme choices, filter controls, navigation targets, and close
  controls need a minimum `44x44px` hit area. The visible mark may be smaller.
- Touch controls need visible focus, selected, pressed, and touch feedback.
- Horizontal rails are allowed only when intentional. They must expose a visual
  continuation cue, keep the selected item visible, and support arrow keys,
  Home, and End. The document itself must not overflow horizontally.
- Use `svh` for stable minimum stages and `dvh` for live viewport caps. Avoid
  bare `100vh` on immersive or sticky mobile surfaces.
- Mobile landscape keeps the complete document while compressing headline and
  stage geometry enough to protect navigation and progress controls.

## Page recipes

### Publication home

Keep the brand, oversized latest-issue title, theme picker, daily index, and
asymmetric rhythm. At 800px and below, make the first reading action continuous
with the title and summary. Theme buttons remain tactile editorial panels, not
small radio dots. Daily cards may reduce columns only where readability needs
it; retain deliberate offsets or alternating geometry above compact width.

### Archive and index rails

Keep filters horizontally scrollable on narrow screens. Announce current state
with native button semantics and `aria-pressed`, provide keyboard traversal,
and scroll the active control into view. No filter may be required to access
content when JavaScript is absent.

### Long issue

Keep the issue header, contents rail, full article, feature compositions,
sources, and reading progress. Sticky and transform effects must use dynamic
viewport-aware geometry, bounded transforms, one animation-frame scheduler,
passive scroll listeners, and lifecycle cleanup. Pause continuous atmosphere
when the document is hidden. Reduced-motion must preserve every section in the
same order while disabling persistent noise and transform-dependent reading.

## Media and performance

- The first meaningful visual may load eagerly. Later raster media should use
  responsive candidates, correct `sizes`, lazy loading, and async decoding.
- Preserve intended crop, color treatment, and image meaning. Never substitute
  remote display-critical assets.
- Consolidate scroll reads and writes in one `requestAnimationFrame` update.
  Do not leave duplicate listeners, observers, or animation loops after page
  lifecycle transitions.

## Deterministic acceptance

Validate 320x568, 390x844, 430x932, 768x1024, and 844x390, plus the existing
desktop and no-JavaScript cases. Acceptance requires:

- no document-level horizontal overflow;
- no clipped Chinese or English headings;
- readable body and metadata sizes with safe-area-aware gutters;
- 44px functional controls and visible keyboard focus;
- persistent theme selection, operable filters, and stable navigation;
- complete reduced-motion and no-JavaScript reading;
- no console errors, broken display assets, or duplicated motion loops.

Technical evidence remains local and non-production. Human visual review and
all production gates remain separate.

## External inspiration boundary

The project does not install or copy either source.

- From `isjiamu/gzh-design-skill`, absorb only content completeness, component
  recipes, one rule source, and deterministic acceptance. Reject AGPL files,
  WeChat inline HTML, its themes, and platform-specific constraints.
- From `MengTo/skills`, absorb only design-first constraints, editorial-tech
  thinking, scroll-trigger discipline, and motion-performance auditing. Reject
  WebGL, generic SaaS composition, extra visual styles, and unrelated tooling.

These references may improve a weakness in the current system; they do not
authorize a style replacement, content rewrite, dependency, or downgrade.
