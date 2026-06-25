---
baseline_commit: SET_TO_HEAD_AFTER_STORY_3_4_MERGE
---

# Story 3.5: Player Health, Revive Timer & Downed State

Status: ready-for-dev

## CLAUDE.md Required Task Header

```
Phase: 3 — Core Combat (Epic 3: Core Combat — 4 Alpha Classes)
Context: Stories 3.1–3.4 built the physics world, enemy AI scaffolding, class ability
  dispatch, and combat resolution (ability hits enemies, essence drops). Enemies exist
  in GameState with planck bodies and FSM states. Abilities fire correctly. Story 3.5
  closes the damage loop in the other direction: enemies deal melee damage to players,
  player hp reaches zero → player enters downed state with an escalating revive timer,
  teammates revive by proximity, and timer expiry transitions the player to spirit form
  (spirit form interactions are Story 3.6). This story also adds the mobile HP strip,
  the host player-chip health pips, and the host revive-timer HUD component.
Owner agent: Simulation Engineer (primary — GameRoom tick logic); Mobile Controller
  Engineer (ControllerScreen downed UI + HP strip); Host Experience Engineer
  (DungeonScreen revive-timer component + player chip pips); Protocol Architect
  co-owns all new/changed delta types (contract-change hook required).
Goal: Wire enemy melee attacks into the tick; apply player hp reduction via a pure
  function; broadcast PlayerHpUpdatedDelta; handle hp=0 → player:downed transition
  with escalating revive window from balance.ts; track server-side revive timer;
  detect proximity revive (teammate near downed player); detect timer expiry →
  player:spirit transition; add downed UI to mobile controller; add revive-timer
  component + HP pips to host DungeonScreen.
Allowed paths:
  - packages/game-rules/src/systems/player-health.ts         (NEW — pure damage/downed logic)
  - packages/game-rules/src/balance.ts                       (MODIFY — revive windows, enemy melee, revive radius)
  - packages/game-rules/src/index.ts                         (MODIFY — export player-health symbols)
  - packages/shared-types/src/player.ts                      (MODIFY — reviveTimerExpiresAt field)
  - packages/net-protocol/src/messages/server-to-host.ts     (MODIFY — PlayerHpUpdatedDelta, PlayerSpiritDelta; extend PlayerDownedDelta)
  - packages/net-protocol/src/apply-delta.ts                 (MODIFY — new delta cases)
  - packages/net-protocol/src/index.ts                       (MODIFY — export new delta types)
  - apps/simulation-server/src/rooms/GameRoom.ts             (MODIFY — enemy melee, downed logic, revive check, timer expiry)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (MODIFY — HP strip, downed state UI)
  - apps/host-client/src/screens/DungeonScreen.tsx           (MODIFY — revive-timer component, player chip pips)
  - apps/host-client/src/components/PlayerSlot.tsx           (READ — check current state before modifying player chip)
  - tests/unit/player-health.test.ts                         (NEW)
  - tests/contract/net-protocol.test.ts                      (MODIFY — new delta round-trips)
Blocked paths:
  - apps/backend-platform/**             (no backend changes)
  - packages/shared-types/src/enemy.ts  (no new enemy fields this story)
  - apps/mobile-controller/src/**       (only ControllerScreen.tsx — do not touch App.tsx or mobile-session.ts)
Non-goals:
  - Spirit form movement and spirit ability activation (Story 3.6)
  - Run failure when all players are in spirit form (Story 3.6)
  - Spirit essence collected by spirit-form players (Story 3.6)
  - Bond system interactions (Epic 5)
  - Enemy ranged attacks (alpha uses melee only for the GRUNT type in Epic 3)
  - Player-player collision physics (deferred to Phase 5)
  - Revive animation on host canvas (placeholder instant revive is acceptable in alpha)
Acceptance criteria:
  AC1: When an enemy is in EnemyFSMState.ATTACK and a player is within ENEMY_MELEE_RANGE_PX,
       the enemy deals ENEMY_MELEE_DAMAGE to that player once per ENEMY_ATTACK_COOLDOWN_MS.
       A PlayerHpUpdatedDelta is broadcast immediately.
  AC2: When a player's hp reaches zero from enemy damage, player:downed is broadcast
       with reviveWindowMs set to the correct escalating value from balance.ts
       (downCount=1→60s, 2→40s, 3→20s, 4→10s, 5→5s, ≥6→2s). PlayerState.isDown=true,
       PlayerState.reviveTimerExpiresAt updated.
  AC3: Each server tick checks if any downed player's revive timer has expired. If so,
       player:spirit delta is broadcast; PlayerState.isSpirit=true, isDown=false;
       SpiritFormMsg is sent directly to the downed player's mobile client.
  AC4: Each server tick checks if any living, non-frozen player is within
       REVIVE_RADIUS_PX of a downed player. If so, player:revived delta is broadcast;
       PlayerState.isDown=false, reviveTimerExpiresAt=0; hp restored to REVIVE_HP.
       Only one revive per tick per downed player (first qualifying teammate wins).
  AC5: applyDelta handles player:hp-updated (update hp), player:spirit (set
       isSpirit=true, isDown=false), and updates to player:downed (now carries
       reviveWindowMs). Exhaustiveness guard still compiles.
  AC6: Mobile ControllerScreen shows a 6px HP strip at the top of the screen
       (corruption-blood fill on bg-subtle track, proportional to myPlayer.hp/maxHp).
       When myPlayer.isDown=true, the background shifts to session-color glow,
       3 skill cells show an 80% bg-base locked overlay, the 4th cell shows the
       spirit ability name with a session-color glow border, and the joystick
       remains fully functional.
  AC7: Host DungeonScreen shows a revive-timer overlay (bottom-center) for each
       downed player: player name (Lora 700 sm), countdown in Lora 700 xl (40px),
       accent-warm color when >10s, corruption-blood when ≤10s, accent-corruption
       border always, accent-warm amber halo intensifying toward 0. Multiple timers
       stack vertically. Timer disappears on player:revived or player:spirit.
  AC8: Host DungeonScreen shows player chips (top strip) with 5 HP pips: filled
       accent-warm (alive), empty border color. Spirit-form chip: name text-secondary,
       pips empty, accent-spirit glow rim. Player chips update on PlayerHpUpdatedDelta.
  AC9: tests/unit/player-health.test.ts passes: applyPlayerDamage reduces hp;
       applyPlayerDamage returns downed=true when hp=0; getReviveWindowMs returns
       correct values per downCount; getReviveWindowMs returns 2000 for downCount≥6.
  AC10: tests/contract/net-protocol.test.ts: PlayerHpUpdatedDelta round-trip passes;
        PlayerSpiritDelta round-trip passes; PlayerDownedDelta with reviveWindowMs passes.
  AC11: npm run typecheck clean.
Required hooks:
  - Contract-change hook: 3 new/modified delta types (PlayerHpUpdatedDelta,
    PlayerSpiritDelta, PlayerDownedDelta.reviveWindowMs), PlayerState.reviveTimerExpiresAt.
    Protocol Architect review required.
  - Simulation-safety hook: typecheck + player-health unit tests pass.
  - Client-UX hook (mobile): HP strip visible, downed state visually distinct,
    joystick still works in downed state.
  - Client-UX hook (host): revive-timer visible and color-coded, HP pips correct.
Required tests:
  - tests/unit/player-health.test.ts
  - tests/contract/net-protocol.test.ts — new delta round-trips
Telemetry impact: none this story
```

