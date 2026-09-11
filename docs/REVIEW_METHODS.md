# Review methods and adoption boundary

Research verified 2026-09-05. Counts are a dated discovery threshold, not a quality score. Every candidate passed the owner's ≥100 Stars requirement. Exact commits and counts are in `dependencies/review-methods.json`.

| Source | Selected use | Adaptation and decision |
|---|---|---|
| [Vercel agent-skills](https://github.com/vercel-labs/agent-skills) · 30,856 | Link semantics, state restoration, accessible feedback | Reference only. Do not execute fetched mutable instructions; repository-root license was not established. Native regression tests cover the selected behaviors. |
| [Anthropic skills](https://github.com/anthropics/skills) · 174,319 | Browser reconnaissance and testable user journeys | Selected methods. Webapp-testing/frontend-design license files specify Apache-2.0. Keep this project's Node Playwright; wait for concrete page state rather than external-image network idle. Preserve editorial art direction. |
| [Impeccable](https://github.com/pbakaus/impeccable) · 65,700 | Separate measurable defects from design judgment; attach reader impact | Selected audit concepts only, Apache-2.0. Do not install its binary, hooks, detector, or critique orchestration. This work does not claim an Impeccable command run or independent multi-agent assessment. |
| [Superpowers](https://github.com/obra/superpowers) · 281,910 | Reproduce, isolate cause, change one boundary, verify regression | Selected debugging method, MIT. Do not import its complete agent workflow or permission process. |
| [OpenAI skills](https://github.com/openai/skills) · 25,423 | Browser evidence and reproducible interactions | Existing browser tools already provide this capability; no duplicate installation. Keep upstream license review as a requirement before vendoring. |
| [Firecrawl CLI](https://github.com/firecrawl/cli) · 620 | Potential incremental official-source collection | Defer provider/tool integration. Cost, credentials, source coverage and repository license need explicit validation. Do not make it a mandatory network gateway or send private research to it. |

The repository-specific `culture-taste-review` skill is original project guidance. It integrates the selected concepts into the existing workflow; it does not copy or install these six upstream skills. Acceptance is a repaired, tested reader journey plus unchanged content/rights boundaries, never a model-generated score.

For scale, retain static publication and modularize renderer/CSS gradually. [Low-tech Magazine](https://solar.lowtechmagazine.com/2018/09/how-to-build-a-low-tech-website/) supports the low-dependency approach. [The Lookback author account](https://tympanus.net/codrops/2026/03/03/the-lookback-a-digital-capsule-for-better-off-studios-creative-past/) illustrates designing an index for growth from tens to hundreds of entries. These are architectural references, not templates to copy.
