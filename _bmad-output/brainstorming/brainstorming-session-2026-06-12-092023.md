---
stepsCompleted: [1, 2, 3, 4]
ideas_generated: [22 architectures, 2 design principles, full SCAMPER, decision tree, build list]
session_active: false
workflow_completed: true
inputDocuments: []
session_topic: 'Merging a 6-agent pattern workflow with the BMAD ecosystem for maximum autonomous operation driven by user stories'
session_goals: 'Design the most autonomous agentic workflow where the user story is the only required input; agents transform the story and delegate tasks to each other'
selected_approach: 'progressive-flow'
techniques_used: ['What If Scenarios', 'Mind Mapping', 'SCAMPER Method', 'Decision Tree Mapping']
context_file: ''
---

## Session Overview

**Topic:** Merging a 6-agent pattern workflow with the BMAD ecosystem for maximum autonomous operation driven by user stories
**Goals:** Design the most autonomous agentic workflow where the user story is the only required input; agents transform the story and delegate tasks to each other

### Session Setup

Fresh session started 2026-06-12 at 09:20. Topic and goals pre-loaded from skill arguments.

---

## Phase 2 — Pattern Recognition (Mind Map)

**Central concept: Story → Autonomous Agent Cascade**

```
Story → Autonomous Agent Cascade
│
├── ENTRY POINTS
│   ├── /story ──► Intake Dialog ──► _stories/backlog/ (status: ready)
│   └── /run ───► Dispatcher ──────► _stories/active/  (status: running)
│
├── BMAD ECOSYSTEM BRIDGES
│   ├── /story          maps to ──► new BMAD skill (wraps gds-create-story)
│   ├── /run            maps to ──► new BMAD skill (workflow-manager)
│   ├── Orchestrator    maps to ──► bmad-agent-pm (extended)
│   ├── Proto Architect maps to ──► bmad-agent-architect (extended)
│   ├── 3 Dev agents    maps to ──► gds-agent-game-dev (parameterized ×3)
│   ├── QA Agent        maps to ──► bmad-qa-generate-e2e-tests (adapted)
│   ├── Telemetry Agent maps to ──► new skill (QA-gated)
│   └── project-brief   maps to ──► _bmad-output/ convention (existing)
│
├── STORY LIFECYCLE
│   draft → ready → active → [shard loop] → qa-review → telemetry → done
│                                ↑ retry (max 2)       ↓ fail
│                           Orchestrator ◄──── QA error report
│
├── RESILIENCE LAYER
│   ├── Confidence scores (per shard completion)
│   ├── Two-tier escalation (inter-agent vs user)
│   ├── Two-strike QA recovery ceiling
│   └── Silent-by-default Phase Log
│
└── SHARED CONTEXT
    ├── project-brief.md (domain sections, auto-updated)
    └── Story YAML frontmatter (routing, deps, pipeline declaration)
```

---

## Phase 3 — SCAMPER Analysis

| Letter | Decision |
|---|---|
| **S - Substitute** | 5 of 7 roles covered by existing BMAD/GDS agents. Only Telemetry Agent and Dispatcher are genuinely new. |
| **C - Combine** | Orchestrator + Dispatcher = one Workflow Manager (`bmad-agent-pm` extended). Three dev agents = one parameterized `gds-agent-game-dev`. |
| **A - Adapt** | Story format extended with cascade metadata. `/story` wraps `gds-create-story`. CLAUDE.md ownership section becomes executable routing config. |
| **M - Modify** | `bmad-agent-pm` gains programmatic mode — reads from story frontmatter, writes structured YAML + Phase Log, runs as persistent scan loop. |
| **P - Put to other uses** | `bmad-shard-doc` repurposed as story decomposition engine called by Workflow Manager. |
| **E - Eliminate** | Manual agent invocation. Separate task tracking system. Fixed 6-agent count. All replaced by story-file-as-task-board and dynamic pipeline. |
| **R - Reverse** | System holds project memory, briefs user at `/story` time. Conversation generates story files — user never writes YAML manually. |

