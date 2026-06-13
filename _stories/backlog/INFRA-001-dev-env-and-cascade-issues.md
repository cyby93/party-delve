---
id: INFRA-001
title: Dev environment and cascade pipeline issues
created: 2026-06-12
priority: high
status: backlog
type: chore
---

# Dev environment and cascade pipeline issues

Discovered during GDS-001 execution. Three distinct problems that need addressing before the next story ships.

## Issue 1 — Cascade shards do not start automatically

**Observed:** After each shard completes, the workflow manager did not automatically dispatch the next shard in the pipeline. The session paused and waited for user input ("Okey, next?") instead of continuing.

**Expected:** On shard completion the workflow manager should: update shard status in story.md, exit the worktree, create the next shard's worktree, enter it, and invoke the agent — without pausing for confirmation.

**Impact:** Breaks the "fire and forget" cascade model. User has to manually prompt each transition.

**Likely cause:** The cascade-shard-mode skill does not emit a machine-readable "shard complete" signal that the workflow manager listens for; the manager waits for user input instead of reacting automatically.

## Issue 2 — TypeScript errors in WSL2 worktree context

**Observed:** Running `pnpm typecheck` (or `tsc --noEmit`) from inside a git worktree fails with "Cannot find module 'react'" / "Cannot find module 'shared-types'" for `apps/mobile-controller` and similar packages. The same command passes when run against the main repo path.

**Root cause:** pnpm workspace symlinks in `apps/*/node_modules/` use relative paths (e.g. `react -> ../../../node_modules/.pnpm/react.../react`). These relative symlinks resolve correctly from the main repo root but break from a worktree path (e.g. `.claude/worktrees/shard+*/apps/mobile-controller/node_modules/`) because the worktree doesn't have its own `node_modules`.

**Workaround applied:** Manually `ln -s <main-repo>/apps/*/node_modules <worktree>/apps/*/node_modules` before typechecking. Not sustainable at scale.

**Fix needed:** Either (a) update the cascade shard setup script to create these symlinks automatically when entering a worktree, or (b) switch to absolute pnpm symlinks, or (c) run typecheck always from the main repo root pointing at the worktree's tsconfig.

## Issue 3 — Vitest runner broken in WSL2

**Observed:** `pnpm test` (vitest) fails across all packages with:
```
Error: Cannot find module @rollup/rollup-linux-x64-gnu
```

**Root cause:** `node_modules` was installed on Windows (via pnpm in a Windows shell or VS Code terminal). The Rollup native binary for Linux (`@rollup/rollup-linux-x64-gnu`) was not installed. When running in WSL2 (Linux), the Linux binary is missing.

**Impact:** No tests can be executed in the WSL2 environment. All test results in GDS-001 shards are unverified at runtime; only typecheck was confirmed.

**Fix needed:** Run `pnpm install` once from within a WSL2 terminal (not a Windows terminal) so pnpm installs the Linux-platform native binaries. Or add `@rollup/rollup-linux-x64-gnu` to `optionalDependencies` as a platform override.

## Acceptance Criteria for follow-up task

- [ ] Cascade pipeline dispatches next shard without user intervention between shards
- [ ] `pnpm typecheck` passes inside any worktree without manual symlink steps
- [ ] `pnpm test` passes in the WSL2 shell (Vitest runs, existing tests are green)