---

## Story

As a player,
I want to be downed when my health reaches zero and have my teammates race to revive me before my timer runs out,
So that being downed creates urgent, social pressure without immediately ending my contribution to the run.

---

## Acceptance Criteria

**AC1 — Enemy melee damage:**
**Given** an enemy's FSM state is `EnemyFSMState.ATTACK`
**When** a player is within `ENEMY_MELEE_RANGE_PX` and the enemy attack cooldown has expired
**Then** the enemy deals `ENEMY_MELEE_DAMAGE` to the nearest player within range
**And** a `player:hp-updated` delta `{ type: 'player:hp-updated', playerId, hp }` is broadcast immediately

**AC2 — Player downed on hp=0:**
**Given** a player's hp reaches zero from enemy melee damage
**When** `applyPlayerDamage()` returns `downed: true`
**Then** `player:downed` delta is broadcast with `{ playerId, downCount, reviveWindowMs }`
**And** `PlayerState.isDown = true` and `reviveTimerExpiresAt = Date.now() + reviveWindowMs`
**And** the revive window follows the escalating schedule from `balance.ts`:
  downCount=1→60000ms, 2→40000ms, 3→20000ms, 4→10000ms, 5→5000ms, ≥6→2000ms

**AC3 — Spirit form on timer expiry:**
**Given** a player's `reviveTimerExpiresAt` has passed
**When** the server tick checks downed players
**Then** `player:spirit` delta `{ type: 'player:spirit', playerId }` is broadcast to all clients
**And** `PlayerState.isSpirit = true`, `isDown = false`
**And** a `SpiritFormMsg { type: 'spirit:form', isActive: true }` is sent directly to the player's mobile client via `EventNames.SPIRIT_FORM`
**And** the host revive-timer overlay for this player disappears

**AC4 — Revive by proximity:**
**Given** a downed player exists with `isDown = true`
**When** any living, non-frozen, non-downed player is within `REVIVE_RADIUS_PX` of the downed player
**Then** `player:revived` delta is broadcast to all clients
**And** `PlayerState.isDown = false`, `reviveTimerExpiresAt = 0`, `hp = REVIVE_HP`
**And** a `PlayerHpUpdatedDelta` is broadcast for the restored hp
**And** the host revive-timer overlay for this player disappears immediately
**And** the downed player's mobile controller returns to standard combat theme

**AC5 — applyDelta handles all new combat deltas:**
**Given** the exhaustiveness guard from Story 3.3 is in place
**When** new delta types are added
**Then**:
- `player:hp-updated` → update matching player's `hp` in `state.players`
- `player:spirit` → set `isSpirit: true`, `isDown: false` on matching player
- `player:downed` already handled by 3.3; ensure it also sets `isDown: true` and `downCount`
**And** `player:revived` (already in DeltaEventMsg since Epic 2) must be wired in applyDelta to set `isDown: false` and reset `reviveTimerExpiresAt` (if that field exists on the type)
**And** the `satisfies never` guard still compiles — no unhandled variants

