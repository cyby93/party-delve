---
baseline_commit: f6b5db7
---

# Story 3.21c: Host Rendering — Distinct Body & Spirit Entities

Status: done

## CLAUDE.md Required Task Header

```
Phase: E3 — Core Combat / Epic 3 Correction (Downed Player Body/Spirit
  Entity Split — third and last of the 3.21a → 3.21b → 3.21c sequence.
  Depends on 3.21a's `PlayerState.bodyX/bodyY` schema and 3.21b's
  simulation logic — in particular 3.21b's guarantee that `x`/`y` snap
  back to `bodyX`/`bodyY` on revive, which this story's rendering
  assumption depends on.)

Context: Today's `renderFrame` (`apps/host-client/src/screens/
  DungeonScreen.tsx` ~line 74) keeps one `Graphics` object per player in
  the `playerGraphics` map and draws it one of two ways: a "luminous
  spirit" look (outer glow ring + inner circle) when `showSpirit`
  (`player.isSpirit && !isPurified`) is true, or a plain filled circle
  otherwise — with alpha dropped to 0.3 only when `player.isFrozen`
  (disconnect grace, an unrelated state). **There is currently no distinct
  visual for `isDown` at all** — a downed-but-not-yet-spirit player renders
  identically to a fully alive one (full alpha, full radius, normal
  color), which is the actual gap this story fixes, not merely "replacing
  a dimmed figure" as epics.md's framing loosely describes. Verify this
  against the current code yourself before starting (`grep -n "isDown"
  apps/host-client/src/screens/DungeonScreen.tsx` — as of this story's
  writing, `isDown` appears only in the revive-deadline-tracking logic
  further down the file, never in the render function itself).

  Once a player is down, this story needs to show TWO simultaneously
  visible entities instead of one:
  1. A body sprite, anchored at `bodyX`/`bodyY`, visible for the entire
     down+spirit window (from `isDown` first becoming true, through
     `isSpirit`, until revive).
  2. The existing luminous spirit sprite, anchored at `x`/`y`, visible
     only once `isSpirit` is true (unchanged from today) — same visual,
     just needs to render alongside the body instead of at the same
     position as a single combined entity.

  `playerGraphics` currently holds exactly one `Graphics` per player id.
  The minimal change is to add a second, body-specific `Graphics` per
  entry (created lazily, same create-on-first-seen/cleanup-on-missing
  pattern already used for `playerGraphics`/`enemyGraphics`/
  `tetherGraphics` elsewhere in this same function) rather than
  restructuring the existing map or its cleanup loop.

  This story assumes 3.21b's AC4 (revive snaps `x`/`y` back to `bodyX`/
  `bodyY`) has landed — once it has, "the player's normal alive-state
  rendering resumes at the body's location" (epics.md's AC3) requires NO
  special-casing here: after `isDown`/`isSpirit` both go false, the
  existing single-circle branch already renders at `player.x`/`player.y`,
  which by then equals the body's location. This story only needs to (a)
  add the body sprite while down/spirit, and (b) remove/hide it once
  neither `isDown` nor `isSpirit` is true.

Owner agent: Host Experience Engineer (single ownership area)

Goal:
  Task 1 — Add a body-sprite `Graphics` per downed/spirit player,
            positioned at `bodyX`/`bodyY`, with its own create-on-first-
            seen / cleanup-on-missing lifecycle matching this function's
            existing patterns.
  Task 2 — Keep the existing luminous spirit rendering unchanged, but
            confirm it renders alongside (not instead of) the new body
            sprite while `isSpirit` is true.
  Task 3 — Remove the body sprite once the player is revived (neither
            `isDown` nor `isSpirit`), and confirm normal alive rendering
            resumes at the correct (post-3.21b, body-snapped) position.

Allowed paths:
  - apps/host-client/src/screens/DungeonScreen.tsx
  - packages/ui-kit/** (only if a genuinely reusable host-rendering helper
    emerges — do not create one speculatively; inline in DungeonScreen.tsx
    is almost certainly sufficient, see Dev Notes)

Blocked paths:
  - packages/shared-types/** (3.21a — schema already landed)
  - packages/net-protocol/** (3.21a)
  - apps/simulation-server/** (3.21b — simulation logic already landed)
  - packages/game-rules/** (3.21b)
  - apps/mobile-controller/** (not part of this rendering change — the
    phone is a controller, not a game screen, per project-context.md;
    downed/spirit visuals are host-only)

Inputs:
  - _bmad-output/planning-artifacts/epics.md, "Story 3.21c" section
  - _bmad-output/implementation-artifacts/3-21a-body-spirit-position-schema-and-protocol-contract.md
  - _bmad-output/implementation-artifacts/3-21b-body-spirit-movement-and-revive-targeting-logic.md
    — confirm its AC4 (revive position snap) has landed before relying on it
  - apps/host-client/src/screens/DungeonScreen.tsx:74-127 (`renderFrame`'s
    existing Players section — `playerGraphics` map, `showSpirit` branch)
  - apps/host-client/src/screens/DungeonScreen.tsx (Story 3.6's original
    spirit-form visual — the luminous glow-ring look to preserve unchanged)

Non-goals:
  - Do not touch `PlayerChipHUD` (~line 909) — it's a name/HP sidebar chip
    with no position rendering, unaffected by this split.
  - Do not touch `apps/mobile-controller/**` — mobile UI stays minimal,
    players watch the host screen per project-context.md; this is a
    host-canvas-only change.
  - Do not add a new body-visual style system/config for a value that
    never varies (one body look, one spirit look — this is exactly the
    kind of single-consumer visual this codebase keeps as an inline
    literal, not a themeable table, matching e.g. the existing hardcoded
    spirit glow-ring radii).
  - Do not change revive/down simulation logic — that's 3.21a/3.21b,
    already landed and out of this story's scope.

Acceptance criteria: [see BDD-format Acceptance Criteria section below]

Required hooks:
  - Client-UX hook: TRIGGERED (host UI change).
    Host checks: couch readability (body/spirit sprites must be visually
    distinguishable at couch distance, 2-4m from TV, per project-context.md's
    Host Screen Constraints — reuse existing color/glow conventions rather
    than inventing new low-contrast ones), host HUD readability (confirm
    `PlayerChipHUD` still reads correctly alongside the new canvas visual,
    even though it isn't itself modified).
  - Ownership hook: single ownership area — no split needed.
  - Contract-change hook / Simulation-safety hook: NOT triggered — no
    protocol or simulation files touched.

Required tests:
  - No existing automated test suite covers `DungeonScreen.tsx`'s canvas
    rendering (PixiJS draw calls aren't unit-tested anywhere in this
    codebase today — confirmed by grep, matches this project's general
    gap around host-canvas rendering, same class of gap as this batch's
    other GameRoom-integration-test deferrals). Manually verify in a
    running session per the Definition of Done's "test the golden path in
    a browser" requirement: down a player, confirm the body sprite appears
    at the down location and stays fixed while the spirit (once it
    appears) moves independently; revive the player and confirm the body
    sprite disappears and the alive sprite renders at the body's location.

Telemetry impact: None.
```

---

## Story

As a player watching the host screen,
I want to see a downed teammate's body where they fell and their spirit moving separately,
so that the revive objective (reach the body) is visually clear even after the spirit has wandered off.

---

## Acceptance Criteria

**AC1 — Body sprite renders at the down location:**
**Given** a player is downed
**When** the host canvas renders
**Then** a body sprite renders at `bodyX`/`bodyY` (replacing today's identical-to-alive rendering, not merely a "dimmed" one — see Context) for the duration of the down state

**AC2 — Spirit renders independently once spirit form begins:**
**Given** the player enters spirit form
**When** the host canvas renders
**Then** a separate luminous spirit figure (Story 3.6's existing visual, unchanged) renders at `x`/`y`, independently of the body sprite, until the player is revived or the run ends

**AC3 — Body sprite removed on revive:**
**Given** the player is revived (proximity or Soul Mend)
**When** `player:revived` is received
**Then** the body sprite is removed and the player's normal alive-state rendering resumes at the body's location (relies on 3.21b's AC4 having already snapped `x`/`y` to `bodyX`/`bodyY` server-side — no position correction needed here)

---

## Tasks / Subtasks

- [x] **Task 1a** (AC: #1) — `DungeonScreen.tsx`: extend the player-graphics
  bookkeeping (currently `playerGraphics: Map<string, { circle: Graphics,
  flashUntil: number }>`) with a second lazily-created `Graphics` per
  entry for the body sprite (e.g. add a `body: Graphics | null` field, or
  a parallel `bodyGraphics` map — dev agent's call on whichever reads
  cleaner against the existing structure, see Dev Notes).

- [x] **Task 1b** (AC: #1) — In the Players render loop, when `player.isDown
  || player.isSpirit` is true: create the body `Graphics` on first sight
  (matching the existing lazy-create pattern for `circle`), position it at
  `(player.bodyX ?? player.x, player.bodyY ?? player.y)`, and draw a
  distinct, couch-readable look (a plain filled circle at normal alpha
  using the player's session color is the simplest option that stays
  legible at couch distance and doesn't require new palette additions —
  dev agent's call on the exact visual treatment, but it must be visually
  distinguishable from both the normal alive look and the spirit glow-ring
  look, per the Client-UX hook's readability check).

- [x] **Task 2** (AC: #2) — Confirm (and adjust if the existing branch
  structure requires it) that the spirit-glow rendering block continues to
  run at `player.x`/`player.y` independently of the new body-sprite block
  — both should be visible simultaneously while `isSpirit` is true, per
  AC2. This is very likely already correct once Task 1 adds the body
  sprite as a separate draw call rather than replacing the existing
  `circle` branch, but verify by running the golden path (see Required
  tests) since there's no automated coverage here.

- [x] **Task 3** (AC: #3) — When neither `player.isDown` nor
  `player.isSpirit` is true, remove/hide the body sprite (matching the
  existing cleanup-on-missing pattern: either destroy-and-delete it from
  its map like `playerGraphics`'/`enemyGraphics`' cleanup loops, or simply
  skip drawing it and let it get destroyed when the player itself leaves —
  dev agent's call on whichever is simpler given the Task 1a data
  structure chosen).

- [x] Manually verify the golden path in a running session (see Required
  tests) — down a player, confirm body sprite behavior; let the timer
  expire into spirit form, confirm both entities render and the spirit
  moves independently; revive, confirm the body sprite disappears and
  normal rendering resumes at the correct position. **Verified by the user
  (2026-07-15)** in their own environment, via `npm run dev`: body sprite
  renders at the down location, spirit renders separately and moves
  independently via joystick input, and reviving at the body's location
  correctly removes the body sprite and resumes normal rendering there.
  (This sandboxed dev session could not run the full stack itself — no
  Redis/Docker available — though `simulation-server`'s `index.ts` only
  requires Redis when `REDIS_HOST` is set for cloud mode, so Local Party
  Mode's `npm run dev` needed no extra infra; a `host-client` production
  build was confirmed clean here as a secondary check before the user's
  live verification.)

- [x] `npm run typecheck` + `npx vitest run` — 0 errors, no regressions
  (this story adds no new automated tests per the Required tests note
  above, but must not break any existing ones — e.g. `tests/unit/
  displacement.test.ts`-style pure-function tests are unaffected since
  this story touches only `apps/host-client`).

### Review Findings

- [x] [Review][Patch] The new `circle.alpha = 0` (isDown branch) and the new body-sprite draw block didn't account for `player.isFrozen` — a regression: before this diff, a downed-and-disconnected player still got the pre-existing `isFrozen ? 0.3 : 1` dimming cue on the main circle; after this diff, that circle is unconditionally hidden and the new body sprite draws at a fixed alpha regardless of `isFrozen`, silently dropping the "reconnect state visibility" cue CLAUDE.md's Client-UX hook requires. **Fixed:** the body sprite now dims further (`fillAlpha`/`strokeAlpha` reduced) when `player.isFrozen` is also true, confirmed reachable via `GameRoom.ts:477` (`isFrozen` can be true while `isDown`/`isSpirit`, no mutual-exclusion guard).
- [x] [Review][Patch] `PlayerEntry.body`'s inline comment said "destroyed on revive," but the actual removal condition also fires on the `isPurified` suppression transition, not just revive. **Fixed:** comment reworded to describe the actual condition.

---

## Dev Notes

### Read the existing Players render block before touching it

`DungeonScreen.tsx`'s `renderFrame` (~line 74-227) already has three
independent create-on-first-seen/cleanup-on-missing sections in the same
function (players, enemies, bond tethers) — follow whichever of those
patterns most closely matches how you structure the new body-sprite
bookkeeping. Current Players section (~90-127) for reference:

```ts
for (const player of state.players) {
  let entry = playerGraphics.get(player.id);
  if (!entry) {
    const circle = new Graphics();
    app.stage.addChild(circle);
    entry = { circle, flashUntil: 0 };
    playerGraphics.set(player.id, entry);
  }
  const { circle } = entry;
  const color = SESSION_COLOR_HEX[player.sessionColor] ?? 0xffffff;
  const isFlashing = !player.isFrozen && entry.flashUntil > 0 && now < entry.flashUntil;
  const showSpirit = player.isSpirit && !isPurified;
  circle.position.set(player.x, player.y);
  circle.clear();
  if (showSpirit) {
    circle.alpha = /* flash-aware alpha */;
    circle.circle(0, 0, 28).fill({ color, alpha: 0.35 });
    circle.circle(0, 0, 14).fill({ color, alpha: 0.85 });
  } else {
    circle.alpha = /* flash-aware alpha, or 0.3 if isFrozen, else 1 */;
    circle.circle(0, 0, PLAYER_RADIUS).fill({ color });
  }
}
```

Note `circle.position.set(player.x, player.y)` runs unconditionally for
every player, including downed ones — this is what currently makes a
downed player render identically to an alive one (same position, same
`PLAYER_RADIUS` circle, same color, alpha 1 unless also `isFrozen`). The
new body sprite is a second `Graphics`, positioned at `bodyX`/`bodyY`
instead, drawn only while `isDown || isSpirit`.

### Visual design is this story's call, within couch-readability constraints

Epics.md doesn't prescribe an exact look for the body sprite beyond "a
body sprite" — project-context.md's Host Screen Constraints (couch
distance, 2-4m from TV, minimum readable size) and this story's Client-UX
hook are the only hard constraints. Reuse the player's existing
`SESSION_COLOR_HEX[player.sessionColor]` for continuity (so it's clear
whose body it is) and keep it visually distinct from both the normal alive
circle and the luminous spirit glow — e.g. a plain circle at reduced alpha
with a simple outline, or matching `PLAYER_RADIUS` but at a fixed dimmed
alpha. Do not build a configurable style system for this — it's one look,
for one state, on one screen.

### Project Context Rules

- Host Screen Constraints (project-context.md): designed for couch
  distance (2-4m from TV) — minimum readable size at 1080p; host has no
  input device, display-only. Directly applicable to the body sprite's
  visual design.
- PixiJS rules: call `renderFrame(mirrorState)` once per tick with a
  snapshot reference (already the existing pattern this function follows)
  — no game logic, cooldown tracking, or collision checks inside any
  PixiJS display object. This story adds a draw call, not game logic.
- Authority: host reads only `mirrorState` built from `applyDelta` — this
  story never mutates `GameState`, only reads `player.isDown`/`isSpirit`/
  `bodyX`/`bodyY`/`x`/`y` to decide what to draw.

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 3.21c]
- [Source: _bmad-output/implementation-artifacts/3-21a-body-spirit-position-schema-and-protocol-contract.md]
- [Source: _bmad-output/implementation-artifacts/3-21b-body-spirit-movement-and-revive-targeting-logic.md] — this story's rendering assumption (revive position snap) depends on 3.21b's AC4
- [Source: apps/host-client/src/screens/DungeonScreen.tsx] — `renderFrame`, existing Players render block, `PLAYER_RADIUS`, `SESSION_COLOR_HEX`

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npm run typecheck` — 0 errors across all 10 project references.
- `npx vitest run` (full suite) — 484 passed, 0 failed, 12 skipped (this
  story adds no new automated tests, per its own Required tests note —
  `DungeonScreen.tsx`'s canvas rendering has no existing test coverage
  anywhere in this codebase).
