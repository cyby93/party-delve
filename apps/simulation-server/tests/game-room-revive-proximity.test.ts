/**
 * Tests for Story 3.21b — the "Revive timer expiry and proximity revive"
 * per-tick block in GameRoom.ts, driven tick-by-tick.
 *
 * GameRoom isn't instantiable outside a live Colyseus room (same constraint
 * as game-room-soul-mend-channel.test.ts), so this mirrors GameRoom's exact
 * per-tick revive orchestration — including the critical guard fix this
 * story adds (`if (!player.isDown && !player.isSpirit) continue;`, replacing
 * the pre-existing `if (!player.isDown) continue;`). Without that guard fix,
 * a player who has already transitioned to spirit form can never re-enter
 * this loop on any later tick, so the proximity-revive check — even once
 * repointed at bodyX/bodyY — never actually runs for them. This test proves
 * the fixed guard is what makes AC3's "regardless of where the spirit has
 * moved" claim true at runtime, not just in the distance formula.
 */
import { describe, it, expect } from 'vitest';
import { REVIVE_HP, REVIVE_RADIUS_PX } from 'game-rules';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

const TICK_MS = 33;

function mockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1', displayName: 'Test', class: PlayerClass.STONEHIDE,
    x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    sessionColor: SessionColor.RED, downCount: 0, nearPoiId: null,
    essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
    channelingAbility: null,
    ...overrides,
  };
}

type Delta = { type: string; [k: string]: unknown };

/** Mirrors GameRoom.ts's "Revive timer expiry and proximity revive" block verbatim,
 *  including the Story 3.21b guard fix. */
function tickRevive(players: PlayerState[], nowMs: number, deltas: Delta[]): void {
  for (const player of players) {
    if (!player.isDown && !player.isSpirit) continue;

    if (player.reviveTimerExpiresAt > 0 && nowMs >= player.reviveTimerExpiresAt) {
      const piExpiry = players.findIndex(p => p.id === player.id);
      players[piExpiry] = { ...players[piExpiry]!, isDown: false, isSpirit: true, reviveTimerExpiresAt: 0 };
      deltas.push({ type: 'player:spirit', playerId: player.id });
      continue;
    }

    let revivedBy: string | null = null;
    const targetX = player.bodyX ?? player.x;
    const targetY = player.bodyY ?? player.y;
    for (const teammate of players) {
      if (teammate.id === player.id) continue;
      if (teammate.isDown || teammate.isSpirit || teammate.isFrozen) continue;
      const dx = teammate.x - targetX;
      const dy = teammate.y - targetY;
      if (Math.sqrt(dx * dx + dy * dy) <= REVIVE_RADIUS_PX) {
        revivedBy = teammate.id;
        break;
      }
    }

    if (revivedBy !== null) {
      const piRevive = players.findIndex(p => p.id === player.id);
      players[piRevive] = { ...players[piRevive]!, isDown: false, isSpirit: false, hp: REVIVE_HP, reviveTimerExpiresAt: 0, x: targetX, y: targetY };
      deltas.push({ type: 'player:revived', playerId: player.id });
      deltas.push({ type: 'player:moved', playerId: player.id, x: targetX, y: targetY });
    }
  }
}

describe('GameRoom revive-proximity loop (Story 3.21b)', () => {
  it('revives an isDown player when a teammate reaches bodyX/bodyY (pre-spirit case, unchanged behavior)', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'downed', isDown: true, x: 500, y: 300, bodyX: 500, bodyY: 300, reviveTimerExpiresAt: 99999 }),
      mockPlayer({ id: 'rescuer', x: 500, y: 300 }),
    ];
    const deltas: Delta[] = [];
    tickRevive(players, 0, deltas);

    expect(players[0]!.isDown).toBe(false);
    expect(players[0]!.hp).toBe(REVIVE_HP);
    expect(deltas).toContainEqual({ type: 'player:revived', playerId: 'downed' });
  });

  it('a spirit that has wandered away from its body IS still found and revived at the body location (the core fix)', () => {
    // Player went down at (500, 300), then wandered off as a spirit to (2000, 2000).
    const players: PlayerState[] = [
      mockPlayer({ id: 'spirit', isDown: false, isSpirit: true, x: 2000, y: 2000, bodyX: 500, bodyY: 300, reviveTimerExpiresAt: 0 }),
      mockPlayer({ id: 'rescuer', x: 500, y: 300 }), // stands at the BODY, not the spirit
    ];
    const deltas: Delta[] = [];
    tickRevive(players, 1000, deltas);

    expect(players[0]!.isDown).toBe(false);
    expect(players[0]!.isSpirit).toBe(false);
    expect(players[0]!.hp).toBe(REVIVE_HP);
    // Revived at the body's location, not wherever the spirit had wandered to.
    expect(players[0]!.x).toBe(500);
    expect(players[0]!.y).toBe(300);
    expect(deltas).toContainEqual({ type: 'player:revived', playerId: 'spirit' });
    expect(deltas).toContainEqual({ type: 'player:moved', playerId: 'spirit', x: 500, y: 300 });
  });

  it('a rescuer standing where the spirit currently is (not at the body) does NOT trigger a revive', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'spirit', isDown: false, isSpirit: true, x: 2000, y: 2000, bodyX: 500, bodyY: 300, reviveTimerExpiresAt: 0 }),
      mockPlayer({ id: 'rescuer', x: 2000, y: 2000 }), // stands at the SPIRIT, not the body
    ];
    const deltas: Delta[] = [];
    tickRevive(players, 1000, deltas);

    expect(players[0]!.isSpirit).toBe(true); // still a spirit — not revived
    expect(deltas).toEqual([]);
  });

  it('timer expiry transitions isDown -> isSpirit and does not also revive on the same tick', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'downed', isDown: true, x: 500, y: 300, bodyX: 500, bodyY: 300, reviveTimerExpiresAt: 1000 }),
      mockPlayer({ id: 'rescuer', x: 500, y: 300 }),
    ];
    const deltas: Delta[] = [];
    tickRevive(players, 1000, deltas);

    expect(players[0]!.isDown).toBe(false);
    expect(players[0]!.isSpirit).toBe(true);
    expect(deltas).toEqual([{ type: 'player:spirit', playerId: 'downed' }]);
  });

  it('multi-tick: stays a wandering spirit until a rescuer reaches the body, across several ticks', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'spirit', isDown: false, isSpirit: true, x: 2000, y: 2000, bodyX: 500, bodyY: 300 }),
      mockPlayer({ id: 'rescuer', x: 0, y: 0 }), // starts far from the body
    ];
    const deltas: Delta[] = [];

    for (let nowMs = 0; nowMs < 300; nowMs += TICK_MS) {
      tickRevive(players, nowMs, deltas);
      expect(players[0]!.isSpirit).toBe(true); // rescuer hasn't arrived yet
    }

    // Rescuer arrives at the body location.
    players[1] = { ...players[1]!, x: 500, y: 300 };
    tickRevive(players, 300, deltas);

    expect(players[0]!.isSpirit).toBe(false);
    expect(players[0]!.x).toBe(500);
    expect(players[0]!.y).toBe(300);
  });
});