**AC6 — Mobile HP strip and downed UI:**
**Given** the mobile controller is in dungeon phase
**When** `myPlayer.hp` and `myPlayer.maxHp` are available from `gameState`
**Then** a 6px HP strip at the top of the phone screen shows `corruption-blood` fill on `bg-subtle` track, proportional to `hp/maxHp`; always visible in dungeon mode

**Given** `myPlayer.isDown === true`
**When** the controller renders
**Then** the root background shifts to a luminous `sessionColor` glow (CSS `radial-gradient` from `--session-color-glow` to `var(--bg-base)`)
**And** skill cells 0–2 show an 80% `bg-base` (`rgba(15,14,16,0.8)`) overlay mask; cell 3 shows the class-specific spirit ability name with a `session-color` glow border; all 4 cells reject touch input (cell 3 is visible but locked until `isSpirit: true` in Story 3.6)
**And** the left joystick zone remains fully functional (movement input continues to the server)

**AC7 — Host revive-timer overlay:**
**Given** one or more players are downed
**When** the host `DungeonScreen` renders
**Then** a `revive-timer` panel appears at bottom-center:
- Container: `bg-surface`, `rounded-md` (6px), min-width 280px, h-padding 16px, v-padding 8px, border `var(--accent-corruption)` 2px
- Player name: Lora 700 sm, `text-primary`
- Countdown: Lora 700 xl (40px minimum), legible at 3 metres; color = `accent-warm` when >10s, `corruption-blood` when ≤10s
- Progress bar: proportional to remaining/window, same color as countdown
- Amber halo: `box-shadow: 0 0 ${intensity}px var(--accent-warm)` where intensity increases as timer approaches 0 (e.g., `8px + (1 - remaining/window) * 32px`)
- Multiple timers: stack vertically, each with the same structure
- Countdown is host-local: computed as `(deadline - Date.now()) / 1000`, where `deadline = receivedAt + reviveWindowMs`

**AC8 — Host player chip health pips:**
**Given** the host `DungeonScreen` shows a top strip of player chips
**When** players take damage (`player:hp-updated` processed via `applyDelta` into `gameState`)
**Then** each player chip shows 5 rectangular pips (12×12px each, gap 4px), filled `accent-warm` proportionally to `hp/maxHp` (pip fills when `hp > i * 20`, where i=0 means first 20hp segment)
**When** a player enters spirit form (`isSpirit: true` after applying `player:spirit` delta)
**Then** the chip shows: name in `text-secondary`, pips empty, `accent-spirit` glow rim (`box-shadow: 0 0 6px var(--accent-spirit)`), a ghost "👻" or "◌" placeholder icon in the pip row area

**AC9 — Unit tests pass:**
**Given** `tests/unit/player-health.test.ts` runs
**Then** all hp reduction, downed detection, and revive window tests pass with no planck imports

**AC10 — Contract tests pass:**
**Given** `tests/contract/net-protocol.test.ts` runs
**Then** `player:hp-updated`, `player:spirit`, and `player:downed` (with reviveWindowMs) round-trips pass

**AC11 — Typecheck clean:**
**Given** `npm run typecheck` across all packages
**Then** no errors; all new deltas `satisfies DeltaEventMsg`

---

## Dev Notes

### Critical dependency: Story 3.4 must be merged first

| 3.4 artifact | Used by 3.5 |
|---|---|
| `PlayerState.essenceTotal` (added in 3.4) | Already in type; don't remove it |
| `applyDamage()` pattern in combat.ts | Model `applyPlayerDamage()` after this pattern |
| Enemy bodies in `enemyBodies` map | Enemy body positions used for melee range check |
| `enemyAttackCooldowns` map (NEW in 3.5) | New, similar to ability cooldowns |
| `applyDelta` exhaustiveness guard | Add new cases before guard breaks |

### What already exists — DO NOT reinvent

**`PlayerDownedDelta`** already in `server-to-host.ts`:
```typescript
export type PlayerDownedDelta = {
  type: 'player:downed';
  playerId: string;
  downCount: number;
};
```
ADD `reviveWindowMs: number` — this is a breaking change to an existing type. Update any existing tests that construct this type.

**`PlayerReviveDelta`** already exists:
```typescript
export type PlayerReviveDelta = {
  type: 'player:revived';
  playerId: string;
};
```
No changes needed to this type.

**`SpiritFormMsg`** in `server-to-mobile.ts` already exists:
```typescript
export interface SpiritFormMsg {
  type: 'spirit:form';
  isActive: boolean;
}
```
Use this for the direct mobile notification when entering spirit form. Add `EventNames.SPIRIT_FORM = 'spirit:form'` to event-names.ts if not already present.

**`PlayerState`** in `player.ts` already has: `hp`, `maxHp`, `isDown`, `isSpirit`, `downCount`, `sessionColor`. Add only `reviveTimerExpiresAt: number` (default 0, 0 = not downed or expired).

**applyDelta** from Story 3.3 has D-2.3-C exhaustiveness guard. Before 3.5 is merged, also verify that `player:downed` and `player:revived` cases were added (they were part of the guard fix in 3.3). If they exist as no-ops, update them now.