- `npm run lint` — clean (no output).
- `npm -w apps/host-client run build` — succeeded cleanly (`vite build`,
  813 modules transformed), confirming the new PixiJS `Graphics`
  `.circle().fill().stroke()` calls compile and bundle correctly.
- This sandboxed dev session could not run the full 4-service `npm run dev`
  stack itself (no output, no bound ports, after several minutes) — traced
  to the environment lacking Docker/Redis, though `simulation-server/src/
  index.ts` only actually requires Redis when `REDIS_HOST` is set (cloud
  mode); Local Party Mode uses Colyseus's `LocalPresence` and needs no
  extra infra, so the stall's root cause wasn't fully diagnosed. Live
  golden-path verification was performed by the user in their own
  environment instead (2026-07-15) — see Completion Notes.

### Completion Notes List

- Task 1a: extended `PlayerEntry` (`DungeonScreen.tsx`) with `body: Graphics
  | null`, lazily created — same pattern as the existing `circle` field.
- Task 1b: body sprite renders for the whole `isDown || isSpirit` window,
  anchored at `bodyX ?? x` / `bodyY ?? y`. Visual: dimmed fill (35% alpha)
  plus a stroke outline, in the player's session color — distinct from
  both the opaque alive circle and the existing frozen/disconnected dim
  (which has no stroke and sits at `player.x/y`, not the body position).
