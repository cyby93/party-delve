---
id: INFRA-001
title: Dev environment and cascade pipeline issues
created: 2026-06-12
updated: 2026-06-13
priority: medium
status: done
type: chore
---

# Dev environment and cascade pipeline issues

Discovered during GDS-001 execution. Three distinct problems that need addressing before the next story ships.

## Issue 1 — Cascade shards do not start automatically

**Status: RESOLVED 2026-06-13**

**Root cause:** `step-03-dispatch.md` had no explicit prohibition on producing user-facing output between loop iterations. The LLM naturally ended its turn after each agent call completed, requiring user input to continue.

**Fix applied:** Added three blocks to `.claude/skills/workflow-manager/steps/step-03-dispatch.md`:
1. **Dispatch Plan** — prints all developer shards (ID, owner, dependency order) once before the loop, with HALT carve-out noted explicitly.
2. **SILENT LOOP directive** — prohibits user-facing output between shard completions; instructs the model not to end its turn between iterations.
3. **Final summary** — the only permitted post-loop output; shows confidence per shard.

Also added: Phase Log baseline (`pre_count`) before agent invocation to reliably detect missing entries, missing-confidence-tag HALT edge case, and explicit `[C]`-after-low-confidence status write.

**Verified:** Manual review of updated file confirms all four acceptance criteria additions are present. Spec and deferred-work log at `_bmad-output/implementation-artifacts/`.

## Issue 2 — TypeScript errors in WSL2 worktree context

**Status: RESOLVED 2026-06-13**

**Root cause:** pnpm uses relative symlinks that break from worktree paths.

**Fix applied:** Migrated from pnpm to npm workspaces. npm hoists packages to root `node_modules` and uses absolute-compatible symlinks, so worktrees resolve them correctly without manual steps. Verified: `npm run typecheck` passes across all workspaces from the repo root.

## Issue 3 — Vitest runner broken in WSL2

**Status: RESOLVED 2026-06-13**

**Root cause:** `node_modules` was installed on Windows; Linux Rollup native binary (`@rollup/rollup-linux-x64-gnu`) was absent.

**Fix applied:**
1. Added `.npmrc` with `legacy-peer-deps=true` — npm v11.12.1 has a bug where it throws `Invalid Version` on `canvas@^3.0.0` (optional peer dep of jsdom/vitest) because canvas publishes non-standard pre-release tags like `3.0.0-rc1b`. This flag bypasses that code path.
2. Deleted all `node_modules` + `package-lock.json` — the Windows-built tree triggered a secondary arborist dedup error.
3. Ran `npm install` fresh from WSL2 — installed the Linux rollup binary.

**Verified:** 27/27 tests green (`npm run test`). `@rollup/rollup-linux-x64-gnu` confirmed present in `node_modules/@rollup/`.

## Acceptance Criteria

- [x] Cascade pipeline dispatches next shard without user intervention between shards
- [x] `npm run typecheck` passes inside any worktree without manual symlink steps
- [x] `npm run test` passes in the WSL2 shell (Vitest runs, 27/27 tests green)
