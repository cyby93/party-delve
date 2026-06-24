# Plan: Remove Custom Cascade, Rebuild Autonomy on GDS Workflow

**Status:** Draft — awaiting approval before execution  
**Author:** Cyby  
**Date:** 2026-06-24

---

## Problem

The custom `/run` + `/story` cascade system was built before the team understood the standard BMAD/GDS workflow. It duplicates and partially reimplements what `gds-create-story` + `gds-dev-story` + `gds-code-review` + `gds-sprint-planning` already provide — with extra indirection (the `_stories/` queue, shard files, Phase Log, workflow-manager orchestration) that adds complexity without proportional value.

The goal is to delete the custom abstraction but preserve the genuinely good ideas it introduced, then wire those ideas into the standard GDS skills to make the native flow significantly more autonomous.

---

## What Gets Deleted

### Skills (`.claude/skills/`)
| Path | Reason |
|---|---|
| `workflow-manager/` | Replaced by `gds-dev-story` + enhancements |
| `story-intake/` | Replaced by `gds-create-story` |
| `telemetry-agent/` | Duplicates standard telemetry instrumentation; no longer invoked |

### Story Queue (`_stories/`)
| Path | Reason |
|---|---|
| `_stories/backlog/` | Stories live in `_bmad-output/implementation-artifacts/` per GDS convention |
| `_stories/active/` | No more pipeline state machine |
| `_stories/done/` | Sprint status tracked in `sprint-status.yaml` |
| `_stories/blocked/` | Escalation handled inline by gds-dev-story |

> **Before deleting:** Export the GDS-001 Phase Log and shard confidence records into a brief retrospective note at `_bmad-output/implementation-artifacts/GDS-001-retro.md`. This preserves the audit trail without keeping the infrastructure.

### Spec files
| Path | Reason |
|---|---|
| `docs/specs/autonomous-cascade-story-format.md` | Custom format, no longer needed |
| `docs/specs/workflow-manager-spec.md` | Custom orchestrator spec, no longer needed |

### Implementation artifacts
All `cascade-*.md` and `spec-infra-001-cascade-auto-advance.md` files in `_bmad-output/implementation-artifacts/` can be deleted. They document work that is being undone.

---

## What to Preserve (Logic Worth Keeping)

These ideas from the custom cascade were good. They get folded into the GDS skills rather than discarded.

### 1. Confidence-gated continuation
Agents declare a confidence % in their completion note. Below 60% = HALT + explain assumptions. 60–79% = continue with a warning flag. Above 80% = silent continuation.

**Where it goes:** `gds-dev-story` — agent appends a confidence line to the story's Dev Notes section when it finishes. The skill checks it before reporting done.

### 2. Silent loop / autonomous mode
Once implementation starts, the agent does not pause between steps to narrate progress. It only surfaces output at the end or on a HALT condition (blocker, missing file, contract drift, sub-60% confidence).

**Where it goes:** `gds-dev-story` — add a SILENT RUN directive that prohibits user-facing text between task checkpoints. Only the final summary and explicit HALT conditions break silence.

### 3. Dual code review pass
Two independent `gds-code-review` passes are always run after `gds-dev-story` completes. First pass is blind (no prior findings). Second pass sees the first pass output and hunts for anything missed. Only findings confirmed by both passes are escalated; low-confidence solo findings are noted but not blocking.

**Where it goes:** Implemented as a thin wrapper script or instruction block in `gds-code-review` triggered by a `--dual` flag (or always-on for this project).

### 4. CLAUDE.md ownership enforcement
Before writing any file, the agent checks that the target path is within its `Allowed paths` per CLAUDE.md. Out-of-scope writes → HALT with an explicit message.

**Where it goes:** `gds-dev-story` — inject the relevant ownership section from CLAUDE.md into the agent's context prefix at story start.

### 5. QA two-strike recovery
If `pnpm test` or `pnpm typecheck` fails after implementation, the agent gets one self-directed retry before escalating. On retry it must identify the root cause, fix it, and re-run. If the second run also fails → escalate to user with full failure output.

**Where it goes:** `gds-dev-story` — add a post-implementation verification loop with the two-strike rule.

### 6. Contract-change gate
When a story touches `packages/shared-types` or `packages/net-protocol`, the agent must explicitly note this in Dev Notes and flag it for Protocol Architect review before the PR is considered mergeable. This maps directly to the `Contract-change hook` in CLAUDE.md.

**Where it goes:** `gds-dev-story` — at story start, scan the story's affected files list. If any match the contract paths, prepend a `CONTRACT CHANGE STORY` banner and include the compatibility checklist from CLAUDE.md.

---

## The Target Workflow (After)