- Task 2: the existing spirit-glow branch (luminous outer/inner circle at
  `player.x/y`) is untouched and renders independently of the new body
  sprite. Also adjusted the plain-circle branch: when `isDown` (not yet
  spirit), the normal circle is suppressed (`alpha = 0`) rather than drawn
  — since `bodyX/bodyY` equals `x/y` while `isDown` (frozen, per Story
  3.21b), drawing both would duplicate the same look at the same spot.
  Alive rendering is unaffected.
- Task 3: body sprite is destroyed and cleared from the entry when neither
  `isDown` nor `isSpirit` is true, matching the existing cleanup pattern;
  also destroyed in the top-of-function stale-player cleanup loop (a player
  leaving mid-down previously only cleaned up `circle`).
- Confirmed out of scope, per the story's own Non-goals: `PlayerChipHUD`
  (name/HP sidebar chip, no position rendering) and `apps/mobile-controller`
  were not touched.
- Manual golden-path verification: attempted in this sandboxed session but
  blocked by missing dev infra (see Debug Log). **User verified live in
  their own environment (2026-07-15):** body sprite renders at the down
  location, spirit renders separately and moves independently, and
  reviving at the body's location correctly removes the body sprite and
  resumes normal rendering there — confirming AC1, AC2, and AC3 all hold
  in an actual running session, not just in code review.

