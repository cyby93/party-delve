import { describe, it, expect } from 'vitest';
import type { PlayerState, StatusEffect } from 'shared-types';
import { applyPlayerDamage } from '../../src/systems/player-health.js';

function makePlayer(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p0', displayName: 'P0', class: null,
    x: 0, y: 0, hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    sessionColor: 'red' as any, downCount: 0,
    nearPoiId: null, essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
    channelingAbility: null,
    ...overrides,
  };
}

function shieldEffect(magnitude: number, expiresAtMs = 10_000): StatusEffect {
  return { type: 'shield', magnitude, expiresAtMs };
}

function damageReductionEffect(magnitude: number, expiresAtMs = 10_000): StatusEffect {
  return { type: 'damageReduction', magnitude, expiresAtMs };
}

describe('applyPlayerDamage — shield absorption', () => {
  it('no shield: full mitigated damage reaches HP, unchanged from pre-story behavior', () => {
    const player = makePlayer({ hp: 100 });
    const result = applyPlayerDamage(player, 20, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(80);
    expect(result.value.player.statusEffects).toEqual([]);
  });

  it('shield fully absorbs a hit smaller than its magnitude', () => {
    const player = makePlayer({ hp: 100, statusEffects: [shieldEffect(30)] });
    const result = applyPlayerDamage(player, 20, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(100);
    const shield = result.value.player.statusEffects.find(e => e.type === 'shield');
    expect(shield?.magnitude).toBe(10);
  });

  it('shield partially absorbs a hit larger than its magnitude — overflow reaches HP', () => {
    const player = makePlayer({ hp: 100, statusEffects: [shieldEffect(30)] });
    const result = applyPlayerDamage(player, 50, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(80); // 50 - 30 absorbed = 20 HP loss
    const shield = result.value.player.statusEffects.find(e => e.type === 'shield');
    expect(shield?.magnitude).toBe(0);
  });

  it('depleted shield (magnitude 0) absorbs nothing further', () => {
    const player = makePlayer({ hp: 100, statusEffects: [shieldEffect(0)] });
    const result = applyPlayerDamage(player, 20, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(80);
  });

  it('damageReduction applied first, shield absorbs the reduced remainder', () => {
    const player = makePlayer({
      hp: 100,
      statusEffects: [damageReductionEffect(0.5), shieldEffect(15)],
    });
    // 40 damage * (1 - 0.5) = 20 mitigated; shield(15) absorbs 15, 5 reaches HP
    const result = applyPlayerDamage(player, 40, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(95);
    const shield = result.value.player.statusEffects.find(e => e.type === 'shield');
    expect(shield?.magnitude).toBe(0);
    const reduction = result.value.player.statusEffects.find(e => e.type === 'damageReduction');
    expect(reduction?.magnitude).toBe(0.5); // unaffected by shield absorption
  });

  it('expired shield effect does not absorb (getStatusEffectMagnitude treats it as gone)', () => {
    const player = makePlayer({ hp: 100, statusEffects: [shieldEffect(30, 5)] });
    const result = applyPlayerDamage(player, 20, 10); // nowMs=10 > expiresAtMs=5
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(80);
  });

  it('shield fully depletes and player downs in the same call', () => {
    const player = makePlayer({ hp: 10, statusEffects: [shieldEffect(30)] });
    // 40 damage: shield absorbs min(30, 40) = 30, leaving 10 HP damage → hp hits exactly 0
    const result = applyPlayerDamage(player, 40, 0);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.player.hp).toBe(0);
    expect(result.value.downed).toBe(true);
    const shield = result.value.player.statusEffects.find(e => e.type === 'shield');
    expect(shield?.magnitude).toBe(0);
  });
});