---

### New delta types

Add to `packages/net-protocol/src/messages/server-to-host.ts`:

```typescript
export type PlayerHpUpdatedDelta = {
  type: 'player:hp-updated';
  playerId: string;
  hp: number;
};

export type PlayerSpiritDelta = {
  type: 'player:spirit';
  playerId: string;
};
```

Add both to `DeltaEventMsg` union. Export from `packages/net-protocol/src/index.ts`.

Also add `EventNames.SPIRIT_FORM = 'spirit:form'` to `event-names.ts` if absent.

---

### PlayerState change: add reviveTimerExpiresAt

In `packages/shared-types/src/player.ts`:
```typescript
reviveTimerExpiresAt: number;  // server-epoch ms; 0 = not downed
```

In `GameRoom.ts`, `createPlayer()`: add `reviveTimerExpiresAt: 0`.

---

### player-health.ts — new pure system

Create `packages/game-rules/src/systems/player-health.ts`:

```typescript
import type { PlayerState } from 'shared-types';
import type { Result } from '../state/result.js';
import { REVIVE_WINDOWS_MS, REVIVE_HP } from '../balance.js';

export interface PlayerDamageResult {
  player: PlayerState;     // updated state (hp clamped, isDown set)
  downed: boolean;         // true if hp reached 0 and was not already downed
  reviveWindowMs?: number; // defined only if downed=true
}

export type HealthError = { code: string; detail?: string };

// Pure — no planck, no Colyseus, no I/O.
export function applyPlayerDamage(
  player: PlayerState,
  damage: number,
): Result<PlayerDamageResult, HealthError> {
  if (player.isDown || player.isSpirit) {
    return { ok: false, error: { code: 'PLAYER_NOT_DAMAGEABLE' } };
  }
  if (player.isFrozen) {
    return { ok: false, error: { code: 'PLAYER_FROZEN' } };
  }
  if (damage < 0) {
    return { ok: false, error: { code: 'NEGATIVE_DAMAGE', detail: String(damage) } };
  }

  const newHp = Math.max(0, player.hp - damage);
  const downed = newHp === 0;
  const newDownCount = downed ? player.downCount + 1 : player.downCount;
  const reviveWindowMs = downed ? getReviveWindowMs(newDownCount) : undefined;

  const updatedPlayer: PlayerState = {
    ...player,
    hp: newHp,
    isDown: downed,
    downCount: newDownCount,
  };

  return {
    ok: true,
    value: { player: updatedPlayer, downed, reviveWindowMs },
  };
}

// Returns the revive window in ms for a given downCount (1-indexed, post-increment).
export function getReviveWindowMs(downCount: number): number {
  return REVIVE_WINDOWS_MS[Math.min(downCount, REVIVE_WINDOWS_MS.length) - 1] ?? 2000;
}
```

Export from `packages/game-rules/src/index.ts`.

---

### balance.ts additions

Add to `packages/game-rules/src/balance.ts`:

```typescript
import type { PlayerClass } from 'shared-types';

// ── Revive system ────────────────────────────────────────────────────────
// Escalating revive windows per down in the run (not per level). GDD spec.
export const REVIVE_WINDOWS_MS = [60000, 40000, 20000, 10000, 5000, 2000] as const;
// downCount 1→index 0→60s; downCount 6+→index 5→2s

// HP restored on teammate revive (not full heal — intentional friction for repeated downs)
export const REVIVE_HP = 30;

// Distance within which a living player can revive a downed player (pixels in virtual space)
export const REVIVE_RADIUS_PX = 80;

// ── Enemy melee attacks ─────────────────────────────────────────────────
export const ENEMY_MELEE_DAMAGE = 15;       // damage per melee hit
export const ENEMY_MELEE_RANGE_PX = 64;     // must be within this to melee attack
export const ENEMY_ATTACK_COOLDOWN_MS = 1500; // ms between enemy melee attacks

// ── Spirit ability names (display only; mechanics in Story 3.6) ─────────
export const SPIRIT_ABILITY_NAMES: Record<PlayerClass, string> = {
  stonehide:    'Earthen Vigil',
  spiritcaller: 'Soul Tether',
  souldrinker:  'Void Drain',
  stormcaller:  'Storm Echo',
};
```

---

### GameRoom.ts changes

Read the full `GameRoom.ts` as modified by Story 3.4. Changes are surgical — only the tick method and close-room cleanup change.

**1. New private fields:**
```typescript
private enemyAttackCooldowns = new Map<string, number>(); // enemyId → expiry epoch
```

Initialize enemy attack cooldowns when enemies are spawned in `spawnEnemies()`:
```typescript
this.enemyAttackCooldowns.set(enemy.id, 0);
```

Clean up in `onDispose()` or when enemy is killed (delete from map when enemy is removed).

**2. Import additions:**
```typescript
import { applyPlayerDamage, getReviveWindowMs, ENEMY_MELEE_DAMAGE, ENEMY_MELEE_RANGE_PX, ENEMY_ATTACK_COOLDOWN_MS, REVIVE_RADIUS_PX, REVIVE_HP } from 'game-rules';
import { SPIRIT_ABILITY_NAMES } from 'game-rules';  // for future spirit form use; import now to avoid forgetting
import { EnemyFSMState } from 'shared-types';  // check exact name from Story 3.2 implementation
```

