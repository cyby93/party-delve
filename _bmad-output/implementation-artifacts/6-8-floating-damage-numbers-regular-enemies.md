---
baseline_commit: 1f9b932
---

# Story 6.8: Floating Damage Numbers for Regular Enemies

Status: done

## CLAUDE.md Required Task Header

```
Phase: E6 — Grassland Boss Encounter (Story 6.8 — pure host-client visual
  polish, no protocol change, no simulation change; parallel-safe with 6.7)

Context: Confirmed by direct code read (2026-07-15). The delta this story needs
  (`enemy:damaged`, carrying `{ enemyId, damage, remainingHp }`) is ALREADY
  broadcast by `GameRoom.ts` at 6 existing call sites (every current combat
  path: melee/ability hit-scan, Ancestor's Voice cone, Spirit Nova sweep,
  status-effect damage tick, projectile hit, zone-tick damage — grep
  `'enemy:damaged' as const` in GameRoom.ts to confirm) and is already applied
  to `GameState` by `packages/net-protocol/src/apply-delta.ts`'s `'enemy:damaged'`
  case. This story is 100% host-client rendering — no simulation-server,
  game-rules, shared-types, or net-protocol change of any kind.

  The epics.md AC frames this as "extend the same pattern the boss already
  uses." That framing is only half right, and the gap matters for
  implementation:

  1. **The boss's damage-number pattern (`DungeonScreen.tsx` `bossDamageFlash`
     state, ~line 371/541-546/811-829) is a single fixed-position DOM overlay**
     (`top: 62, left: 50%`) — it works only because there is exactly one boss
     with a fixed on-screen HP banner. Regular enemies are N arbitrary,
     moving, world-positioned entities — a fixed-position overlay cannot work
     for them. The epics.md AC itself says the number must appear "above the
     hit enemy's sprite," i.e. anchored to that enemy's world position. The
     correct precedent to reuse is NOT the boss's DOM overlay — it is the
     already-established **per-entity PixiJS Map pattern** this same file uses
     for essence-drop flashes (`EssenceFlash` interface + `essenceFlashesRef`
     Map, ~line 55-58/349/532-538/322-336) and status-effect badges
     (`statusBadgeGraphicsRef`, ~line 246-278): a `Map<string, Entry>` of
     PixiJS objects positioned in the same virtual-canvas world-space
     (0-1920×0-1080) as enemy/player circles, created on delta arrival,
     animated per-frame inside `renderFrame`, and torn down on expiry. This
     story follows THAT pattern, using `pixi.js`'s `Text`/`TextStyle` (already
     used elsewhere in this app — see `apps/host-client/src/screens/
     HubWorldScreen.tsx` ~line 2/70/156-166 for the exact `Text`/`TextStyle`/
     `.anchor.set()` convention to match).

  2. **A confirmed pre-existing bug was found while reading the file this
     story must edit.** `apps/host-client/src/session/host-session.ts`
     (~line 46-58) has an explicit whitelist of `DeltaEventMsg` types it will
     forward to the `onTransientDelta` callback (which is what ultimately
     populates `latestTransientDelta`, the prop `DungeonScreen` and `App.tsx`
     read all their transient-visual reactions from). That whitelist does
     NOT include `'enemy:damaged'` — nor, incidentally, `'boss:damaged'`,
     `'boss:phaseChanged'`, `'boss:stomped'`, or `'boss:defeated'` (all of
     which `DungeonScreen.tsx`/`App.tsx` already have handler branches for,
     per Story 6.3/6.4). Without an `'enemy:damaged'` entry in this whitelist,
     server broadcasts of `enemy:damaged` update `GameState.enemies[].hp`
     correctly (via `applyDelta`, unconditional) but NEVER reach
     `latestTransientDelta` — so any new handler this story adds in
     `DungeonScreen.tsx`'s transient-delta effect would be unreachable dead
     code, exactly like the pre-existing boss-delta handlers are today. Adding
     `'enemy:damaged'` to this whitelist is REQUIRED, not optional, for this
     story's AC to be achievable at all — it is the root cause, not a detail.
     See Non-goals for why the sibling `boss:*` gaps are flagged but not
     fixed by this story.

Owner agent: Host Experience Engineer (single-owner story — only
  apps/host-client/** is touched; no shared-types, no net-protocol, no
  simulation-server, no game-rules changes)

Goal: Make a floating "-N" damage number appear above a regular enemy's
  sprite whenever the host receives an `enemy:damaged` delta, using the
  existing per-entity PixiJS Map + world-space-Text pattern already
  established in this file (essence flashes, status badges) — not the boss's
  fixed-DOM-overlay pattern, which does not generalize to N moving entities.
  Fix the `host-session.ts` whitelist gap that would otherwise make this
  unreachable. Leave `enemy:killed`'s existing fade-out behavior untouched.

Allowed paths:
  - apps/host-client/src/screens/DungeonScreen.tsx   (MODIFY — new Text-based
    damage-number Map, render/animate section, transient-delta handler)
  - apps/host-client/src/session/host-session.ts     (MODIFY — add
    'enemy:damaged' to the onTransientDelta whitelist; 1-line array addition)

Blocked paths:
  - packages/shared-types/**       (EnemyState/DeltaEventMsg already correct
    — EnemyDamagedDelta already has { enemyId, damage, remainingHp }, no
    changes needed)
  - packages/net-protocol/**       (EnemyDamagedDelta type + applyDelta's
    'enemy:damaged' case already correct and unchanged)
  - apps/simulation-server/**      (all 6 'enemy:damaged' broadcast call
    sites in GameRoom.ts already correct and unchanged — this story consumes
    an existing, already-working delta stream)
  - apps/mobile-controller/**      (not affected — mobile never renders the
    dungeon combat view)
  - packages/game-rules/**         (not affected)

Inputs:
  - deferred-work.md (searched for prior 'enemy:damaged'/host-session.ts
    whitelist findings — none exist; this is a newly discovered gap, not a
    previously-tracked one)
  - apps/host-client/src/screens/DungeonScreen.tsx (read in full — 1010
    lines; see Dev Notes for every relevant section and exact line numbers)
  - apps/host-client/src/session/host-session.ts (read in full — 79 lines;
    the onTransientDelta whitelist gap is the entire file's relevant content)
  - apps/host-client/src/App.tsx (read in full — confirms the same whitelist
    gap also silently breaks 'boss:defeated' reward-reveal wiring; see
    Non-goals for why this story does not fix that)
  - apps/host-client/src/screens/HubWorldScreen.tsx (read for the existing
    PixiJS Text/TextStyle usage convention — ~line 2, 70, 156-166)
  - packages/net-protocol/src/messages/server-to-host.ts ~line 93-98
    (EnemyDamagedDelta shape — already carries `damage` directly, no
    prevHp-tracking needed, unlike BossDamagedDelta which only carries newHp)
  - packages/net-protocol/src/apply-delta.ts ~line 108-115 ('enemy:damaged'
    case — already correct, unchanged)
  - packages/shared-types/src/enemy.ts (EnemyState shape: id, type, x, y, hp,
    maxHp, difficultyTier, isAlive, fsmState, attackCooldownTicks,
    statusEffects — confirms enemies have flat x/y, unlike BossState's
    nested position)

Non-goals:
  - Fixing the identical `host-session.ts` whitelist gap for
    `'boss:damaged'`/`'boss:phaseChanged'`/`'boss:stomped'`/`'boss:defeated'`.
    This is a real, confirmed-by-direct-read bug (see Context) that predates
    this story and is NOT introduced by it — but it is also not this story's
    title scope ("regular enemies"), and touching those 4 entries pulls in
    re-verifying the entire boss defeat/reward-reveal/purification-pulse
    visual sequence (Story 6.4's scope), which is a materially bigger surface
    than a one-line whitelist fix looks like. Log it to deferred-work.md as a
    new finding (see Tasks) instead of silently expanding this story.
  - Any change to how `enemy:damaged` is computed, broadcast, or applied to
    `GameState` server-side — already correct (see Blocked paths).
  - Changing `enemy:killed`'s existing fade-out (`KILL_FADE_MS`,
    `deadUntil`) — explicitly required by AC to remain unchanged. A damage
    number that happens to be mid-animation when the enemy dies is left
    alone; it lives in its own independent Map, keyed by a synthetic id, not
    by `enemyId`, so enemy removal from `enemyGraphicsRef` cannot affect it.
  - Horizontal jitter/stacking offset for multiple rapid hits landing on the
    same enemy (e.g. a DoT tick immediately followed by a hit-scan hit).
    Numbers may visually overlap in that rare case; this is a acceptable
    first-pass simplification, not a defect — do not add offset logic for it.
  - A damage-number cap/pool (e.g. max N simultaneous numbers). At current
    enemy counts and hit rates this is not a performance concern; do not
    pre-build a pooling system for a problem that doesn't exist yet.
  - Applying this treatment to player damage-taken (only enemy-damage-dealt
    is in scope, per the story title and epics.md AC).

Acceptance criteria: (from epics.md Story 6.8, verbatim)
  1. Given the host canvas already renders a damage-flash/number on
     `boss:damaged` (`DungeonScreen.tsx`), when this story ships, then the
     same pattern is extended to `enemy:damaged` deltas — a floating damage
     number appears above the hit enemy's sprite.
  2. The existing `enemy:killed` fade-out behavior is unchanged.

Required hooks: Client-UX hook (CLAUDE.md) — host checks: host HUD
  readability (damage numbers must not obscure health bars or be unreadable
  against the enemy-red circle), couch readability (numbers legible from a
  couch-viewing distance — matches the boss flash's existing 18-20px sizing).
Required tests:
  - `npm run typecheck` (repo root) — must pass with 0 errors (covers
    apps/host-client/tsconfig.json).
  - `npm run build --workspace=apps/host-client` — `tsc --noEmit && vite
    build` must succeed.
  - `npm run test` (repo root, vitest run) — full suite must remain green.
    No new automated test is required or meaningfully possible: this
    codebase has zero host-client unit/visual tests today (confirmed — no
    apps/host-client/**/*.test.* files exist), and PixiJS canvas rendering
    has no existing test harness to extend. This matches the precedent set
    by every prior purely-visual host-client story in this epic (6.3's arena
    rendering, 6.4's purification pulse) — verification is manual/visual,
    not automated.
  - Manual verification (Client-UX hook, no automated equivalent exists):
    start a dungeon run, hit a regular enemy with any ability, confirm a
    "-N" number rises and fades above that enemy's sprite; confirm the
    enemy's existing kill-fade animation is visually unchanged when the
    enemy is subsequently killed.
Telemetry impact: None — no new user-facing flow, no new event contract,
  purely reactive visual polish on an already-broadcast delta.
```

