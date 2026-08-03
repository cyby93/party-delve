---
baseline_commit: 95469a2
---

# Story 2.10: Remove Training-Dummy POI

Status: review

## CLAUDE.md Required Task Header

```
Phase: E2 — Hub World & Class Selection (Story 2.10 — POI cleanup, no new features)
Context: Story 2.8 (hub-ability-use-outside-training-dummy-poi, 2026-07-15) removed the
  `nearPoiId === 'training-dummy'` gate on ability firing, making abilities work anywhere in
  the hub — but explicitly deferred removing the training-dummy POI itself ("repurposing the
  POI is out of scope for this story"). Scoped in by the 2026-08-03 correct-course review of
  the user's own TODO.md notes (sprint-change-proposal-2026-08-03.md, item 2): the POI is now
  visually and mechanically inert — it still renders, still sends `poi:entered`/`poi:exited`
  and shows an "Interact" prompt, but interacting with it does nothing a player couldn't
  already do standing anywhere else in the hub. This story removes the POI entirely (data +
  render cleanup), not just its already-removed ability gate.

  Verified against current source before scoping (do not re-derive from epics.md alone):
  - `packages/shared-types/src/poi.ts`: `PoiType.TRAINING_DUMMY` (line 3) and the
    `training-dummy` entry in `HUB_POIS` (line 19, `{ id: 'training-dummy', x: 1520, y: 400,
    radius: 120, type: PoiType.TRAINING_DUMMY }`). `INTERACTIVE_HUB_POIS` (line 24) is just
    `HUB_POIS` aliased — removing the entry from `HUB_POIS` removes it from both arrays.
  - `apps/simulation-server/src/rooms/GameRoom.ts:379` (`for (const poi of
    INTERACTIVE_HUB_POIS)`) iterates the shared array generically — confirmed no
    training-dummy-specific branching inside that loop. No sim-server code change needed.
  - `apps/host-client/src/screens/HubWorldScreen.tsx` has exactly 4 training-dummy-specific
    sites (all in the `renderFrame` function and the POI-graphics init effect — read the full
    file before editing):
    - Lines 104–114: the "training dummy targeting indicator" block — computes
      `anyNearDummy`, looks up `poiGraphics.get('training-dummy')`, and draws/strokes its
      highlight ring when a player is near.
    - Line 148: `poi.type === PoiType.TRAINING_DUMMY ? 0xc07d35` in the POI-icon color ternary
      (init effect, drawing static POI icons once).
    - Line 158: `poi.type === PoiType.TRAINING_DUMMY ? 'TRAIN'` in the POI-icon label ternary
      (same init effect).
  - `tests/e2e/hub-ability-use.test.ts:11` has a comment mentioning the string
    `'training-dummy'` — it's historical prose describing the pre-2.8 gate this test exists to
    prove is gone, not a live code reference. No test assertion in the file reads
    `nearPoiId`/POI id against `'training-dummy'`. Leave the comment as-is unless it becomes
    actively misleading — not a hard AC requirement, this is a comment not a code path.
  - No test anywhere asserts `HUB_POIS`/`INTERACTIVE_HUB_POIS` length or enumerates POI types
    (confirmed via repo-wide grep) — removing the entry carries zero test-regression risk.

Owner agent: Host Experience Engineer (both files — `packages/shared-types/src/poi.ts` and
  `apps/host-client/src/screens/HubWorldScreen.tsx`).

  OWNERSHIP NOTE (do not skip): `poi.ts` lives under `packages/shared-types`, which CLAUDE.md
  and project-context.md assign to the Protocol Architect, not Host Experience Engineer. This
  story was explicitly scoped as a single-owner exception during the 2026-08-03 correct-course
  review (sprint-change-proposal-2026-08-03.md §4/§5): the shared-types edit is pure data
  removal (deleting one array entry + one now-unused enum member, no shape/contract change),
  so the proposal calls for a Protocol Architect "fast-path glance" — a review, not a separate
  implementation task — rather than splitting this into two stories. Do the `poi.ts` edit as
  part of this story's Task 1; flag it for Protocol Architect review before merge instead of
  routing it through a second story.

Goal: Remove the training-dummy POI (data + host render) so the hub has exactly 2 POIs
  (class-select, dungeon-entrance) and no interact prompt, chat bubble, or targetable visual
  ever appears for a training-dummy again.

Allowed paths:
  - packages/shared-types/src/poi.ts                       (Task 1 — data removal)
  - apps/host-client/src/screens/HubWorldScreen.tsx         (Task 2 — render cleanup)

Blocked paths:
  - apps/simulation-server/**  (no change needed — confirmed the POI sensor loop is generic)
  - apps/mobile-controller/**  (unrelated to this story; see Story 2.11 for the mobile fix
    scoped in the same correct-course review)
  - packages/net-protocol/**, packages/game-rules/**  (no contract or rule change)
  - tests/**  (no test currently depends on the removed entry; do not add scope)
  - sprint-status.yaml  (updated by the create-story workflow itself)

Inputs:
  - packages/shared-types/src/poi.ts (read in full — only 25 lines)
  - apps/host-client/src/screens/HubWorldScreen.tsx (read the full `renderFrame` function,
    lines 35–115, and the POI-icon init loop, lines 145–172, before editing)
  - _bmad-output/planning-artifacts/epics.md — "Story 2.10: Remove Training-Dummy POI" section
    (Epic 2 Correction) for the source AC text
  - _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md — item 2, full
    rationale and ownership decision

Non-goals:
  - No replacement POI or repurposing of the freed hub space (explicit non-goal in epics.md).
  - No change to `poi:entered`/`poi:exited` event shapes or any other POI's behavior
    (class-select, dungeon-entrance are untouched).
  - No sim-server change — the generic `INTERACTIVE_HUB_POIS` loop needs nothing.

Acceptance criteria:
  1. `PoiType.TRAINING_DUMMY` and the `training-dummy` entry are removed from
     `packages/shared-types/src/poi.ts`; `HUB_POIS` has exactly 2 entries (`class-select`,
     `dungeon-entrance`).
  2. `HubWorldScreen.tsx`'s training-dummy targeting-indicator block (`anyNearDummy`,
     `dummyEntry` lookup/draw at lines 104–114) is removed.
  3. `HubWorldScreen.tsx`'s POI-icon color and label ternaries (lines 148, 158) no longer
     branch on `PoiType.TRAINING_DUMMY` — collapse each to the remaining 2-way case
     (`CLASS_SELECT` vs. `DUNGEON_ENTRANCE`).
  4. No remaining reference to `PoiType.TRAINING_DUMMY` or the string `'training-dummy'`
     exists in `packages/shared-types/**` or `apps/host-client/**` (verify via grep after
     editing).
  5. `npm run typecheck` passes with zero errors; existing test suites (host-client has no
     component tests today — confirm this is still true and not a regression) show no new
     failures.
  6. Manual visual check: walking the hub in a running host client shows exactly 2 POI icons
     (CLASS, GATE labels) — no TRAIN icon, no interact prompt or chat bubble ever appears for
     a training dummy.

Required hooks: Client-UX hook (host HUD/couch readability — confirm the remaining 2 POI
  icons still render correctly with the removed dummy gone; no joystick/skill-mapping impact,
  this story doesn't touch mobile). Protocol Architect fast-path review required for the
  `poi.ts` change per the OWNERSHIP NOTE above (pure data removal, not a contract-change-hook
  trigger — no shape change, no new/changed message type).
Required tests: None new. Confirm `npm run typecheck` and existing suites stay green — no
  test today depends on the removed entry.
Telemetry impact: None — no new user-facing flow, no new event. `poi:entered`/`poi:exited`
  simply stop firing for the removed POI id, which is the intended behavior change.
```

---

## Story

As a player,
I want the hub to no longer have a training-dummy POI with no purpose,
so that the hub isn't cluttered with an interactive zone that does nothing Story 2.8 didn't
already make possible everywhere.

---

## Acceptance Criteria

**AC1 — Data removal:**
**Given** `HUB_POIS` (`packages/shared-types/src/poi.ts:19`) currently includes a
`training-dummy` entry
**When** this story ships
**Then** the `training-dummy` entry and the now-unused `PoiType.TRAINING_DUMMY` value are
removed
**And** no sim-server code change is needed — `GameRoom.ts`'s POI sensor loop
(`GameRoom.ts:379`) iterates `INTERACTIVE_HUB_POIS` generically, so removing the entry from
the shared array removes the sensor with it

**AC2 — Host render cleanup:**
**Given** `HubWorldScreen.tsx`'s POI rendering (dummy targeting-indicator block at
`renderFrame` lines 104–114, the `TRAINING_DUMMY`-conditional color/label ternaries at line
148 / line 158)
**When** this story ships
**Then** this dummy-specific render code is removed along with the POI

**AC3 — No dangling references:**
**Given** the hub now has 2 POIs (class-select, dungeon-entrance)
**When** a player walks the hub
**Then** no interact prompt, chat bubble, or targetable visual ever appears for a
training-dummy POI, and no other code path still references `PoiType.TRAINING_DUMMY` or the
string `'training-dummy'`

**Non-goals:** no replacement POI or repurposing of the freed hub space — out of scope for
this story.

---

## Tasks / Subtasks

- [x] **Task 1 (AC1):** `packages/shared-types/src/poi.ts` —
  - Remove the `TRAINING_DUMMY = 'training-dummy'` member from the `PoiType` enum (line 3).
  - Remove the `{ id: 'training-dummy', x: 1520, y: 400, radius: 120, type:
    PoiType.TRAINING_DUMMY }` entry from `HUB_POIS` (line 19). `HUB_POIS` now has exactly 2
    entries. Leave `INTERACTIVE_HUB_POIS` (`= HUB_POIS`) and everything else in the file
    unchanged.
- [x] **Task 2 (AC2, AC3):** `apps/host-client/src/screens/HubWorldScreen.tsx` —
  - In `renderFrame` (lines 104–114): delete the `anyNearDummy` computation, the
    `poiGraphics.get('training-dummy')` lookup, and the entire `if (dummyEntry) { ... }` block
    that draws/strokes the dummy highlight ring.
  - In the POI-icon init loop (~line 145 onward): collapse the color ternary at line 148
    (`poi.type === PoiType.CLASS_SELECT ? 0x6ea8d8 : poi.type === PoiType.TRAINING_DUMMY ?
    0xc07d35 : 0x36334a`) to a 2-way ternary (`poi.type === PoiType.CLASS_SELECT ? 0x6ea8d8 :
    0x36334a` — the remaining `else` branch is `DUNGEON_ENTRANCE`, keep its existing color).
    Do the same for the label ternary at line 158 (`poi.type === PoiType.CLASS_SELECT ?
    'CLASS' : poi.type === PoiType.TRAINING_DUMMY ? 'TRAIN' : 'GATE'` → `poi.type ===
    PoiType.CLASS_SELECT ? 'CLASS' : 'GATE'`).
  - Remove the now-unused `PoiType` import member if `PoiType.TRAINING_DUMMY` was its only
    remaining runtime reference — `PoiType.CLASS_SELECT` is still used, so keep the `PoiType`
    import itself.
- [x] Grep the repo for `PoiType.TRAINING_DUMMY` and `'training-dummy'` after editing; confirm
  the only remaining hit is the historical comment in `tests/e2e/hub-ability-use.test.ts:11`
  (out of scope — see Dev Notes).
- [x] Run `npm run typecheck` from repo root; verify zero errors.
- [x] Run the full test suite; verify no regressions (host-client has no component tests
  today — this is expected, not a gap introduced by this story).
- [ ] Manually run the host client + at least one mobile controller against a local hub
  session; confirm exactly 2 POI icons render (CLASS, GATE) and no training-dummy interact
  prompt/chat bubble/highlight ring ever appears.

---

## Dev Notes

### Why this story exists now, and why it's small

Story 2.8 removed the *behavioral* reason to visit the training-dummy POI (abilities already
fire everywhere in the hub) but explicitly left the POI's zone, interact button, and
targetable visuals in place — "repurposing the POI is out of scope for this story." This
story finishes that cleanup: delete the POI, not just its now-redundant gate. There's no
sim-server change because `GameRoom.ts:379`'s sensor loop already iterates the shared POI
array generically — it never had training-dummy-specific logic to remove.

### Ownership: single-owner exception, not a split

This story touches `packages/shared-types` (Protocol Architect's area) and
`apps/host-client` (Host Experience Engineer's area) — normally a cross-boundary story that
CLAUDE.md's Ownership Rules would require splitting or escalating. The 2026-08-03
correct-course review considered this explicitly and decided **not** to split it: the
`poi.ts` change is pure deletion of a data entry and an unused enum member, with no shape or
contract change, so it doesn't rise to the level of the Contract-Change Hook. Implement both
files as Host Experience Engineer, and get a Protocol Architect fast-path glance at the
`poi.ts` diff before merge rather than opening a second story. If the diff on `poi.ts` turns
out to be anything other than a two-line deletion, stop and re-escalate — that would mean the
"pure data removal" assumption was wrong.

### Existing code (read before editing)

**`poi.ts`** is the entire shared POI data model — 25 lines, 3 exports (`PoiType` enum,
`PoiDefinition` interface, `HUB_POIS` array) plus `INTERACTIVE_HUB_POIS` (currently just an
alias for `HUB_POIS` — every POI is already interactive since Epic 4 enabled the dungeon
entrance). No other logic lives here.

**`HubWorldScreen.tsx`**'s `renderFrame` function (lines 35–115) does two POI-adjacent
things: it redraws the training-dummy highlight ring every frame (lines 104–114, the part
being deleted), and — separately, untouched by this story — it draws player chat bubbles
keyed on `player.nearPoiId !== null` (lines 98–100), which works generically for any POI and
needs no change. The POI *icons themselves* (the static class-select/dungeon-entrance/dummy
squares with labels) are drawn once in the `initPixi` effect's POI loop (~lines 145–172), not
in `renderFrame` — that's where the color/label ternaries being simplified live.

### Known pitfalls

- Don't touch `player.nearPoiId !== null` chat-bubble logic (line 99) — that's generic across
  all POIs, not training-dummy-specific, and must keep working for class-select and
  dungeon-entrance.
- Don't touch `GameRoom.ts` — confirmed no training-dummy-specific branch exists in the POI
  sensor loop; this story has zero sim-server surface.
- Don't "clean up" the historical comment in `tests/e2e/hub-ability-use.test.ts:11` as part of
  this story — it's describing pre-2.8 behavior for context, not asserting against the
  removed POI, and touching `tests/**` is outside this story's Allowed paths.
- After the color/label ternary collapse, `DUNGEON_ENTRANCE` becomes the implicit `else`
  branch in both — this is intentional (matches the pre-existing 3-way ternary's structure,
  just with one arm removed) and needs no `PoiType.DUNGEON_ENTRANCE` explicit check added.

### Project Context Rules

- Per CLAUDE.md's Ownership Rules and project-context.md's "Monorepo Ownership" table:
  `packages/shared-types/**` is normally Protocol-Architect-only. This story is the explicit,
  correct-course-approved exception described above — do not treat it as a precedent for
  future cross-boundary stories without the same explicit scoping.
- Per project-context.md: `packages/shared-types` contains "TypeScript interfaces, enums,
  constants; no runtime logic" — this story's `poi.ts` edit stays within that boundary (pure
  data/enum deletion, nothing added).
- No tick-loop, PRNG, or Colyseus-boundary rules apply — this story is data + presentation
  only, sim-server untouched.

### References

- [Source: _bmad-output/planning-artifacts/epics.md — "Story 2.10: Remove Training-Dummy
  POI" (Epic 2 Correction: Hub POI Cleanup & Class-Pick Button Fit)]
- [Source: _bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md — Issue
  Summary item 2, Detailed Change Proposals item 1, Implementation Handoff]
- [Source: packages/shared-types/src/poi.ts — full file, 25 lines]
- [Source: apps/host-client/src/screens/HubWorldScreen.tsx — renderFrame lines 35–115,
  initPixi POI-icon loop lines 145–172]
- [Source: apps/simulation-server/src/rooms/GameRoom.ts:379 — generic
  INTERACTIVE_HUB_POIS sensor loop, confirmed no training-dummy branch, read-only reference]
- [Source: _bmad-output/implementation-artifacts/2-8-hub-ability-use-outside-training-dummy-poi.md
  — prior story that removed the ability-use gate and deferred POI removal to this story]

---

## Review Findings

- [x] [Review][Patch] `renderFrame`'s `poiGraphics` parameter was left dead after the
  training-dummy targeting-indicator block was removed — still declared in the signature and
  threaded through all 3 call sites, but never read inside the function body. Found
  independently by all 3 review layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor).
  Fixed: removed the parameter from `renderFrame`'s signature and all 3 call sites
  (`apps/host-client/src/screens/HubWorldScreen.tsx`). `poiGraphicsRef` itself is untouched —
  still populated by the init effect and cleared on unmount, just no longer passed into
  `renderFrame`. Re-verified: typecheck clean (10/10 tsconfigs).
- [x] [Review][Defer] AC6 (manual visual check) not performed — no display/browser available
  in this sandbox. Already disclosed in Dev Agent Record's Completion Notes before this
  review ran; matches this project's established precedent (7.5, 7.6, 7.7b, 3.23, dev-3) of
  flagging rather than silently skipping. Needs a human Client-UX pass before this story can
  move past review — deferred, pre-existing pattern for this project, not a code defect.

9 findings dismissed after verification (grep-confirmed `PoiType` has no exhaustive
switch/mapping consumer anywhere in the repo outside `poi.ts`/`HubWorldScreen.tsx`;
`HUB_POIS`/`INTERACTIVE_HUB_POIS` are only ever iterated with `for...of`, never indexed
positionally; the two remaining POI icons are drawn once in `initPixi`, not per-frame, so the
removed per-frame `.clear()`/redraw has no effect on them; `isDungeon`/alpha dimming logic is
fully untouched by this diff; version-skew and wire-format concerns are inherent to every
hard-cutover enum change this codebase already makes routinely, not specific to this story;
the 2-way ternary fallback pattern matches the file's own pre-existing `isDungeon` binary
idiom; no test asserts the removed data, confirmed by the story's own pre-shipped research).

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

None — no failing-then-fixed cycles in the touched code. `npm run typecheck` was clean on
first run (10/10 tsconfigs). `npm test` had 3 failures on first run, all pre-existing and
unrelated to this story's diff (see Completion Notes) — verified via `git stash` that the
Stone Wall centering failure reproduces byte-identically on the unmodified baseline; the two
e2e failures are the project's long-documented WSL2 simulation-server port-binding timeout
(same signature as dozens of prior entries in sprint-status.yaml). No fix attempted since
the failures are outside this story's Allowed paths and predate it.

### Completion Notes List

- AC1: Removed `PoiType.TRAINING_DUMMY` and the `training-dummy` entry from `HUB_POIS`
  (`packages/shared-types/src/poi.ts`). `HUB_POIS` now has exactly 2 entries
  (`class-select`, `dungeon-entrance`); `INTERACTIVE_HUB_POIS` and the rest of the file are
  untouched.
- AC2/AC3: Removed the training-dummy targeting-indicator block from `renderFrame`
  (`anyNearDummy`, `dummyEntry` lookup and draw/stroke) and collapsed both the POI-icon color
  ternary and the label ternary in the `initPixi` POI loop to their 2-way
  `CLASS_SELECT`/else(`DUNGEON_ENTRANCE`) form, exactly as specified in Dev Notes. The
  `PoiType` import itself was kept since `PoiType.CLASS_SELECT` and `PoiType.DUNGEON_ENTRANCE`
  are still referenced.
- AC4: Repo-wide grep for `TRAINING_DUMMY`/`training-dummy` after editing found only 2 hits,
  both out of this AC's scope (`packages/shared-types/**`, `apps/host-client/**`): the
  expected historical comment in `tests/e2e/hub-ability-use.test.ts:11`, and an unrelated
  comment in `apps/simulation-server/src/rooms/GameRoom.ts:2346` (a blocked path for this
  story, pre-existing, not a live reference to the removed POI).
- AC5: `npm run typecheck` — clean, 0 errors, all 10 tsconfig projects. `npm test` — 673
  passed / 3 failed / 3 skipped (677 total); all 3 failures pre-existing and unrelated (2
  known WSL2 e2e simulation-server port-binding timeouts — `ability-dispatch.test.ts`,
  `hub-ability-use.test.ts`; 1 known Stone Wall VFX centering assertion —
  `ability-vfx.test.ts`, memory-tracked, reproduced identically via `git stash` against this
  story's unmodified baseline). host-client has zero component tests today, confirmed
  unchanged (not a regression this story introduces).
- AC6 (manual visual check): **NOT performed** — no display/browser available in this
  sandbox, matching this project's long-established precedent (7.5, 7.6, 7.7b, 3.23, dev-3,
  etc.) of disclosing rather than skipping this gap silently. Needs a human Client-UX pass
  (walk the hub, confirm exactly 2 POI icons — CLASS, GATE — and no training-dummy interact
  prompt/chat bubble/highlight ring) before this story can move past review.
- Ownership: per the story's explicit single-owner exception (OWNERSHIP NOTE, Dev Notes),
  both `poi.ts` (normally Protocol Architect territory) and `HubWorldScreen.tsx` were
  implemented as Host Experience Engineer. The `poi.ts` diff is exactly the 2-line deletion
  the exception anticipated (one enum member, one array entry) — no shape/contract change,
  so the "if the diff turns out to be anything other than a two-line deletion, re-escalate"
  condition was not triggered. Still flagging for the Protocol Architect fast-path glance
  per the story's requirement before merge.
- Confidence: 90% — both files matched the story's Dev Notes byte-for-byte before editing, all
  automated gates (typecheck, grep, full suite regression-check) passed clean, and the only
  incomplete item (manual visual check) is a documented, environment-caused, precedented gap
  rather than an implementation uncertainty.

### File List

- `packages/shared-types/src/poi.ts` (modified)
- `apps/host-client/src/screens/HubWorldScreen.tsx` (modified)

---

## Change Log

- 2026-08-03: Story created via gds-create-story from the Epic 2 Correction section of
  epics.md, scoped by sprint-change-proposal-2026-08-03.md. Single-owner exception
  (Host Experience Engineer implements both `poi.ts` and `HubWorldScreen.tsx`) per the
  proposal's explicit fast-path-review decision — not split across ownership boundaries.
- 2026-08-03: dev-story — implemented Task 1 (`poi.ts` data removal) and Task 2
  (`HubWorldScreen.tsx` render cleanup) exactly per Dev Notes. Grep-verified no dangling
  `PoiType.TRAINING_DUMMY`/`'training-dummy'` references in `packages/shared-types/**` or
  `apps/host-client/**`. Typecheck clean (10/10 tsconfigs); full suite 673/677 passing, 3
  pre-existing unrelated failures (2 WSL2 e2e port-binding timeouts, 1 memory-tracked Stone
  Wall VFX centering test, reproduced against baseline via `git stash`). Manual Client-UX
  visual pass not performed — no display in this sandbox, disclosed per established project
  precedent. Status → review.
- 2026-08-03: code review of 2-10-remove-training-dummy-poi (stays review, not done) — 3
  parallel layers (Blind Hunter, Edge Case Hunter, Acceptance Auditor), full spec mode.
  Acceptance Auditor confirmed zero AC violations (AC1-AC4 fully match; AC5 automated gates
  green; AC6 honestly disclosed as not performed). 1 patch (all 3 layers independently found
  the same issue: `renderFrame`'s `poiGraphics` param went dead after Task 2's block removal
  — fixed by dropping it from the signature and all 3 call sites), 1 defer (AC6 manual visual
  check, already disclosed, needs a human pass — matches 7.5/7.6/7.7b/3.23/dev-3 precedent),
  9 dismissed after verification (exhaustive-switch and positional-indexing concerns
  disproved by repo-wide grep; version-skew/wire-format concerns are inherent to every
  hard-cutover enum change this codebase already makes; per-frame redraw concern disproved by
  reading the init effect; ternary-fallback and no-new-test concerns matched pre-existing
  patterns/explicit non-requirements). Re-ran typecheck (clean, 10/10) after applying the
  patch. Status stays review: the Client-UX hook's manual pass is still genuinely outstanding
  (no display in this sandbox).