**3. Add enemy melee block in `tick()`** (add AFTER the existing ability dispatch block, BEFORE the cooldown expiry check):

```typescript
// ── Enemy melee attacks ───────────────────────────────────────────────────
if (this.gameState.session.phase === 'dungeon') {
  const nowMelee = Date.now();

  for (const enemy of this.gameState.enemies) {
    if (!enemy.isAlive) continue;
    // ponytail: only ATTACK-state enemies deal melee damage; FSM handles state transitions
    if (enemy.fsmState !== EnemyFSMState.ATTACK) continue;

    const attackExpiry = this.enemyAttackCooldowns.get(enemy.id) ?? 0;
    if (attackExpiry > nowMelee) continue;  // still on attack cooldown

    // Find nearest non-downed, non-frozen player in melee range
    let targetPlayer = null;
    let minDist = Infinity;
    for (const player of this.gameState.players) {
      if (player.isDown || player.isSpirit || player.isFrozen) continue;
      const dx = player.x - enemy.x;
      const dy = player.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < ENEMY_MELEE_RANGE_PX && dist < minDist) {
        minDist = dist;
        targetPlayer = player;
      }
    }
    if (!targetPlayer) continue;

    const dmgResult = applyPlayerDamage(targetPlayer, ENEMY_MELEE_DAMAGE);
    if (!dmgResult.ok) continue;

    // Update state
    const pi = this.gameState.players.findIndex(p => p.id === targetPlayer!.id);
    if (pi !== -1) this.gameState.players[pi] = dmgResult.value.player;
    this.enemyAttackCooldowns.set(enemy.id, nowMelee + ENEMY_ATTACK_COOLDOWN_MS);

    // Broadcast hp update
    const hpDelta = {
      type: 'player:hp-updated' as const,
      playerId: targetPlayer.id,
      hp: dmgResult.value.player.hp,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, hpDelta);

    if (dmgResult.value.downed) {
      const windowMs = dmgResult.value.reviveWindowMs!;
      this.gameState.players[pi]!.reviveTimerExpiresAt = nowMelee + windowMs;

      const downedDelta = {
        type: 'player:downed' as const,
        playerId: targetPlayer.id,
        downCount: dmgResult.value.player.downCount,
        reviveWindowMs: windowMs,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, downedDelta);

      // Send spirit:form preview to mobile (cell 3 becomes visible but locked)
      const targetClient = this.clients.find(c => c.sessionId === targetPlayer!.id);
      if (targetClient) {
        targetClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
        // ponytail: isActive=false = downed (preview mode); isActive=true = full spirit form (timer expired)
      }

      logger.info({ roomId: this.roomId, playerId: targetPlayer.id, downCount: dmgResult.value.player.downCount, windowMs }, 'player downed');
    }
  }
}
```

**4. Add revive checks in `tick()`** (add AFTER enemy melee block):

```typescript
// ── Revive timer expiry and proximity revive ─────────────────────────────
if (this.gameState.session.phase === 'dungeon') {
  const nowRevive = Date.now();

  for (const player of this.gameState.players) {
    if (!player.isDown) continue;

    // Timer expiry → spirit form
    if (player.reviveTimerExpiresAt > 0 && nowRevive >= player.reviveTimerExpiresAt) {
      player.isDown = false;
      player.isSpirit = true;
      player.reviveTimerExpiresAt = 0;

      const spiritDelta = {
        type: 'player:spirit' as const,
        playerId: player.id,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, spiritDelta);

      const spiritClient = this.clients.find(c => c.sessionId === player.id);
      if (spiritClient) {
        spiritClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: true } satisfies SpiritFormMsg);
      }

      logger.info({ roomId: this.roomId, playerId: player.id }, 'player entered spirit form (timer expired)');
      continue;  // skip proximity revive check for this player this tick
    }

    // Proximity revive: first living teammate in range wins
    let revivedBy = null;
    for (const teammate of this.gameState.players) {
      if (teammate.id === player.id) continue;
      if (teammate.isDown || teammate.isSpirit || teammate.isFrozen) continue;
      const dx = teammate.x - player.x;
      const dy = teammate.y - player.y;
      if (Math.sqrt(dx * dx + dy * dy) <= REVIVE_RADIUS_PX) {
        revivedBy = teammate.id;
        break;
      }
    }

    if (revivedBy !== null) {
      player.isDown = false;
      player.hp = REVIVE_HP;
      player.reviveTimerExpiresAt = 0;

      const revivedDelta = {
        type: 'player:revived' as const,
        playerId: player.id,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, revivedDelta);

      const hpAfterRevive = {
        type: 'player:hp-updated' as const,
        playerId: player.id,
        hp: REVIVE_HP,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, hpAfterRevive);

      // Tell mobile to return to combat theme
      const revivedClient = this.clients.find(c => c.sessionId === player.id);
      if (revivedClient) {
        revivedClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
        // ponytail: isActive=false after revive = return to normal (not downed)
        // Mobile needs to distinguish downed vs revived — see Mobile notes below
      }

      logger.info({ roomId: this.roomId, playerId: player.id, revivedBy }, 'player revived by proximity');
    }
  }
}
```

