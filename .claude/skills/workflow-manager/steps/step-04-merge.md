# Step 04 — Worktree Merge

## Purpose

Merge all completed shard worktrees into a single `feature/{story-id}` branch, auto-resolving non-overlapping conflicts and escalating judgment calls to the user.

---

## Instructions

### 1. Create Feature Branch

Create and check out `feature/{story-id}` from the current base branch (usually `main` or the active sprint branch):
```
git checkout -b feature/{story-id}
```

If the branch already exists (resume scenario): check it out and continue from the last merged shard.

### 2. Determine Merge Order

Merge order = reverse dependency order: shards with no dependents merge first (they are the "leaves" of the dependency graph).

For the default pipeline:
1. `shard-protocol-architect` (if in pipeline)
2. `shard-simulation-engineer` (if in pipeline)
3. `shard-host-engineer` (if in pipeline)
4. `shard-mobile-engineer` (if in pipeline)
5. Any micro-shards (merged after the role they belong to)

Note: qa-agent and telemetry-agent shards do NOT have worktrees — they run on the feature branch directly.

### 3. Merge Each Shard

For each shard in merge order, only if its `status: complete`:

```
git merge shard/{story-id}-{shard-id} --no-edit -m "Merge shard {shard-id} into feature/{story-id}"
```

**On clean merge:** Continue to next shard.

**On merge conflict:**

Check the conflicting files:
- **Non-overlapping conflicts** (e.g. two shards added different functions to the same file): auto-resolve by accepting both changes (`git checkout --theirs` for the conflicting sections, then manually reconstruct combining both versions). Continue.
- **Semantic conflicts** (same function modified differently, or the same type changed in two different ways): surface to user:
  ```
  ⚠ Merge conflict requires judgment.
  
  File: {file path}
  Conflict between: shard-{A} ({role-A}) and shard-{B} ({role-B})
  
  --- {role-A} version ---
  {their diff}
  
  --- {role-B} version ---
  {their diff}
  
  [K] Keep {role-A} version
  [T] Keep {role-B} version
  [M] Merge manually (provide the resolved content)
  ```
  HALT until user resolves. Apply the resolution and continue.

### 4. Clean Up Shard Branches

After all shards are merged, delete the local shard branches:
```
git branch -d shard/{story-id}-{shard-id}
```
Do this for each shard that was merged.

### 5. Phase Log Entry

Append to `## Phase Log` in the parent story:
```
### Workflow Manager — {datetime} [Merge]
Merged shards: {list of shard-ids}
Conflicts: {none | list of files with resolution method}
Feature branch: feature/{story-id}
```

### 6. Route

Proceed to: `./step-05-qa-gate.md`