## Story

As a player,
I want to see damage numbers when I hit a regular enemy, not just the boss,
so that combat feedback is consistent across all enemy types.

## Acceptance Criteria

1. **Given** the host canvas already renders a damage-flash/number on `boss:damaged` (`DungeonScreen.tsx`) **When** this story ships **Then** the same pattern is extended to `enemy:damaged` deltas — a floating damage number appears above the hit enemy's sprite.
2. **And** the existing `enemy:killed` fade-out behavior is unchanged.

## Tasks / Subtasks

- [x] Task 1 — Fix the `host-session.ts` whitelist gap (AC: 1; this is the required root-cause fix, not optional)
  - [x] In `apps/host-client/src/session/host-session.ts`, locate the `onTransientDelta` whitelist inside `room.onMessage(EventNames.DELTA, ...)` (~line 46-58):
    ```typescript
    if (onTransientDelta && (
      delta.type === 'ability:fired' ||
      delta.type === 'spirit-ability:fired' ||
      delta.type === 'enemy:killed' ||
      delta.type === 'essence:dropped' ||
      delta.type === 'player:downed' ||
      delta.type === 'player:revived' ||
      delta.type === 'player:spirit' ||
      delta.type === 'player:hp-updated' ||
      delta.type === 'run:failed' ||
      delta.type === 'level:complete' ||
      delta.type === 'run:complete' ||
      delta.type === 'bond:assigned'
    )) {
    ```
  - [x] Add `delta.type === 'enemy:damaged' ||` to this list (anywhere in the chain — order doesn't matter, but placing it next to `'enemy:killed'` keeps the two enemy-lifecycle deltas visually adjacent). Without this, the delta reaches `GameState` (HP updates correctly via `applyDelta`, enemy health bars keep working) but never reaches `DungeonScreen`'s `latestTransientDelta` prop — the handler added in Task 4 would be unreachable.
  - [x] Do NOT add `'boss:damaged'`/`'boss:phaseChanged'`/`'boss:stomped'`/`'boss:defeated'` here — see Non-goals. Instead, append a new finding to `_bmad-output/implementation-artifacts/deferred-work.md` (follow that file's existing entry format, e.g. `D-6.8-A`) describing exactly this gap for those 4 delta types, citing this story's Context section, so it isn't lost.

- [x] Task 2 — Add `Text`/`TextStyle` imports and a damage-number entry type (AC: 1)
  - [x] In `DungeonScreen.tsx`'s import line (~line 2), change
    `import { Application, Graphics, Assets } from 'pixi.js';`
    to
    `import { Application, Graphics, Assets, Text, TextStyle } from 'pixi.js';`
    (matches the exact convention already used in `apps/host-client/src/screens/HubWorldScreen.tsx` ~line 2).
  - [x] Near the existing `EssenceFlash` interface (~line 55-58), add:
    ```typescript
    interface DamageNumberEntry {
      text: Text;
      spawnTime: number;
      startY: number;
    }
    ```
  - [x] Add three constants near the other duration constants (~line 29-33, alongside `ESSENCE_FLASH_MS` etc.):
    ```typescript
    const DAMAGE_NUMBER_DURATION_MS = 700;
    const DAMAGE_NUMBER_RISE_PX = 30;
    const DAMAGE_NUMBER_Y_OFFSET = ENEMY_RADIUS + 24; // clears the health bar at -32
    ```

- [x] Task 3 — Thread a new Map through `renderFrame` and component refs (AC: 1, 2)
  - [x] Add `damageNumberGraphics: Map<string, DamageNumberEntry>,` as a new final parameter to `renderFrame`'s signature (~line 75-86, after the existing `zoneGraphics: Map<string, Graphics>,` param).
  - [x] Add `const damageNumberGraphicsRef = useRef<Map<string, DamageNumberEntry>>(new Map());` alongside the other `*Ref` declarations in `DungeonScreen` (~line 347-353, next to `projectileGraphicsRef`/`zoneGraphicsRef`).
  - [x] Add `const damageNumberIdCounterRef = useRef(0);` next to it — used in Task 4 to generate a collision-free key per damage number (two enemies can be hit in the same millisecond; `Date.now()` alone is not a safe Map key).
  - [x] Pass `damageNumberGraphicsRef.current` as the new final argument at the `renderFrame(...)` call site inside the ticker (~line 395-406).
  - [x] Add `damageNumberGraphicsRef.current.clear();` to the unmount cleanup block (~line 492-497), alongside the existing `playerGraphicsRef.current.clear(); enemyGraphicsRef.current.clear(); ...` lines — matches the existing pattern (the Pixi objects themselves are already destroyed by the preceding `app.destroy(true, { children: true })`; `.clear()` only empties the JS Map).

- [x] Task 4 — Spawn a damage number on `enemy:damaged` (AC: 1, 2)
  - [x] In the "Handle transient delta visuals" effect (~line 508-577), add a new `else if` branch. Placement: anywhere in the chain is functionally fine, but put it next to the existing `else if (latestTransientDelta.type === 'enemy:killed')` branch (~line 529-531) since both are enemy-lifecycle deltas:
    ```typescript
    } else if (latestTransientDelta.type === 'enemy:damaged' && app) {
      const enemy = gameState?.enemies.find(e => e.id === latestTransientDelta.enemyId);
      if (enemy) {
        const text = new Text({
          text: `-${latestTransientDelta.damage}`,
          style: new TextStyle({ fontFamily: 'Lora, serif', fontSize: 18, fontWeight: 'bold', fill: 0xffffff }),
        });
        text.anchor.set(0.5, 1);
        text.position.set(enemy.x, enemy.y - DAMAGE_NUMBER_Y_OFFSET);
        app.stage.addChild(text);
        const key = `dn-${damageNumberIdCounterRef.current++}`;
        damageNumberGraphicsRef.current.set(key, {
          text,
          spawnTime: Date.now(),
          startY: enemy.y - DAMAGE_NUMBER_Y_OFFSET,
        });
      }
    ```
  - [x] Use the enemy's position **at the moment the delta arrives** (read from `gameState`, the effect's own closure variable — same convention already used by the `bond:assigned` branch a few lines up, which reads `gameState?.players.find(...)`). Do not try to track a separate "enemy position at hit time" from the delta itself — `EnemyDamagedDelta` carries no position, only `{ enemyId, damage, remainingHp }` (confirmed in `packages/net-protocol/src/messages/server-to-host.ts` ~line 93-98), and the enemy hasn't moved meaningfully within one tick, so `gameState`'s current position is the correct and only available anchor.
  - [x] If `enemy` is not found (already dead/removed from `gameState.enemies` by the time this effect runs — a narrow race, since `enemy:killed` typically arrives as a distinct, later delta), silently skip spawning a number. Do not throw or log.

- [x] Task 5 — Animate rise + fade, then clean up (AC: 1)
  - [x] In `renderFrame`, add a new section at the very end of the function, after the existing `// ── Essence flashes ──` loop (~line 322-335) and before the function's closing `}` (~line 336):
    ```typescript
    // ── Damage numbers ───────────────────────────────────────────────────────────
    for (const [id, entry] of damageNumberGraphics) {
      const elapsed = now - entry.spawnTime;
      if (elapsed >= DAMAGE_NUMBER_DURATION_MS) {
        app.stage.removeChild(entry.text);
        entry.text.destroy();
        damageNumberGraphics.delete(id);
        continue;
      }
      const t = elapsed / DAMAGE_NUMBER_DURATION_MS;
      entry.text.position.set(entry.text.position.x, entry.startY - t * DAMAGE_NUMBER_RISE_PX);
      entry.text.alpha = 1 - t;
    }
    ```
  - [x] This mirrors the existing essence-flash loop's structure exactly (iterate map, compute elapsed/remaining against `now` — already computed at the top of `renderFrame` — remove+destroy+delete on expiry, otherwise update a visual property). No new animation infrastructure is introduced; this is the same loop shape repeated for a fourth time in this file (essence flashes, purification particles in the ticker, and now this).

- [x] Task 6 — Verify (AC: 1, 2)
  - [x] `npm run typecheck` (repo root) — 0 errors.
  - [x] `npm run build --workspace=apps/host-client` — succeeds.
  - [x] `npm run test` (repo root, vitest run) — full suite run twice per two-strike QA; both runs showed different, non-overlapping failures confirmed as pre-existing e2e flakiness unrelated to this story's diff (see Debug Log for full isolation-run evidence). Accepted per user decision after review of the diagnosis.
  - [x] Manual check per Client-UX hook: verified end-to-end against the real running app (dev stack + headless-browser-driven host-client + a scripted live player via the real Colyseus protocol). Confirmed a "-15" floating damage number appears above the hit enemy immediately after an `enemy:damaged` delta, rises and fades out fully within ~0.7-1s, and that killing an enemy afterward (`debug:kill-all`) still shows the existing alpha kill-fade unaffected. See Completion Notes for details.
  - [x] Append the `D-6.8-A` finding to `deferred-work.md` per Task 1's instruction (the boss-delta whitelist gap), regardless of whether Tasks 1-5 above are otherwise complete — this is a documentation step, not a code change, and must not be skipped.

### Review Findings

- [x] [Review][Patch] `enemy.y - DAMAGE_NUMBER_Y_OFFSET` computed twice (inline for `text.position.set` and again for `startY`) instead of once — extract to a local variable [apps/host-client/src/screens/DungeonScreen.tsx:568-574]
- [x] [Review][Defer] No sanitization of the `damage` value before display (a `0` or fractional damage would render as "-0" or an unrounded float) [apps/host-client/src/screens/DungeonScreen.tsx:566] — deferred, no evidence today's damage values can be 0/fractional (existing combat paths always emit positive integer damage); revisit if a future ability introduces variable/fractional damage.
- [x] [Review][Defer] `DAMAGE_NUMBER_Y_OFFSET = ENEMY_RADIUS + 24` is coupled only by a comment to the health bar's hardcoded `-32` offset elsewhere in the file, with no shared constant tying them together [apps/host-client/src/screens/DungeonScreen.tsx:34-36] — deferred, matches this file's existing convention of standalone magic-number layout constants (e.g. badge `-(radius+14)`); revisit only if a future refactor introduces a shared layout-constant system.
- [x] [Review][Defer] Damage number text has no stroke/outline for contrast against light backgrounds [apps/host-client/src/screens/DungeonScreen.tsx:568-570] — deferred, matches the boss's existing `bossDamageFlash` convention (also flat-color, no outline); revisit in a future visual-polish pass.
- [x] [Review][Defer] No guard against a duplicate spawn if the transient-delta effect re-runs for the same delta (e.g. React StrictMode double-invoke) [apps/host-client/src/screens/DungeonScreen.tsx:560-576] — deferred, pre-existing class of risk shared by every other branch in this same effect (`ability:fired`, `essence:dropped`, etc.), not unique to this diff.
- [x] [Review][Defer] `enemy:damaged` arriving before the async Pixi `app.init()` resolves would be silently dropped (`app` is null, the `&&` guard short-circuits) with no queue/retry [apps/host-client/src/screens/DungeonScreen.tsx:560] — deferred, narrow race with no practical reachability (combat cannot start before Pixi init resolves, since class-select/hub/level-load all take longer).
- [x] [Review][Defer] An enemy hit near the top edge of the virtual canvas (y < 44) would spawn/rise a damage number above y=0, clipping outside the visible viewport [apps/host-client/src/screens/DungeonScreen.tsx:36] — deferred, cosmetic edge case, low practical impact given level layouts keep spawn margins from the canvas edge.
- [x] [Review][Defer] Spec-authoring inconsistency: Task 1/Task 6 mandate editing `deferred-work.md`, but this story's own "Allowed paths" section never lists that file — an internal contradiction in the story spec itself, not a code defect. Flagged for the Orchestrator/Protocol Architect to fix in future story templates, not actionable as a code patch here.

## Dev Notes

### Why the boss's existing pattern could not be copied verbatim

| | Boss (existing, `bossDamageFlash`) | Regular enemies (this story) |
|---|---|---|
| Rendering technique | React DOM `<div>` overlay, fixed screen position (`top: 62, left: 50%`) | PixiJS `Text` in world-space, following the entity |
| Why that technique works there | Exactly one boss; its HP banner is already a fixed top-of-screen DOM element | N enemies, each with its own moving `(x, y)` — no single fixed screen position can represent "above this enemy" |
| Delta payload used | `BossDamagedDelta { bossId, newHp }` — no `damage` field; host must diff against a remembered previous HP (`lastBossHpRef`) | `EnemyDamagedDelta { enemyId, damage, remainingHp }` — `damage` is already provided; **no diffing needed** |
| Precedent actually reused | — | The file's own `EssenceFlash`/`essenceFlashesRef` Map pattern (per-entity PixiJS object, spawned on delta, animated against `now` inside `renderFrame`, torn down on expiry) |

### The `host-session.ts` whitelist bug, and why this story only fixes its own slice of it

`apps/host-client/src/session/host-session.ts` is the single choke point every server delta passes through before any host UI can react to it transiently (`GameState` itself is always kept correct via unconditional `applyDelta` — this whitelist only gates the separate `latestTransientDelta` signal used for one-shot visual reactions). Reading it fully (79 lines) shows a hardcoded list of ~12 delta types. Cross-referencing every `latestTransientDelta.type === '...'` branch actually present in `DungeonScreen.tsx` and `App.tsx` against that list turned up 5 delta types with a handler but no whitelist entry: `enemy:damaged` (this story's concern) and `boss:damaged`/`boss:phaseChanged`/`boss:stomped`/`boss:defeated` (pre-existing, from Stories 6.3/6.4, unrelated to this story's title). All 5 are currently silently swallowed before they ever reach the components that "handle" them. This story fixes only its own entry (`enemy:damaged`) and documents the rest as a new deferred-work.md finding rather than expanding scope — see Non-goals for the reasoning (the boss sequence is a materially larger re-verification surface than the fix itself).

### Why `enemy:killed`'s fade-out is safe from this change

`enemy:killed`'s existing handling sets `deadUntil` on the `EnemyEntry` stored in `enemyGraphicsRef` (keyed by `enemyId`), which the existing enemy-rendering loop in `renderFrame` (~line 163-215) uses to fade `entry.circle`/`entry.healthBar` alpha over `KILL_FADE_MS`. This story's damage numbers live in a **separate** Map (`damageNumberGraphicsRef`), keyed by a synthetic per-spawn id (`dn-0`, `dn-1`, ...), never by `enemyId`. Killing an enemy does not touch `damageNumberGraphicsRef` at all — any damage number already in flight for that enemy continues its own independent rise-and-fade animation unaffected, and is cleaned up by its own expiry check, not by the enemy's removal.

### Project Structure Notes

- No new files. Both changes are inline additions to two existing files:
  `apps/host-client/src/screens/DungeonScreen.tsx` (bulk of the work) and
  `apps/host-client/src/session/host-session.ts` (1-line whitelist fix).
- `deferred-work.md` gets one new entry appended (documentation only, not code).
- Matches this app's established "pure renderer" boundary (game-architecture.md
  ~line 613-614: "host-client... contain zero game logic — they render what
  the simulation server sends and forward player input back"). This story
  adds a visual reaction to an already-existing, already-correct delta; it
  introduces no new client-side decision-making.

### Project Context Rules

- **Authority model**: no change — this story only renders state the
  simulation server already computed and broadcast; no client-side game
  logic is added.
- **Client-UX hook** (CLAUDE.md): triggered because this touches host UI.
  Host checks required: HUD readability (damage numbers must not obscure the
  enemy health bar — the `DAMAGE_NUMBER_Y_OFFSET` of `ENEMY_RADIUS + 24 = 44`
  clears the health bar, which sits at `-32`), couch readability (18px bold
  Lora at 1920×1080 virtual-canvas scale matches the boss flash's existing
  20px sizing — legible from typical couch viewing distance, consistent with
  every other in-canvas label in this file).
- **No contract-change hook**: `EnemyDamagedDelta` is pre-existing and
  unchanged; no `packages/shared-types`/`packages/net-protocol` file is
  touched by this story.
- **No simulation-safety hook**: `apps/simulation-server/**` and
  `packages/game-rules/**` are untouched (Blocked paths).
- **Package manager**: `npm` — `npm run typecheck` (repo root), `npm run
  build --workspace=apps/host-client`, `npm run test` (repo root, vitest).

### References

- `_bmad-output/planning-artifacts/epics.md`, Story 6.8 (verbatim AC source).
- `_bmad-output/implementation-artifacts/6-7-boss-combat-resolution-wiring.md`
  — sibling story in the same correct-course batch (2026-07-14); establishes
  that `boss:damaged` emission was the blocking gap for the boss's existing
  (but, per this story's finding, still-unreachable-from-the-host-session-
  whitelist) damage-flash pattern.
- `_bmad-output/implementation-artifacts/6-4-boss-defeat-sequence-purification-pulse-and-reward-reveal.md`
  — origin of `bossDamageFlash`, the DOM-overlay pattern this story explicitly
  does NOT reuse (see Dev Notes table).
- `_bmad-output/implementation-artifacts/6-3-boss-arena-handcrafted-level-physics-geometry-and-host-rendering.md`
  — origin of the boss HP bar / arena rendering conventions in `DungeonScreen.tsx`.
- `apps/host-client/src/screens/HubWorldScreen.tsx` — source of the
  `Text`/`TextStyle`/`.anchor.set()` convention this story follows (POI
  labels, chat-bubble emoji text).
- `packages/net-protocol/src/messages/server-to-host.ts` — `EnemyDamagedDelta`
  shape (~line 93-98).
- `packages/shared-types/src/enemy.ts` — `EnemyState` shape (flat `x`/`y`,
  unlike `BossState`'s nested `position`).
- `_bmad-output/implementation-artifacts/deferred-work.md` — target file for
  the new `D-6.8-A` finding (host-session.ts boss-delta whitelist gap).
- `_bmad-output/game-architecture.md` ~line 613-614 — "host-client... contain
  zero game logic" pure-renderer boundary this story stays within.

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5

### Debug Log References

- `npm run typecheck` (repo root) — 0 errors, all 10 workspace tsconfigs pass.
- `npm run build --workspace=apps/host-client` — `tsc --noEmit && vite build` succeeded (813 modules, 58.77s).
- `npm run test` (repo root, vitest run) — run twice per the two-strike QA rule; **both runs failed**, but with different, non-overlapping failures each time, and none in files this story touches:
  - Run 1: 3 e2e suites failed with `simulation-server did not start within 60s` (`ability-dispatch.test.ts`, `hub-ability-use.test.ts`, `reconnect.test.ts`); `full-run.test.ts` failed a bond-count assertion (`expected 2 to be 3`).
  - Run 2: `full-run.test.ts` failed with `EADDRINUSE :::2568` then `simulation-server did not start within 60s`; `ability-dispatch.test.ts` failed a DoT-timing assertion (`expected 50 to be >= 100`). 432 of 435 tests passed.
  - Root-cause diagnosis: this story's diff touches only `apps/host-client/src/screens/DungeonScreen.tsx` and `apps/host-client/src/session/host-session.ts` — neither file is imported or exercised by any of the failing e2e suites (confirmed via grep). The failure signatures (port contention starting the simulation-server process, wall-clock timing assertions on ability/DoT damage windows) match a documented pre-existing environmental flakiness class in this repo: Story 6-7's Debug Log (`6-7-boss-combat-resolution-wiring.md`) records the identical `EADDRINUSE`/`did not start within 60s` symptom and traces it to concurrent e2e runs contending for hardcoded test ports (`2568`, `18765`), confirmed there by an isolated pre-story `git stash` run showing the same flakiness. Re-ran the specific failing suites in isolation here (`npx vitest run --config vitest.config.ts` from `tests/`, one/few files at a time, bypassing whatever was contending for ports): `full-run.test.ts` passed clean (2/2), `ability-dispatch.test.ts`/`hub-ability-use.test.ts`/`reconnect.test.ts` passed 6/8 with the 2 remaining failures being the same DoT-timing assertion (`ability-dispatch.test.ts:217`, `expect(heal.hp).toBeGreaterThanOrEqual(allyStart.hp)`) — a race the test's own inline comment already acknowledges ("rule out an incidental enemy-melee-damage delta landing on the ally within the wait window instead of the heal"), pre-existing and unrelated to host-client rendering.
  - Per the two-strike QA rule ("if the second run also fails, HALT... never attempt a third retry"): HALTed and presented the full diagnosis to the user. User reviewed and explicitly accepted the pre-existing-flakiness diagnosis, directing the story to proceed to completion (2026-07-16).
  - Manual Client-UX verification: ran the real dev stack (`npm run dev` — simulation-server + host-client + mobile-controller), drove a headless Chromium (Playwright) against the real host-client at `localhost:5173` to create a live lobby, and used a scripted raw-Colyseus-SDK "phone" client (mirroring the existing `ability-dispatch.test.ts` helper pattern — join, class-select, navigate to dungeon entrance, propose+vote, move into ability range) to fire a real Spiritcaller ability at a live enemy through the real server. Confirmed via screenshots: a "-15" white damage number appears above the hit enemy immediately after the `enemy:damaged` delta (t+200ms), is fully faded and gone by t+600-1000ms (matches `DAMAGE_NUMBER_DURATION_MS = 700`), and a subsequent `debug:kill-all` still produces the pre-existing enemy alpha kill-fade unaffected. Two environment issues were hit and resolved during this check, both environmental, not code defects: (1) headless Chromium required system shared libs (`libglib-2.0` etc.) installed via `sudo playwright install-deps chromium` — done by the user; (2) Vite's dev-server file watcher did not pick up edits on this WSL2/Windows-mounted (`/mnt/c/`) path (a known class of issue per `feedback_wsl2_zombie_processes` memory) — worked around by fully restarting the dev-client process (kill by PID + relaunch) after each edit, which forces a fresh disk read. Confidence: 95% — both ACs were directly observed end-to-end against the real running app and real server-broadcast delta, not inferred from code reading alone.

### Completion Notes List

- Tasks 1-5 implemented exactly per spec: `enemy:damaged` added to `host-session.ts`'s `onTransientDelta` whitelist; `Text`/`TextStyle` imports, `DamageNumberEntry` interface, and duration/rise/offset constants added to `DungeonScreen.tsx`; `damageNumberGraphics` Map threaded through `renderFrame`'s signature, refs, ticker call site, and unmount cleanup; a spawn branch added to the transient-delta effect (guards on enemy still present in `gameState`); a rise+fade+cleanup loop added at the end of `renderFrame`, mirroring the existing essence-flash loop shape.
- `D-6.8-A` (boss-delta whitelist gap, non-goal per this story) appended to `deferred-work.md`.
- Task 6 (Verify) is complete: typecheck (0 errors), build (succeeds), deferred-work.md entry (`D-6.8-A` appended), and the full test-suite gate (accepted per user decision after two-strike QA HALT and diagnosis review — pre-existing e2e flakiness unrelated to this story's diff) are all done. Manual Client-UX verification was performed end-to-end against the real running app (dev stack + real browser + real scripted player over the live Colyseus protocol) — both ACs directly observed via screenshots, not just inferred from code.

### File List

- `apps/host-client/src/session/host-session.ts` (modified — added `'enemy:damaged'` to the `onTransientDelta` whitelist)
- `apps/host-client/src/screens/DungeonScreen.tsx` (modified — `Text`/`TextStyle` import, `DamageNumberEntry` interface, 3 new constants, `damageNumberGraphics` Map threaded through `renderFrame`/refs/cleanup, spawn branch in transient-delta effect, rise+fade animation loop in `renderFrame`)
- `_bmad-output/implementation-artifacts/deferred-work.md` (modified — appended `D-6.8-A` finding)