> **Note on `spirit:form` semantics:** The `SpiritFormMsg.isActive` bool is overloaded — `false` means both "you are now downed (preview)" and "you are revived (back to normal)". This is ambiguous. Consider using the `player:downed` delta directly on the mobile client (since it listens to `gameState`) to detect the downed state rather than relying on `SpiritFormMsg`. The mobile controller should derive its state from `myPlayer.isDown` and `myPlayer.isSpirit` in `gameState` — `SpiritFormMsg` is supplementary. See Mobile section for the implementation approach.

---

### applyDelta.ts additions

Add to `packages/net-protocol/src/apply-delta.ts`:

```typescript
case 'player:hp-updated': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, hp: evt.hp } : p
    ),
  };
}
case 'player:spirit': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, isSpirit: true, isDown: false, reviveTimerExpiresAt: 0 } : p
    ),
  };
}
```

Also update the existing `player:downed` case (if present as a no-op from 3.3):
```typescript
case 'player:downed': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, isDown: true, downCount: evt.downCount } : p
    ),
  };
  // Note: reviveTimerExpiresAt is server-epoch and not stored on client from delta.
  // Host computes its own local deadline: Date.now() + evt.reviveWindowMs.
}
```

And the existing `player:revived` case:
```typescript
case 'player:revived': {
  if (!state.players.some(p => p.id === evt.playerId)) return state;
  return {
    ...state,
    players: state.players.map(p =>
      p.id === evt.playerId ? { ...p, isDown: false, reviveTimerExpiresAt: 0 } : p
    ),
  };
}
```

---

### Mobile controller — HP strip and downed state

Read `ControllerScreen.tsx` in full before editing. Changes are additive to the existing component.

**1. HP strip (top of screen):**

The UX spec says "A 6px HP strip — corruption-blood fill on bg-subtle track, indicating current health. Always visible during gameplay." Add this at the top of the root `ControllerScreen` layout:

```tsx
// Derive at top of ControllerScreen component:
const myPlayer = gameState?.players.find(p => p.id === session?.playerId) ?? null;
const hpFraction = myPlayer ? myPlayer.hp / myPlayer.maxHp : 1;
const inDungeon = gameState?.session.phase === 'dungeon';

// In JSX, above the left/right zone split (as a sibling positioned element):
{inDungeon && myPlayer && (
  <div style={{
    position: 'absolute',
    top: 'env(safe-area-inset-top, 0px)',
    left: 0,
    right: 0,
    height: 6,
    background: 'var(--bg-subtle)',
    zIndex: 40,
    pointerEvents: 'none',
  }}>
    <div style={{
      height: '100%',
      width: `${hpFraction * 100}%`,
      background: 'var(--corruption-blood)',
      transition: 'width 150ms ease-out',
    }} />
  </div>
)}
```

**2. Downed state:**

Derive `isDown` from `gameState`:
```typescript
const isDown = myPlayer?.isDown ?? false;
const isSpirit = myPlayer?.isSpirit ?? false;
```

The existing skill cell `isInteractive` logic uses `trainingDummyActive || inDungeon`. When downed, cells should NOT be interactive even in dungeon. Update:
```typescript
const isInteractive = (trainingDummyActive || (inDungeon && !isDown && !isSpirit)) && ability !== null && !isOnCooldown;
```

**3. Downed background and cell overlays:**

Add a root background modifier when `isDown || isSpirit`:
```tsx
// On the root div, add dynamic background:
background: (isDown || isSpirit)
  ? `radial-gradient(ellipse at center, ${sessionColorToGlow(myPlayer?.sessionColor ?? 'red')} 0%, var(--bg-base) 60%)`
  : 'var(--bg-base)',
```

Where `sessionColorToGlow()` maps `SessionColor` enum to a CSS color:
```typescript
const SESSION_COLOR_VALUES: Record<SessionColor, string> = {
  [SessionColor.RED]:    'rgba(231,76,60,0.25)',
  [SessionColor.BLUE]:   'rgba(52,152,219,0.25)',
  [SessionColor.GREEN]:  'rgba(46,204,113,0.25)',
  [SessionColor.YELLOW]: 'rgba(241,196,15,0.25)',
  [SessionColor.PURPLE]: 'rgba(155,89,182,0.25)',
  [SessionColor.ORANGE]: 'rgba(230,126,34,0.25)',
  [SessionColor.PINK]:   'rgba(255,105,180,0.25)',
  [SessionColor.TEAL]:   'rgba(26,188,156,0.25)',
};
```

**4. Skill cell locked overlay and spirit cell:**

In the `[0,1,2,3].map(i => ...)` for skill cells, add downed overlay:
- Cells 0–2 when `isDown || isSpirit`: render a semi-opaque mask (`pointerEvents: 'none'`) as an absolute overlay `rgba(15,14,16,0.8)` covering the cell.
- Cell 3 when `isDown`: show the spirit ability name (from `SPIRIT_ABILITY_NAMES[confirmedClass]`). Use session-color glow border. Cell remains non-interactive (Story 3.6 makes it activatable when `isSpirit`).

