# Production Contract V3 — Amendment A1

Status: `APPROVED / CANONICAL UPON MERGE`

## Identity

- Amendment: `A1 — final-refresh deadline`
- Human approval recorded: `2026-08-25T11:43:38+08:00` (`Asia/Shanghai`)
- Effective publication date: `2026-08-26`
- Amendment commit: the commit containing this file and the A1 decision-log record
- Base contract: `docs/PRODUCTION_CONTRACT_V3.md`

## Amended rule

For publication dates through `2026-08-25`, the original V3 final-refresh window remains `06:00–08:30` Shanghai time.

For publication dates on or after `2026-08-26`, the mandatory publication-day final refresh must be completed within `06:00–15:00` Shanghai time, with the research lock deadline fixed at `15:00`. Freshness remains measured against the actual `research_locked_at` timestamp.

If the active deadline is missed, record the actual later refresh and lock time; never backdate it. The candidate remains fail-closed under the existing V3 evidence and deployment rules.

## Boundary

A1 changes only the final-refresh deadline. It does not authorize Preview dispatch, Pages changes, production deployment, unattended publication, daily GitHub Actions schedules, private-data movement, HarryTone changes, or reclassification of earlier issues.

Library V2 remains frozen historical V2. All unamended V3 rules remain in force.
