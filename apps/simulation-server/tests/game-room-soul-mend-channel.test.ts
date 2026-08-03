/**
 * Tests for Story 3.18 — Soul Mend's hold-to-channel revive, driven tick-by-
 * tick (30Hz, 33ms per tick) rather than as a single pure-function call.
 *
 * GameRoom isn't instantiable outside a live Colyseus room (same constraint
 * as game-room-host-join.test.ts and game-room-level-clear-guard.test.ts), so
 * this mirrors GameRoom's per-tick Soul Mend orchestration using the real
 * exported game-rules pure functions (findSoulMendTarget,
 * shouldCancelSoulMendChannel, reviveBySoulMend) — a regression in the real
 * logic those functions implement will also break this test.
 */
import { describe, it, expect } from 'vitest';
import {
  findSoulMendTarget, shouldCancelSoulMendChannel, reviveBySoulMend,
  ABILITY_GEOMETRY, REVIVE_HP,
  SOUL_MEND_CHANNEL_DURATION_MS, SOUL_MEND_LIVENESS_MS,
} from 'game-rules';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

const TICK_MS = 33; // mirrors mobile's continuous-send interval and the 30Hz tick rate
const ABILITY_INDEX = 2; // Soul Mend — Spiritcaller slot 2
const HIT_RANGE = ABILITY_GEOMETRY[PlayerClass.SPIRITCALLER][ABILITY_INDEX].hitRangePx;
const HIT_RADIUS = ABILITY_GEOMETRY[PlayerClass.SPIRITCALLER][ABILITY_INDEX].hitRadiusPx;
const MAX_RANGE = HIT_RANGE + HIT_RADIUS;

function mockPlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1', displayName: 'Test', class: PlayerClass.SPIRITCALLER,
    x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    sessionColor: SessionColor.RED, downCount: 0, nearPoiId: null,
    essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
    channelingAbility: null,
    ...overrides,
  };
}

type Delta = { type: string; [k: string]: unknown };

// Mirrors GameRoom's per-tick Soul Mend phase (cancel checks, then completion).
function tickSoulMend(
  players: PlayerState[],
  lastSoulMendInputAt: Map<string, number>,
  nowMs: number,
  deltas: Delta[],
): void {
  for (let i = 0; i < players.length; i++) {
    const caster = players[i]!;
    const channel = caster.channelingAbility;
    if (channel === null) continue;

    const target = players.find(p => p.id === channel.targetPlayerId);
    const lastInput = lastSoulMendInputAt.get(caster.id) ?? 0;
    const casterIncapacitated = caster.isDown || caster.isFrozen || caster.isSpirit;

    if (shouldCancelSoulMendChannel(target, caster.x, caster.y, casterIncapacitated, lastInput, nowMs, SOUL_MEND_LIVENESS_MS, MAX_RANGE)) {
      players[i] = { ...caster, channelingAbility: null };
      lastSoulMendInputAt.delete(caster.id);
      deltas.push({ type: 'cast:cancelled', casterId: caster.id });
      continue;
    }

    if (nowMs >= channel.startedAt + channel.durationMs) {
      const targetIdx = players.findIndex(p => p.id === target!.id);
      players[targetIdx] = reviveBySoulMend(players[targetIdx]!, REVIVE_HP);
      players[i] = { ...caster, channelingAbility: null };
      lastSoulMendInputAt.delete(caster.id);
      deltas.push({ type: 'player:revived', playerId: target!.id });
      deltas.push({ type: 'cast:completed', casterId: caster.id });
    }
  }
}

// Mirrors GameRoom's handleSoulMendFireAttempt for a not-yet-channeling caster.
function fireSoulMend(
  players: PlayerState[],
  lastSoulMendInputAt: Map<string, number>,
  casterId: string,
  nowMs: number,
  deltas: Delta[],
): void {
  const casterIdx = players.findIndex(p => p.id === casterId);
  const caster = players[casterIdx]!;
  if (caster.channelingAbility !== null) {
    lastSoulMendInputAt.set(casterId, nowMs);
    return;
  }
  const downedAllies = players.filter(p => p.id !== casterId && p.isDown);
  const target = findSoulMendTarget(caster.x, caster.y, 1, 0, downedAllies, HIT_RANGE, HIT_RADIUS);
  if (!target) return;
  players[casterIdx] = {
    ...caster,
    channelingAbility: { abilityIndex: ABILITY_INDEX, targetPlayerId: target.id, startedAt: nowMs, durationMs: SOUL_MEND_CHANNEL_DURATION_MS },
  };
  lastSoulMendInputAt.set(casterId, nowMs);
  deltas.push({ type: 'cast:started', casterId, targetPlayerId: target.id });
}