```tsx
// In the skill cell grid, for index 3 when isDown:
const spiritAbilityName = (isDown && confirmedClass)
  ? SPIRIT_ABILITY_NAMES[confirmedClass]  // import from 'game-rules'
  : null;
```

In `SkillCell`, add a `downedOverlay?: boolean` and `spiritName?: string | null` prop, or handle it in the parent mapping.

> **Important:** The mobile controller derives downed state from `myPlayer.isDown` in `gameState` (updated via `applyDelta` processing `player:downed`). Do NOT rely on `SpiritFormMsg` as the primary trigger — gameState is the single source of truth. `SpiritFormMsg` is supplementary and may arrive out of order relative to the next snapshot.

**5. Mobile distinguishes downed vs revived via gameState:**

When `myPlayer.isDown` goes from `true` to `false` (via `player:revived` delta → `applyDelta` → new gameState), the background gradient and cell overlays should clear automatically since they derive from `isDown`.

---

### DungeonScreen.tsx — revive-timer and player chips

Read the file as modified by Story 3.4 before editing.

**1. Top player strip — player chips with HP pips:**

Add a PixiJS-free HTML overlay above the canvas for the player strip (follows the pattern of the existing HTML overlay for the `ability:fired` flash). OR: implement within PixiJS. Recommendation: use HTML overlay for the player strip (simpler React state management).

Add a `<div>` overlay for player chips:
```tsx
<div style={{
  position: 'absolute',
  top: 0, left: 0, right: 0,
  height: 48,
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: '0 16px',
  background: 'rgba(15,14,16,0.6)',
  backdropFilter: 'blur(4px)',
  zIndex: 10,
  pointerEvents: 'none',
}}>
  {gameState?.players.map(player => (
    <PlayerChipHUD key={player.id} player={player} />
  ))}
</div>
```

`PlayerChipHUD` (local component in DungeonScreen.tsx, not in PlayerSlot.tsx — different context):
- Name: Lora 700 base (16px), text-primary, max 10 chars with ellipsis
- 5 pips: 12×12px each, gap 4px, filled `accent-warm` when `hp > i * 20`
- Spirit state: name text-secondary, pips empty, accent-spirit glow rim, ghost placeholder
- Read `player.isSpirit` from `gameState` (updated via `player:spirit` delta → `applyDelta`)

**2. Revive timer overlay (HTML, bottom-center):**

Track downed players' local deadline in a React `useRef` map:
```typescript
const reviveDeadlinesRef = useRef<Map<string, { deadline: number; windowMs: number; name: string }>>(new Map());
```

When `latestCombatEvent` is `player:downed`, add/update entry:
```typescript
useEffect(() => {
  if (!latestCombatEvent) return;
  if (latestCombatEvent.type === 'player:downed') {
    const player = gameState?.players.find(p => p.id === latestCombatEvent.playerId);
    const name = player?.displayName ?? latestCombatEvent.playerId;
    reviveDeadlinesRef.current.set(latestCombatEvent.playerId, {
      deadline: Date.now() + latestCombatEvent.reviveWindowMs,
      windowMs: latestCombatEvent.reviveWindowMs,
      name,
    });
  } else if (latestCombatEvent.type === 'player:revived' || latestCombatEvent.type === 'player:spirit') {
    reviveDeadlinesRef.current.delete(latestCombatEvent.playerId);
  }
}, [latestCombatEvent]);
```

Force re-renders while timers are active (to update countdown display):
```typescript
const anyTimerActive = reviveDeadlinesRef.current.size > 0;
const [tick, setTick] = useState(0);
useEffect(() => {
  if (!anyTimerActive) return;
  const id = setInterval(() => setTick(t => t + 1), 100);
  return () => clearInterval(id);
}, [anyTimerActive]);
void tick;  // suppress unused warning — used to trigger re-render
```

> **Note on `latestCombatEvent`:** Story 3.4 introduced a `latestCombatEvent` (or similar) state in `App.tsx`. Extend it to also forward `player:downed`, `player:revived`, and `player:spirit` deltas to `DungeonScreen`. Adjust the prop/state name to `latestVisualEvent` or keep the existing name but add the new types to the forwarding logic.

Render revive timer panels:
```tsx
<div style={{ position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)', display: 'flex', flexDirection: 'column', gap: 8, zIndex: 20 }}>
  {Array.from(reviveDeadlinesRef.current.entries()).map(([playerId, { deadline, windowMs, name }]) => {
    const remaining = Math.max(0, deadline - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    const fraction = remaining / windowMs;
    const isUrgent = remaining > 10000;
    const timerColor = isUrgent ? 'var(--accent-warm)' : 'var(--corruption-blood)';
    const haloSize = 8 + (1 - fraction) * 32;

    return (
      <div key={playerId} style={{
        background: 'var(--bg-surface)',
        border: '2px solid var(--accent-corruption)',
        borderRadius: 6,
        padding: '8px 16px',
        minWidth: 280,
        textAlign: 'center',
        boxShadow: `0 0 ${haloSize}px var(--accent-warm)`,
      }}>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)', color: 'var(--text-primary)' }}>
          {name}
        </div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 40, color: timerColor, lineHeight: 1 }}>
          {seconds}
        </div>
        <div style={{ height: 4, background: 'var(--border)', borderRadius: 2, marginTop: 4 }}>
          <div style={{ height: '100%', width: `${fraction * 100}%`, background: timerColor, borderRadius: 2, transition: 'width 100ms linear' }} />
        </div>
      </div>
    );
  })}
</div>
```

