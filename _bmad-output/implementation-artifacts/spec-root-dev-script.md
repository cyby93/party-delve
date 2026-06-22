---
title: 'Add root dev script to start all apps concurrently'
type: 'chore'
created: '2026-06-22'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** The monorepo had no single command to boot all four app dev servers; developers had to open four terminals manually.

**Approach:** Add `concurrently` as a root devDependency and a `dev` script to the root `package.json` that starts all four apps in parallel with labeled, colored output and kills all on any failure.

## Suggested Review Order

- [`package.json`](../../package.json) — new `dev` script and `concurrently` devDependency
- [`_bmad-output/implementation-artifacts/deferred-work.md`](deferred-work.md) — D15–D17 appended (startup ordering, backend-platform scope, engines.npm)