```
/gds-sprint-status      → see what's next
/gds-create-story [ID]  → create a rich story file (auto-discovers artifacts, asks minimal questions)
/gds-dev-story [file]   → implement it (enhanced: silent run, confidence gate, two-strike QA, ownership check, auto-triggers code review on completion)
/gds-code-review        → three-layer adversarial review with confirmation pass on High findings (auto-triggered by dev-story)
/commit                 → user reviews diff, commits
```

These are the **standard `/gds-*` commands** — no new command layer, no wrappers. Enhancements are injected via project-level TOML overrides in `_bmad/custom/`, which the GDS customization resolver merges over the base skill defaults on every activation. The project-level files are committed and apply to all developers.

No queue. No shard files. No Phase Log. State lives in the story file and `sprint-status.yaml`, exactly as the GDS workflow intends.

---

## Enhancements to GDS Skills (Implementation Steps)

All enhancements are injected via `_bmad/custom/{skill-name}.toml` — committed, team-wide. The GDS customization resolver merges these over the base `customize.toml` in each skill on every activation. The base files are never edited.

### Step 1 — Delete custom infrastructure
Remove the three skills, the `_stories/` tree, and the two spec files listed above. Archive the GDS-001 Phase Log as a retro note first.

### Step 2 — Create `_bmad/custom/gds-dev-story.toml`

Inject five `persistent_facts` that the workflow carries for the entire run:

- **CLAUDE.md as a loaded file fact** — `file:{project-root}/CLAUDE.md` — makes all ownership rules, hook policy, and merge gates available as foundational context
- **Ownership enforcement** — before writing any file, verify path is within the story's Owner agent Allowed paths; HALT on violation
- **Contract-change detection** — at story start, scan task list for paths matching `packages/shared-types/**` or `packages/net-protocol/**`; if found, include the CLAUDE.md Contract-change hook checklist in Completion Notes and flag for Protocol Architect review
- **Silent run directive** — no user-facing output between task completions; only HALT conditions break silence
- **Two-strike QA** — on `pnpm typecheck` or `pnpm test` failure, diagnose and retry once without user input; HALT on second failure with full error log
- **Confidence gate** — append `Confidence: N%` to Completion Notes; below 60% HALT before marking `review`; 60–79% continue but flag prominently

Also set `on_complete` to automatically start `gds-code-review` on the completed story without waiting for manual invocation.

### Step 3 — Create `_bmad/custom/gds-code-review.toml`

Inject three `persistent_facts`:

- **CLAUDE.md as a loaded file fact** — makes hook policy available to the reviewer
- **Spec auto-discovery** — if no spec file is provided, find the most recently modified story with status `review` or `in-progress` in `_bmad-output/implementation-artifacts/` and use its Acceptance Criteria; never halt to ask for a spec file unless nothing is found
- **Autonomous triage** — proceed directly through triage after all review layers complete without a user confirmation gate
- **Confirmation pass on High findings** — in triage, re-read the diff lines for every High severity finding to confirm it is real; downgrade to Medium if unconfirmable; note `confirmed` or `downgraded from High` per finding

### Step 4 — Create `_bmad/custom/gds-create-story.toml`

Inject two `persistent_facts`:

- **CLAUDE.md as a loaded file fact** — makes ownership areas visible during story authoring
- **Ownership scope check** — after drafting, inspect task list for paths that cross ownership boundaries; if cross-boundary, output a one-paragraph summary and suggest splitting before saving; let the user decide
- **Minimal clarification** — exhaust all available artifacts before asking any clarifying question; target zero questions for well-documented features

---

## What This Does NOT Change

- Sprint planning (`gds-sprint-planning`) — standard, no changes needed
- Sprint status (`gds-sprint-status`) — standard, no changes needed
- Architecture decisions and ADR process — unchanged
- CLAUDE.md hook policy — unchanged; it becomes the enforcement source for gds-dev-story
- `_bmad-output/` folder structure — unchanged; story files still live in `implementation-artifacts/`

---

## Migration Note for GDS-001

GDS-001 is already done and merged. No migration needed. The done story in `_stories/done/GDS-001/` can be archived into `_bmad-output/implementation-artifacts/GDS-001-retro.md` as a brief summary, then deleted along with the rest of `_stories/`.

---

## Approval Checklist

Before executing:
- [ ] Confirm `_stories/done/GDS-001/` can be archived (no unmerged work remains)
- [ ] Confirm `_stories/backlog/INFRA-001` is truly done and can be deleted (status: done in frontmatter — yes)
- [ ] Confirm no active worktrees reference `_stories/active/`
- [ ] Confirm the three custom skills (`workflow-manager`, `story-intake`, `telemetry-agent`) are not referenced in any active sprint plan or hook