Confidence: 90% — all code-level checks (typecheck, lint, full test suite,
production build) pass, and the actual visual behavior was confirmed live
by the user, which is the strongest verification this kind of canvas-
rendering change can get given no automated test covers `DungeonScreen.tsx`
anywhere in this codebase. The 10% gap is the couch-readability visual
design choice (dimmed fill + stroke outline) being a judgment call not
dictated by the story — the user's confirmation covers "it renders
correctly and is visually distinct," not a specific design review against
the Client-UX hook's couch-distance readability bar.

### File List

- `apps/host-client/src/screens/DungeonScreen.tsx` — added body sprite rendering (`PlayerEntry.body`, lazy-create/cleanup, distinct dimmed+stroke visual, `isFrozen`-aware dimming)

## Change Log

- 2026-07-15: Story implemented — downed players now render a distinct
  body sprite at `bodyX`/`bodyY`, separate from the existing luminous
  spirit visual at `x`/`y`. Verified live in a running session by the user.
  Status → `review`.
- 2026-07-15: Code review — 2 patches applied: body sprite now dims further
  when the player is also disconnected (`isFrozen`), restoring a
  reconnect-visibility cue the new code had silently dropped; a stale
  interface comment corrected. 0 decision_needed, 0 deferred. Status →
  `done`.