---

## Phase 4 — Decision Tree

### `/story` Flow
```
/story "text"
  → Load project-brief.md (relevant sections)
  → Intake dialog (3-5 clarifying questions)
  → Call gds-create-story
  → Show amplified story for approval
  → APPROVED: save to _stories/backlog/ (status: ready) ✓
  → REJECTED: loop back with rejection notes
```

### `/run` Flow
```
/run [story-id]
  → Pre-flight: scan backlog, detect dependencies, confirm order [USER TOUCHPOINT]
  → Decompose: bmad-shard-doc → N child shards with depends_on graph
  → Protocol Architect eval: action: none OR update contracts
  → Developer shards in parallel worktrees (gds-agent-game-dev + role config)
      └── Each: EnterWorktree → implement → confidence score → ExitWorktree
  → Merge worktrees (Workflow Manager)
  → QA Gate: pass → Telemetry Agent
             fail (retry < 2) → Orchestrator analyzes → fix shard → retry devs
             fail (retry = 2) → ESCALATE TO USER
  → Telemetry Agent (QA-gated)
  → Wrap up: merge to feature branch, open PR, update project-brief.md
  → Silent completion ✓
```

### Build List
```
SKILL FILES NEEDED          TYPE        BASIS
─────────────────────────   ─────────   ──────────────────────────
/story (intake-dialog)      NEW         wraps gds-create-story
/run (workflow-manager)     NEW*        extends bmad-agent-pm
telemetry-agent             NEW         built from scratch
─────────────────────────   ─────────   ──────────────────────────
gds-create-story            ADAPT       add context loading
bmad-shard-doc              ADAPT       new caller + input shape
bmad-agent-architect        ADAPT       add eval/no-op mode
gds-agent-game-dev          ADAPT       add role config injection
bmad-qa-generate-e2e-tests  ADAPT       add structured pass/fail output
```
**3 new skills. 5 adaptations.**

---

## Phase 1 — Expansive Exploration (What If Scenarios)