---

### tests/unit/player-health.test.ts

```typescript
import { describe, it, expect } from 'vitest';
import { applyPlayerDamage, getReviveWindowMs } from 'game-rules';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
  return {
    id: 'p1',
    displayName: 'TestPlayer',
    class: PlayerClass.STONEHIDE,
    x: 500, y: 300,
    hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
    essenceTotal: 0,
    reviveTimerExpiresAt: 0,
    ...overrides,
  };
}

describe('applyPlayerDamage', () => {
  it('reduces hp by damage', () => {
    const r = applyPlayerDamage(mockPlayer(), 15);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.player.hp).toBe(85);
      expect(r.value.downed).toBe(false);
    }
  });

  it('clamps to 0 and sets downed=true when damage >= hp', () => {
    const r = applyPlayerDamage(mockPlayer({ hp: 10 }), 50);
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.value.player.hp).toBe(0);
      expect(r.value.player.isDown).toBe(true);
      expect(r.value.downed).toBe(true);
      expect(r.value.reviveWindowMs).toBeDefined();
    }
  });

  it('increments downCount when downed', () => {
    const r = applyPlayerDamage(mockPlayer({ hp: 5, downCount: 2 }), 100);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.player.downCount).toBe(3);
  });

  it('returns error if player is already down', () => {
    const r = applyPlayerDamage(mockPlayer({ isDown: true, hp: 0 }), 10);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error.code).toBe('PLAYER_NOT_DAMAGEABLE');
  });

  it('returns error for negative damage', () => {
    const r = applyPlayerDamage(mockPlayer(), -5);
    expect(r.ok).toBe(false);
  });

  it('does not mutate the original player object', () => {
    const p = mockPlayer();
    applyPlayerDamage(p, 10);
    expect(p.hp).toBe(100);
  });
});

describe('getReviveWindowMs', () => {
  it('returns 60000 for downCount=1', () => expect(getReviveWindowMs(1)).toBe(60000));
  it('returns 40000 for downCount=2', () => expect(getReviveWindowMs(2)).toBe(40000));
  it('returns 20000 for downCount=3', () => expect(getReviveWindowMs(3)).toBe(20000));
  it('returns 10000 for downCount=4', () => expect(getReviveWindowMs(4)).toBe(10000));
  it('returns 5000 for downCount=5',  () => expect(getReviveWindowMs(5)).toBe(5000));
  it('returns 2000 for downCount=6',  () => expect(getReviveWindowMs(6)).toBe(2000));
  it('returns 2000 for downCount=10 (capped)', () => expect(getReviveWindowMs(10)).toBe(2000));
});
```

> **Note on `mockPlayer` FSM fields:** If Story 3.2 added any required fields to `PlayerState` (unlikely — FSM fields are on EnemyState), add them to `mockPlayer`. Check the actual type after 3.4 is merged.

---

### tests/contract/net-protocol.test.ts additions

```typescript
it('player:hp-updated delta survives serialize → deserialize', () => {
  const delta = { type: 'player:hp-updated' as const, playerId: 'p1', hp: 65 } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});

it('player:spirit delta survives serialize → deserialize', () => {
  const delta = { type: 'player:spirit' as const, playerId: 'p1' } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});

it('player:downed delta with reviveWindowMs survives serialize → deserialize', () => {
  const delta = { type: 'player:downed' as const, playerId: 'p1', downCount: 2, reviveWindowMs: 40000 } satisfies DeltaEventMsg;
  expect(deserialize<DeltaEventMsg>(serialize(delta))).toEqual(delta);
});
```

---

### Deferred items addressed

| Deferred | Fix |
|---|---|
| `story 3.x` comment on enemy melee damage | Implemented via EnemyFSMState.ATTACK check in tick |
| `player:downed` no-op in applyDelta (3.3 guard) | Updated to set isDown/downCount |
| `player:revived` no-op in applyDelta (3.3 guard) | Updated to clear isDown |

### Deferred items NOT addressed this story

| Deferred | Reason |
|---|---|
| D-3.1-D — filterCategory/filterMask | Still deferred; melee uses proximity scan, not planck contacts |
| Spirit ability mechanics (cell 3 activatable) | Story 3.6 |
| Run failure when all players are spirit | Story 3.6 |

### Hooks triggered

| Hook | Required action |
|---|---|
| Contract-change hook | 2 new delta types + 1 modified type + PlayerState field + reviveWindowMs added to PlayerDownedDelta |
| Simulation-safety hook | typecheck + player-health unit tests pass |
| Client-UX hook (mobile) | HP strip visible, downed background visible, cell overlays correct, joystick works |
| Client-UX hook (host) | revive-timer color-coded, player chip pips update, spirit chip state correct |

### What remains after this story

- Story 3.6: spirit form interactions (movement in spirit, cell 3 activatable, spirit ability fires, run failure)
- Story 3.7: Clear objective (all enemies dead → `level:complete`)
- Enemy ranged attacks (RANGED enemy type) — deferred beyond Epic 3
```