describe('Soul Mend channel — multi-tick progression', () => {
  it('starts on first fire-attempt, stays active across many ticks, and completes exactly when the channel duration elapses', () => {
    let players: PlayerState[] = [
      mockPlayer({ id: 'caster', x: 0, y: 0 }),
      mockPlayer({ id: 'target', x: HIT_RANGE, y: 0, isDown: true }),
    ];
    const lastInput = new Map<string, number>();
    const deltas: Delta[] = [];

    let nowMs = 0;
    fireSoulMend(players, lastInput, 'caster', nowMs, deltas);
    expect(players[0]!.channelingAbility).not.toBeNull();
    expect(deltas).toContainEqual({ type: 'cast:started', casterId: 'caster', targetPlayerId: 'target' });

    // Drive real per-tick progression: continuous-send every 33ms, exactly the
    // mobile-controller interval, for several ticks short of channel completion.
    for (nowMs = TICK_MS; nowMs < SOUL_MEND_CHANNEL_DURATION_MS; nowMs += TICK_MS) {
      fireSoulMend(players, lastInput, 'caster', nowMs, deltas);
      tickSoulMend(players, lastInput, nowMs, deltas);
      expect(players[0]!.channelingAbility).not.toBeNull();
      expect(players[1]!.isDown).toBe(true);
    }

    // One more tick at/after the duration completes the channel.
    nowMs += TICK_MS;
    fireSoulMend(players, lastInput, 'caster', nowMs, deltas);
    tickSoulMend(players, lastInput, nowMs, deltas);

    expect(players[0]!.channelingAbility).toBeNull();
    expect(players[1]!.isDown).toBe(false);
    expect(players[1]!.hp).toBe(REVIVE_HP);
    expect(deltas).toContainEqual({ type: 'player:revived', playerId: 'target' });
    expect(deltas).toContainEqual({ type: 'cast:completed', casterId: 'caster' });
  });

  it('cancels via liveness timeout across multiple ticks once input stops arriving (e.g. caster disconnects mid-channel)', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'caster', x: 0, y: 0 }),
      mockPlayer({ id: 'target', x: HIT_RANGE, y: 0, isDown: true }),
    ];
    const lastInput = new Map<string, number>();
    const deltas: Delta[] = [];

    fireSoulMend(players, lastInput, 'caster', 0, deltas);
    expect(players[0]!.channelingAbility).not.toBeNull();

    // Input stops arriving entirely (disconnect grace-freeze: no messages sent).
    // Tick forward — a few ticks under the liveness threshold must not cancel yet.
    let nowMs = 0;
    for (; nowMs <= SOUL_MEND_LIVENESS_MS; nowMs += TICK_MS) {
      tickSoulMend(players, lastInput, nowMs, deltas);
    }
    expect(players[0]!.channelingAbility).not.toBeNull();

    // Cross the liveness threshold — the very next tick must cancel.
    nowMs += TICK_MS;
    tickSoulMend(players, lastInput, nowMs, deltas);
    expect(players[0]!.channelingAbility).toBeNull();
    expect(deltas).toContainEqual({ type: 'cast:cancelled', casterId: 'caster' });
    // No ability effect applied on a cancelled cast.
    expect(players[1]!.isDown).toBe(true);
  });

  it('cancels mid-channel if the target is revived by someone else before completion', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'caster', x: 0, y: 0 }),
      mockPlayer({ id: 'target', x: HIT_RANGE, y: 0, isDown: true }),
    ];
    const lastInput = new Map<string, number>();
    const deltas: Delta[] = [];

    fireSoulMend(players, lastInput, 'caster', 0, deltas);
    for (let nowMs = TICK_MS; nowMs < SOUL_MEND_CHANNEL_DURATION_MS / 2; nowMs += TICK_MS) {
      fireSoulMend(players, lastInput, 'caster', nowMs, deltas);
      tickSoulMend(players, lastInput, nowMs, deltas);
    }
    expect(players[0]!.channelingAbility).not.toBeNull();

    // Someone else revives the target by proximity mid-channel.
    players[1] = { ...players[1]!, isDown: false, hp: REVIVE_HP, reviveTimerExpiresAt: 0 };

    tickSoulMend(players, lastInput, SOUL_MEND_CHANNEL_DURATION_MS / 2 + TICK_MS, deltas);
    expect(players[0]!.channelingAbility).toBeNull();
    expect(deltas).toContainEqual({ type: 'cast:cancelled', casterId: 'caster' });
  });

  it('cancels immediately if the caster is downed mid-channel (e.g. a boss stomp drops them to 0 HP)', () => {
    const players: PlayerState[] = [
      mockPlayer({ id: 'caster', x: 0, y: 0 }),
      mockPlayer({ id: 'target', x: HIT_RANGE, y: 0, isDown: true }),
    ];
    const lastInput = new Map<string, number>();
    const deltas: Delta[] = [];

    fireSoulMend(players, lastInput, 'caster', 0, deltas);
    expect(players[0]!.channelingAbility).not.toBeNull();

    // Caster takes lethal damage mid-channel (input was fresh, target still valid,
    // caster still in range — only the caster's own incapacitation should cancel).
    players[0] = { ...players[0]!, isDown: true };
    tickSoulMend(players, lastInput, TICK_MS, deltas);

    expect(players[0]!.channelingAbility).toBeNull();
    expect(deltas).toContainEqual({ type: 'cast:cancelled', casterId: 'caster' });
    expect(players[1]!.isDown).toBe(true); // no ability effect applied on a cancelled cast
  });
});
