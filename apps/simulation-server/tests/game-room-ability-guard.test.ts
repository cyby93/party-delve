/**
 * Tests for the ability-processing guard in GameRoom.ts's input-queue loop
 * (Story 2.9, D-2.8-C).
 *
 * GameRoom isn't instantiable outside a live Colyseus room (same constraint
 * as game-room-revive-proximity.test.ts), so this mirrors GameRoom.ts:1961's
 * guard verbatim in a standalone function rather than importing it.
 */
import { describe, it, expect } from 'vitest';
import { PlayerClass, SessionColor } from 'shared-types';
import type { PlayerState } from 'shared-types';

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

/** Mirrors GameRoom.ts:1961's ability-processing guard verbatim — not an import. */
function isAbilityBlocked(player: PlayerState | undefined): boolean {
  return !player || player.class === null || player.isFrozen || player.isDown || player.isSpirit;
}

describe('GameRoom ability-processing guard (Story 2.9, D-2.8-C)', () => {
  it('blocks when the player is missing', () => {
    expect(isAbilityBlocked(undefined)).toBe(true);
  });

  it('blocks when the player is frozen', () => {
    expect(isAbilityBlocked(mockPlayer({ isFrozen: true }))).toBe(true);
  });

  it('blocks when the player is down', () => {
    expect(isAbilityBlocked(mockPlayer({ isDown: true }))).toBe(true);
  });

  it('blocks when the player is a spirit', () => {
    expect(isAbilityBlocked(mockPlayer({ isSpirit: true }))).toBe(true);
  });

  it('blocks when the player has no class selected', () => {
    expect(isAbilityBlocked(mockPlayer({ class: null }))).toBe(true);
  });

  it('allows dispatch when none of the 4 blocking conditions hold', () => {
    expect(isAbilityBlocked(mockPlayer())).toBe(false);
  });
});