**[Architecture #1]: The Story Amplifier Gate**
_Concept_: Intake agent receives raw user story → asks targeted clarifying questions → generates a fully elaborated story (acceptance criteria, context, edge cases, non-goals). User reviews and approves this amplified story. That review is the ONE intentional touchpoint. After approval, the cascade runs autonomously.
_Novelty_: Concentrates human input into one high-value review moment rather than eliminating it. Quality of the entire cascade is determined here.

**[Architecture #2]: Two-Phase Story Format**
_Concept_: During intake and review, the story lives as markdown — human-readable, user can edit directly. On approval, compiled into a hybrid artifact: rich markdown body for reference, structured YAML frontmatter that agents parse for routing, ownership, acceptance criteria, and dependencies.
_Novelty_: Format itself acts as a state machine — markdown = "in review", hybrid = "approved and live". Agents know a story is ready purely from its structure.

**[Architecture #3]: Ownership-Driven Routing**
_Concept_: Story frontmatter declares `owner:` matching CLAUDE.md agent roles exactly. A dispatcher or the agent itself reads this field to determine who acts. The story file IS the work ticket — no separate task system needed.
_Novelty_: CLAUDE.md ownership rules become executable routing logic, not just documentation.

**[Architecture #4]: Model B — Single Dispatch Orchestrator**
_Concept_: One lightweight router agent is the only persistent actor. It scans for `status: approved` stories, matches `owner:` to the right specialist agent, and invokes it on demand. Specialist agents are stateless — they wake up, do work, and exit.
_Novelty_: Clean separation — "knowing what to do next" (dispatcher) vs "knowing how to do it" (specialist). One obvious place to debug routing failures.

**[Architecture #5]: Story-as-State-Machine with Phase Log**
_Concept_: Frontmatter stays lean — only `status`, `current_owner`, `next_owner` for routing. Markdown body accumulates a `## Phase Log` where each completing agent appends a timestamped summary. Machine reads frontmatter; human reads the log.
_Novelty_: Git history gives diffs; phase log gives intent. Story file becomes a self-documenting audit trail without bloating routing data.

**[Architecture #6]: Conditional Agent Pipeline**
_Concept_: 6-agent sequence is always: Orchestrator → Protocol Architect → [subset of 3 devs] → QA. Fixed bookends always run. Middle is variable — declared by Orchestrator based on story scope.
_Novelty_: Pipeline is a template with optional slots, not a fixed chain. Matches how real projects work.

**[Architecture #7]: Orchestrator as Story Decomposer**
_Concept_: Orchestrator actively splits the amplified story into agent-specific shards. Each shard is a focused child story with full context but only the relevant tasks for that agent. Parent story tracks completion of all children.
_Novelty_: User writes one story; system fans it into N parallel workstreams. Orchestrator replaces the senior tech lead's sprint planning role.

**[Architecture #8]: Dependency-Aware Shard Dispatcher**
_Concept_: Orchestrator declares each shard's dependencies as a list in frontmatter (`depends_on: [shard-A]`). Dispatcher maintains a ready queue — shard enters only when all dependencies are `status: complete`. Parallel shards launch as soon as their dependencies clear.
_Novelty_: Turns a strictly sequential chain into a dynamic execution graph with no changes to the agents themselves.

**[Architecture #9]: Silent-by-Default with Curiosity Mode**
_Concept_: Cascade runs silently. Phase Log updates in background — always readable, never demanding attention. System only interrupts for genuine blockers: ambiguous requirement, failed contract test, ownership conflict.
_Novelty_: Respects user attention as the scarce resource. System earns interruptions rather than defaulting to them.

**[Architecture #10]: Two-Tier Escalation Model**
_Concept_: Blockers classified by blast radius. Single-agent scope → agents self-resolve via inter-agent routing. Cross-agent scope or new surface area → pause cascade, surface focused question to user. User answers once, cascade resumes.
_Novelty_: Escalation threshold defined by how many agents the resolution affects — simple rule agents can evaluate themselves.

**[Architecture #11]: Agent Confidence Transparency**
_Concept_: Every completing agent appends a confidence score (0-100%) and explicit assumption list to its Phase Log entry. Dispatcher configurable: below threshold X, auto-escalate before proceeding; above it, continue silently. User sets threshold once.
_Novelty_: Turns implicit agent uncertainty into explicit, queryable data. Scan Phase Log to see where system guessed vs. where it was certain.

**[Architecture #12]: Git Worktree Per Shard**
_Concept_: Each parallel shard gets its own worktree branch via Claude Code's EnterWorktree. Sequential shards branch from their dependency's completed branch. Dispatcher handles merges when dependency gates clear. QA agent reviews final merged result. One clean PR surfaces to user.
_Novelty_: True parallelism with zero file conflicts. Branch topology IS the dependency graph made visible in git history.

**[Architecture #13]: Intake as Interactive Dialog**
_Concept_: `/story` launches a structured dialog. Intake agent asks focused clarifying questions, builds amplified story in real-time, shows result, gets approval. Then disappears and cascade begins. Dialog IS the one touchpoint, designed to be fast and purposeful.
_Novelty_: Entry point feels like talking to a senior engineer, not filling a ticket.

**[Architecture #14]: Living Project Brief**
_Concept_: Persistent `project-brief.md` at repo root captures current understood state at medium/high level. Domain sections (Combat, Movement, UI, Networking). Every completing shard auto-appends its domain summary. Every agent loads relevant sections at startup for instant project context.
_Novelty_: Replaces per-agent onboarding cost. Agents start informed, not blank. Brief becomes shared memory of the entire system across all stories.

**[Architecture #15]: Decoupled Story Authoring vs Execution**
_Concept_: `/story` only creates — runs intake dialog, saves to `_stories/backlog/` with `status: ready`, stops. `/run` or `/run <story-id>` tells dispatcher to start a specific story. Authoring and execution are completely independent.
_Novelty_: You control the start, not the system. Build tomorrow's backlog today while today's cascade runs.

**[Architecture #16]: Story Backlog as Prioritized Queue**
_Concept_: `_stories/backlog/` is the queue. Stories have `priority:` field. `/run` without arguments starts highest-priority ready story. `/run list` shows full backlog with status at a glance.
_Novelty_: Sprint planning built into the filesystem.

**[Architecture #17]: Automatic Dependency Detection**
_Concept_: Analyzer scans all ready stories and flags likely dependencies based on overlapping ownership areas, shared contracts, or matching domain keywords. Surfaces suggestions ("Story B touches files Story A also modifies — suggested: B after A"). User confirms, overrides, or dismisses.
_Novelty_: System sees dependencies you can't see at authoring time. Catches conflicts before two shards touch the same files.

**[Architecture #18]: Dependency Conflict Pre-Flight**
_Concept_: Before any cascade starts, dispatcher runs pre-flight across full backlog — detects file overlap, flags contract changes that would break in-progress shards, surfaces dependency map for approval. One confirmation unlocks the entire queue execution plan.
_Novelty_: Shifts conflict discovery from runtime (broken merge) to pre-flight (before anything runs).

---

## Idea Organization by Theme

### Theme 1: Story Lifecycle & Format
*How a raw idea becomes a machine-executable work order*
- Story Amplifier Gate — one concentrated human touchpoint, then full autonomy
- Two-Phase Story Format — markdown for humans, YAML frontmatter for agents
- Intake as Interactive Dialog — `/story` feels like talking to a senior engineer
- Decoupled Authoring vs Execution — `/story` creates, `/run` starts
- `/story` wraps `gds-create-story` — thin wrapper, not a rebuild
- Conversation as Story Generation — user never writes YAML manually

### Theme 2: Workflow Manager & Routing
*The brain of the autonomous cascade*
- Ownership-Driven Routing — CLAUDE.md ownership becomes executable routing logic
- Single Dispatch Orchestrator (Model B) — one persistent router, stateless specialists
- Story-as-State-Machine — `status` + `current_owner` + Phase Log drives everything
- Conditional Agent Pipeline — Orchestrator declares exactly who runs and when
- Orchestrator + Dispatcher = Workflow Manager — one agent, not two
- CLAUDE.md as Executable Routing Config — zero duplication, one source of truth
- `bmad-agent-pm` Programmatic Mode — same agent, new operating mode

### Theme 3: Decomposition & Parallelism
*Fan one story into parallel workstreams*
- Orchestrator as Story Decomposer — one story fans into N agent-specific shards
- Dependency-Aware Shard Dispatcher — parallel shards launch as dependencies clear
- Git Worktree Per Shard — true parallelism, zero file conflicts
- Automatic Dependency Detection — system sees conflicts you can't at authoring time
- Dependency Conflict Pre-Flight — catch conflicts before anything runs
- `bmad-shard-doc` as Decomposition Engine — repurposed, not rebuilt
- One Parameterized `gds-agent-game-dev` — single skill, role injected at runtime

### Theme 4: Resilience & Quality
*Autonomous but not blind*
- Silent-by-Default with Curiosity Mode — Phase Log always readable, never demanding
- Two-Tier Escalation — inter-agent for small blockers, user only for cross-agent scope
- Agent Confidence Transparency — every shard declares certainty + assumptions made
- Evaluate-vs-Execute Distinction — Protocol Architect always consulted, never forced
- QA Gate + Telemetry Dependency — Telemetry only runs on verified code
- Orchestrator-Mediated QA Recovery Loop — failure routes back through Orchestrator
- Two-Strike Recovery Ceiling — two auto-retries, then human escalation

### Theme 5: Context & Memory
*The system remembers so you don't have to*
- Living Project Brief — domain-sectioned, auto-updated after every completed story
- Story Backlog as Prioritized Queue — `_stories/backlog/` IS your sprint board
- System as Project Memory Holder — system briefs you at `/story` time
- BMAD-First Design Principle — existing agents preferred, custom only when necessary
- Three Things Eliminated — manual invocation, separate task tracking, fixed agent count

### Breakthrough Concepts
1. **Story-as-State-Machine** — the story file is simultaneously ticket, routing config, pipeline declaration, and audit trail
2. **CLAUDE.md as executable config** — human-readable documentation becomes the routing engine
3. **Two-strike QA recovery** — autonomy with a hard backstop
4. **Conversation generates stories** — user never writes a story file manually

---

## Action Plan

### Priority 1 — Story Lifecycle & Format
1. Write `docs/specs/autonomous-cascade-story-format.md` — extended frontmatter spec
2. Create `_stories/backlog/` and `_stories/active/shards/` folder conventions
3. Build `/story` skill — wraps `gds-create-story`, adds context loading + approval loop + backlog placement
4. Create `project-brief.md` with initial domain sections

**Success indicator:** `/story "add combat system"` → answer questions → approve → story file in `_stories/backlog/`

### Priority 2 — Workflow Manager & Routing
1. Write `docs/specs/workflow-manager-spec.md`
2. Build `/run` skill — extends `bmad-agent-pm` with scan loop, pre-flight, shard launching, Phase Log, recovery loop
3. Write CLAUDE.md ownership parser → role config generator

**Success indicator:** `/run` picks up a ready story, runs pre-flight, invokes correct agents in correct order

### Priority 3 — Context & Memory
1. Define `project-brief.md` schema and update format
2. Wire auto-update into `/run` wrap-up step
3. Wire brief loading into `/story` intake

**Success indicator:** Second `/story` invocation correctly references what was built in the first feature

### Priority 4 — Decomposition & Parallelism
1. Adapt `bmad-shard-doc` call signature and output shape
2. Add `depends_on` graph declaration to decomposition step
3. Adapt `gds-agent-game-dev` for role config injection
4. Wire `EnterWorktree` / `ExitWorktree` per shard

**Success indicator:** Story touching sim + host spawns two parallel worktrees, merges when both complete

### Priority 5 — Resilience & Quality
1. Adapt `bmad-qa-generate-e2e-tests` — add structured pass/fail output
2. Build `telemetry-agent` skill — QA-gated
3. Add confidence score emission to `gds-agent-game-dev`
4. Add two-strike recovery loop to Workflow Manager

**Success indicator:** QA fails → Workflow Manager auto-routes fix → retries → succeeds, no user involvement

---

## Final Build List

```
PHASE   SKILL / ARTIFACT                    TYPE
──────  ──────────────────────────────────  ──────────
1       autonomous-cascade-story-format.md  SPEC (new)
1       /story (intake-dialog)              SKILL (new)
1       project-brief.md                    ARTIFACT (new)
2       workflow-manager-spec.md            SPEC (new)
2       /run (workflow-manager)             SKILL (new)
3       project-brief auto-update           WIRED INTO /run
4       bmad-shard-doc                      ADAPT
4       gds-agent-game-dev                  ADAPT
5       bmad-qa-generate-e2e-tests          ADAPT
5       telemetry-agent                     SKILL (new)
5       confidence scoring                  WIRED INTO gds-agent-game-dev
```

**Total: 3 new skills, 2 new specs, 2 adaptations, 2 wired behaviours.**

---

## Session Summary

**Session:** 2026-06-12 — Autonomous BMAD Agent Cascade Design
**Techniques:** What If Scenarios → Mind Mapping → SCAMPER → Decision Tree Mapping
**Outcome:** Complete architecture for a story-driven autonomous multi-agent workflow built on the BMAD/GDS ecosystem

**Key insight:** The system that emerged is not 6 custom agents bolted together — it is the BMAD ecosystem with a thin autonomous orchestration layer on top. The user's one required input is a short conversation. Everything else is autonomous.

**Breakthrough moment:** Realising that CLAUDE.md's ownership rules are already a routing table — they just needed a reader.
