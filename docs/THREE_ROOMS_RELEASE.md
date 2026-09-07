# Three reading rooms · September 7, 2026

The owner approved replacing the public website with the accepted Field Notes, Coral Print and Analog Signal edition, preserving the previous website and catching up missing dates. This is a maintenance release of the existing public, noindex Preview endpoint; it does not change Pages settings or the separate Production rights/review gates.

The reading rooms are shared reader choices. They govern navigation, layout, material, motion and footer presentation across the modern reading edition. Original issue text, English layers, quotations, source dates and original covers stay locked. The source coda palette remains recorded; readers may choose a room palette for its presentation. The August 20–24 original presentations remain accessible as originals. The new shared reading edition retains each later issue's original presentation at `original-edition.html`.

This owner-approved presentation choice supersedes older requirements forbidding shared room layouts, prescribed mobile breakpoints, or coda presentation changes. The accepted density is two columns on compact phones, three above 600px, four above 900px and five above 1200px for Field and Coral. Analog retains its TV programme layout and fixed four-sided bezel. Photos remain original by default, with separate optional photographic treatment.

`core/rooms/render.mjs` runs inside the existing validated build, before artifact hashing. It receives the validated issue inventory; neither the latest date nor issue/story counts are fixed in the renderer. All local reading and asset URLs are relative so the deployed project path and the downloadable archive work correctly. Scope, schema, content hash, privacy, independent CI and live release verification remain in place.

The V1 layout regression suite explicitly uses its September 4 content snapshot. New growing-inventory tests independently exercise today's content, deterministic output, real project-path navigation, all three rooms, filters, responsive layouts and original-content preservation. Updating a daily issue no longer invalidates V1 screenshot-era content expectations.

## History

- Original deployed commit: `90170b31a8146f4e46ce4a2ceacd4899ff0be479`.
- Immutable Git tag: `site-v1-before-rooms`.
- GitHub release includes the full rebuilt static edition.
- `src/history/v1` retains that edition for permanent browser access through `/history/`.
- Before preservation, homepage, archive and September 4 issue bytes matched the old live release hashes. External official media remains external and is not guaranteed to stay available.

## Automatic updates

The existing daily task continues to generate dated editorial packages; the shared build applies the accepted rooms automatically. The owner-authorized daily Preview gate, policy checkpoints, public health reports, exact-SHA workflow dispatch and post-deploy hash checks remain the publishing path. No second scheduler or GitHub cron is introduced.

## Catch-up editions

September 5 is a three-article retrospective assembled September 7. September 6 retains four prepared articles and five supplemental links, revised September 7 after one music-festival source could not complete current browser review. Both editions visibly disclose the retrospective boundary and actual timestamps. Neither claims a complete contemporaneous daily scan. September 7 retains its three formal articles and seven supplemental links.

The owner's explicit catch-up request authorizes these two bounded maintenance exceptions. `core/rooms/retrospective-issues.json` pins their exact content and reading-index hashes. Future ordinary daily issues still require the existing complete daily radar, coverage, source, deadline and automatic release gates; this exception is not an automatic backfill policy. Retrospective entries participate in subsequent issue deduplication and source-health checks.

The archive includes all structured articles, including the August 23–24 originals. August 20–22 remain intact historical documents accessed through their issue entries, without pretending to have a reconstructed article index.
