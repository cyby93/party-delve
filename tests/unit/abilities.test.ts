import { describe, it, expect } from 'vitest';
import { dispatchAbility, applyDamage, applyStatusEffect, applyDisplacement, applyPlayerDamage, healPlayer, calculateLifesteal, resolveProjectileHit, resolveMixedFactionTargets, ABILITY_STATUS_EFFECT, ABILITY_DISPLACEMENT_STRENGTH, ABILITY_DAMAGE, ABILITY_HEAL_AMOUNT, ABILITY_DELIVERY, ABILITY_SELF_COST_HP, ABILITY_HP_SCALED_DAMAGE, ABILITY_LIFESTEAL_PCT, ABILITY_CHAINED_ZONE, DARK_PACT_DRAIN_PCT, VOID_PULSE_PULL_STRENGTH_PX } from 'game-rules';
import { PlayerClass, CLASS_DEFINITIONS, EnemyType, DifficultyTier, EnemyFSMState, SessionColor } from 'shared-types';
import type { EnemyState, PlayerState, ProjectileState } from 'shared-types';

const EXPECTED_INPUT_TYPES: Record<PlayerClass, [string, string, string, string]> = {
  [PlayerClass.STONEHIDE]:    ['RELEASE', 'TAP', 'TAP', 'AUTO'],
  [PlayerClass.SPIRITCALLER]: ['AUTO', 'TAP', 'AIM_CAST', 'TAP'],
  [PlayerClass.SOULDRINKER]:  ['AUTO', 'RELEASE', 'RELEASE', 'RELEASE'],
  [PlayerClass.STORMCALLER]:  ['AUTO', 'RELEASE', 'TAP', 'RELEASE'],
};

describe('dispatchAbility', () => {
  const baseCtx = {
    cooldownExpiresAt: 0,
    nowMs: 1000,
    directionX: 0.7,
    directionY: 0.0,
    casterHp: 100,
    casterMaxHp: 100,
  };

  it('returns ok for each class at index 0 when not on cooldown', () => {
    for (const cls of Object.values(PlayerClass)) {
      const result = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: 0 });
      expect(result.ok).toBe(true);
    }
  });

  it('returns error when on cooldown', () => {
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 0,
      cooldownExpiresAt: 2000,
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error.code).toBe('ON_COOLDOWN');
  });

  it('TAP ability returns direction (0, 0) regardless of input direction', () => {
    // Stonehide slot 1 = Tremor Stomp (TAP)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 1,
      directionX: 1,
      directionY: 0.5,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.directionX).toBe(0);
      expect(result.value.directionY).toBe(0);
    }
  });

  it('AUTO ability preserves direction', () => {
    // Stonehide slot 3 = Avalanche (AUTO)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 3,
      directionX: 0.7,
      directionY: 0,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.directionX).toBeCloseTo(0.7);
  });

  it('RELEASE ability preserves direction', () => {
    // Stonehide slot 0 = Stone Wall (RELEASE)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.STONEHIDE,
      abilityIndex: 0,
      directionX: -0.5,
      directionY: 0.8,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.directionX).toBeCloseTo(-0.5);
      expect(result.value.directionY).toBeCloseTo(0.8);
    }
  });

  it('AIM_CAST ability preserves direction', () => {
    // Spiritcaller slot 2 = Soul Mend (AIM_CAST)
    const result = dispatchAbility({
      ...baseCtx,
      playerClass: PlayerClass.SPIRITCALLER,
      abilityIndex: 2,
      directionX: 0.3,
      directionY: -0.9,
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.directionX).toBeCloseTo(0.3);
      expect(result.value.directionY).toBeCloseTo(-0.9);
    }
  });

  it('all 16 abilities have the corrected inputType', () => {
    for (const cls of Object.values(PlayerClass)) {
      CLASS_DEFINITIONS[cls].abilities.forEach((ability, i) => {
        expect(ability.inputType).toBe(EXPECTED_INPUT_TYPES[cls][i]);
      });
    }
  });

  it('every class has at least one ability with cooldown ≤ 3000ms', () => {
    for (const cls of Object.values(PlayerClass)) {
      const cooldowns = [0, 1, 2, 3].map(i => {
        const r = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: i });
        return r.ok ? r.value.cooldownMs : Infinity;
      });
      expect(Math.min(...cooldowns)).toBeLessThanOrEqual(3000);
    }
  });

  it('returns error for out-of-range ability index', () => {
    const result = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 4 });
    expect(result.ok).toBe(false);
  });

  it('cooldown value matches ABILITY_COOLDOWNS_MS for each class', () => {
    // stonehide slot 0 cooldown = 2000ms
    const r = dispatchAbility({ ...baseCtx, playerClass: PlayerClass.STONEHIDE, abilityIndex: 0 });
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.value.cooldownMs).toBe(2000);
  });

  it('self-cost and HP-scaled damage remain inert for every class/slot Story 3.19 didn\'t touch', () => {
    for (const cls of [PlayerClass.STONEHIDE, PlayerClass.SPIRITCALLER, PlayerClass.STORMCALLER]) {
      for (let i = 0; i < 4; i++) {
        const full = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: i, casterHp: 100, casterMaxHp: 100 });
        const low = dispatchAbility({ ...baseCtx, playerClass: cls, abilityIndex: i, casterHp: 1, casterMaxHp: 100 });
        expect(full.ok).toBe(true);
        expect(low.ok).toBe(true);
        if (full.ok && low.ok) {
          expect(full.value.selfCostHpApplied).toBe(0);
          expect(low.value.selfCostHpApplied).toBe(0);
          expect(low.value.damage).toBe(full.value.damage);
        }
      }
    }
  });
});

describe('Stonehide kit rework (Story 3.16)', () => {
  function mockEnemy(overrides?: Partial<EnemyState>): EnemyState {
    return {
      id: 'e1', type: EnemyType.GRUNT, x: 200, y: 0, hp: 100, maxHp: 100,
      difficultyTier: DifficultyTier.EASY, isAlive: true, fsmState: EnemyFSMState.IDLE,
      attackCooldownTicks: 0, statusEffects: [],
      ...overrides,
    };
  }

  function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
    return {
      id: 'p1', displayName: 'Tester', class: PlayerClass.STONEHIDE,
      x: 0, y: 0, hp: 100, maxHp: 100,
      isFrozen: false, isDown: false, isSpirit: false,
      sessionColor: SessionColor.RED, downCount: 0, nearPoiId: null,
      essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
      channelingAbility: null,
      ...overrides,
    };
  }

  it('Iron Skin (slot 2, self scope): applies a damageReduction that mitigates the caster\'s next damage taken', () => {
    const config = ABILITY_STATUS_EFFECT[PlayerClass.STONEHIDE][2];
    expect(config).toEqual({ effectType: 'damageReduction', magnitude: 0.3, durationMs: 3000, scope: 'self' });

    const nowMs = 0; // matches GameRoom.ts's `nowAbility + statusConfig.durationMs` with nowAbility=0
    const applied = applyStatusEffect(
      mockPlayer(),
      { type: config!.effectType, magnitude: config!.magnitude, expiresAtMs: nowMs + config!.durationMs },
      nowMs,
    );
    expect(applied.ok).toBe(true);
    if (!applied.ok) return;

    const result = applyPlayerDamage(applied.value.target as PlayerState, 40, nowMs);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.player.hp).toBe(72); // 100 - (40 * 0.7)
  });

  it('Tremor Stomp (slot 1, enemies-in-zone scope): deals AoE damage and applies a slow to each hit enemy', () => {
    const config = ABILITY_STATUS_EFFECT[PlayerClass.STONEHIDE][1];
    expect(config).toEqual({ effectType: 'slow', magnitude: 0.4, durationMs: 2000, scope: 'enemies-in-zone' });
    const damage = ABILITY_DAMAGE.stonehide[1];
    expect(damage).toBeGreaterThan(0);

    const nowMs = 0;
    const dmgResult = applyDamage(mockEnemy(), damage, 'drop-1', nowMs);
    expect(dmgResult.ok).toBe(true);
    if (!dmgResult.ok) return;
    expect(dmgResult.value.enemy.hp).toBe(100 - damage);

    const statusResult = applyStatusEffect(
      dmgResult.value.enemy,
      { type: config!.effectType, magnitude: config!.magnitude, expiresAtMs: nowMs + config!.durationMs },
      nowMs,
    );
    expect(statusResult.ok).toBe(true);
    if (statusResult.ok) {
      expect(statusResult.value.target.statusEffects).toEqual([{ type: 'slow', magnitude: 0.4, expiresAtMs: 2000 }]);
    }
  });

  it('a killed enemy does not receive the enemies-in-zone status effect (mirrors GameRoom.ts\'s !killed guard)', () => {
    const lethalDamage = 200; // exceeds mockEnemy's 100 hp
    const dmgResult = applyDamage(mockEnemy(), lethalDamage, 'drop-3', 0);
    expect(dmgResult.ok).toBe(true);
    if (!dmgResult.ok) return;
    expect(dmgResult.value.killed).toBe(true);

    // GameRoom.ts only calls applyStatusEffect when `!dmgResult.value.killed` —
    // a killed enemy's statusEffects array is left untouched.
    expect(dmgResult.value.enemy.statusEffects).toEqual([]);
  });

  it('Stone Wall (slot 0, no status config): deals damage and pulls the hit enemy toward the caster', () => {
    expect(ABILITY_STATUS_EFFECT.stonehide[0]).toBeNull();
    const strength = ABILITY_DISPLACEMENT_STRENGTH.stonehide[0];
    expect(strength).toBeGreaterThan(0);
    const damage = ABILITY_DAMAGE.stonehide[0];
    expect(damage).toBeGreaterThan(0);

    const enemy = mockEnemy({ x: 200, y: 0 });
    const caster = mockPlayer({ x: 0, y: 0 });
    const dmgResult = applyDamage(enemy, damage, 'drop-2', 0);
    expect(dmgResult.ok).toBe(true);
    if (!dmgResult.ok) return;
    expect(dmgResult.value.enemy.hp).toBe(100 - damage);

    const { dx, dy } = applyDisplacement(enemy.x, enemy.y, caster.x, caster.y, strength);
    expect(dx).toBeCloseTo(-strength);
    expect(dy).toBeCloseTo(0);
  });

  it('Avalanche (slot 3): unchanged — no status effect or displacement config, damage still configured', () => {
    expect(ABILITY_STATUS_EFFECT.stonehide[3]).toBeNull();
    expect(ABILITY_DISPLACEMENT_STRENGTH.stonehide[3]).toBe(0);
    expect(ABILITY_DAMAGE.stonehide[3]).toBeGreaterThan(0);
  });

  it('no other class has a displacement config yet (Stonehide-only in this story); status-effect config is Stonehide-only except Spiritcaller\'s Warding Cry (Story 3.17) and Souldrinker\'s Dark Pact (Story 3.19)', () => {
    for (const cls of [PlayerClass.SPIRITCALLER, PlayerClass.SOULDRINKER, PlayerClass.STORMCALLER]) {
      expect(ABILITY_DISPLACEMENT_STRENGTH[cls]).toEqual([0, 0, 0, 0]);
    }
    expect(ABILITY_STATUS_EFFECT[PlayerClass.STORMCALLER]).toEqual([null, null, null, null]);
  });
});

describe('Spiritcaller kit rework (Story 3.17)', () => {
  function mockEnemy(overrides?: Partial<EnemyState>): EnemyState {
    return {
      id: 'e1', type: EnemyType.GRUNT, x: 200, y: 0, hp: 100, maxHp: 100,
      difficultyTier: DifficultyTier.EASY, isAlive: true, fsmState: EnemyFSMState.IDLE,
      attackCooldownTicks: 0, statusEffects: [],
      ...overrides,
    };
  }

  function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
    return {
      id: 'p1', displayName: 'Tester', class: PlayerClass.SPIRITCALLER,
      x: 0, y: 0, hp: 100, maxHp: 100,
      isFrozen: false, isDown: false, isSpirit: false,
      sessionColor: SessionColor.RED, downCount: 0, nearPoiId: null,
      essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
      channelingAbility: null,
      ...overrides,
    };
  }

  it('Ancestor\'s Voice (slot 0, AUTO): resolveMixedFactionTargets splits one gathered zone into a damaged enemy and a healed ally', () => {
    const damage = ABILITY_DAMAGE.spiritcaller[0];
    const heal = ABILITY_HEAL_AMOUNT.spiritcaller[0];
    expect(damage).toBeGreaterThan(0);
    expect(heal).toBeGreaterThan(0);

    const caster = mockPlayer({ id: 'caster' });
    const ally = mockPlayer({ id: 'ally', hp: 60 });
    const enemy = mockEnemy({ id: 'foe' });

    const { allies, enemies } = resolveMixedFactionTargets(caster.id, [caster, ally, enemy]);
    expect(allies).toEqual([ally]); // caster excluded from their own AoE
    expect(enemies).toEqual([enemy]);

    const dmgResult = applyDamage(enemies[0]!, damage, 'drop-1', 0);
    expect(dmgResult.ok).toBe(true);
    if (dmgResult.ok) expect(dmgResult.value.enemy.hp).toBe(100 - damage);

    const healed = healPlayer(allies[0]!, heal);
    expect(healed.hp).toBe(60 + heal);
  });

  it('Spirit Nova (slot 1): both ABILITY_DAMAGE and ABILITY_HEAL_AMOUNT are configured (mixed-faction, fixing the damage-only mislabel)', () => {
    expect(ABILITY_DAMAGE.spiritcaller[1]).toBeGreaterThan(0);
    expect(ABILITY_HEAL_AMOUNT.spiritcaller[1]).toBeGreaterThan(0);
  });

  it('Warding Cry (slot 3, allies-in-zone scope): applies a flat-HP shield status effect', () => {
    const config = ABILITY_STATUS_EFFECT[PlayerClass.SPIRITCALLER][3];
    expect(config).toEqual({ effectType: 'shield', magnitude: 30, durationMs: 4000, scope: 'allies-in-zone' });

    const nowMs = 0;
    const applied = applyStatusEffect(
      mockPlayer(),
      { type: config!.effectType, magnitude: config!.magnitude, expiresAtMs: nowMs + config!.durationMs },
      nowMs,
    );
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      // shield's magnitude is flat HP absorption, not a 0-1 fraction — 30 must survive unclamped.
      expect(applied.value.target.statusEffects).toEqual([{ type: 'shield', magnitude: 30, expiresAtMs: 4000 }]);
    }
  });

  it('Soul Mend (slot 2) is untouched — out of scope, no status-effect/heal config (Story 3.18)', () => {
    expect(ABILITY_STATUS_EFFECT.spiritcaller[2]).toBeNull();
    expect(ABILITY_HEAL_AMOUNT.spiritcaller[2]).toBe(0);
  });

  it('no other class has an allies-in-zone status config or nonzero heal amount (Spiritcaller-only in this story)', () => {
    for (const cls of [PlayerClass.STONEHIDE, PlayerClass.SOULDRINKER, PlayerClass.STORMCALLER]) {
      expect(ABILITY_HEAL_AMOUNT[cls]).toEqual([0, 0, 0, 0]);
      for (const config of ABILITY_STATUS_EFFECT[cls]) {
        expect(config?.scope).not.toBe('allies-in-zone');
      }
    }
  });
});

describe('Souldrinker kit rework (Story 3.19)', () => {
  function mockEnemy(overrides?: Partial<EnemyState>): EnemyState {
    return {
      id: 'e1', type: EnemyType.GRUNT, x: 100, y: 0, hp: 100, maxHp: 100,
      difficultyTier: DifficultyTier.EASY, isAlive: true, fsmState: EnemyFSMState.IDLE,
      attackCooldownTicks: 0, statusEffects: [],
      ...overrides,
    };
  }

  function mockPlayer(overrides?: Partial<PlayerState>): PlayerState {
    return {
      id: 'p1', displayName: 'Tester', class: PlayerClass.SOULDRINKER,
      x: 0, y: 0, hp: 100, maxHp: 100,
      isFrozen: false, isDown: false, isSpirit: false,
      sessionColor: SessionColor.RED, downCount: 0, nearPoiId: null,
      essenceTotal: 0, reviveTimerExpiresAt: 0, statusEffects: [],
      channelingAbility: null,
      ...overrides,
    };
  }

  it('Blood Spike (slot 0, renamed from Blood Draw): projectile delivery, self-cost on cast, 50% lifesteal on hit', () => {
    expect(CLASS_DEFINITIONS[PlayerClass.SOULDRINKER].abilities[0]!.name).toBe('Blood Spike');
    expect(ABILITY_DELIVERY.souldrinker[0]).toBe('projectile');
    expect(ABILITY_SELF_COST_HP.souldrinker[0]).toBeGreaterThan(0);
    expect(ABILITY_LIFESTEAL_PCT.souldrinker[0]).toBe(0.5);

    const result = dispatchAbility({
      playerClass: PlayerClass.SOULDRINKER, abilityIndex: 0,
      directionX: 1, directionY: 0, cooldownExpiresAt: 0, nowMs: 0,
      casterHp: 50, casterMaxHp: 100,
    });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.selfCostHpApplied).toBe(ABILITY_SELF_COST_HP.souldrinker[0]);

    // Lifesteal composes healPlayer + calculateLifesteal — applied at projectile-hit
    // time in GameRoom.ts, not inside dispatchAbility itself (matches Story 3.15's
    // "no new drain primitive" design).
    const damageDealt = ABILITY_DAMAGE.souldrinker[0];
    const healed = healPlayer(mockPlayer({ hp: 50 }), calculateLifesteal(damageDealt, ABILITY_LIFESTEAL_PCT.souldrinker[0]));
    expect(healed.hp).toBe(50 + damageDealt * 0.5);
  });

  it('Blood Spike (slot 0): 1-HP floor caps the self-cost rather than blocking the cast', () => {
    const result = dispatchAbility({
      playerClass: PlayerClass.SOULDRINKER, abilityIndex: 0,
      directionX: 1, directionY: 0, cooldownExpiresAt: 0, nowMs: 0,
      casterHp: 1, casterMaxHp: 100,
    });
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.selfCostHpApplied).toBe(0);
  });

  it('Crimson Lash (slot 1): damage scales inversely with caster HP, unchanged hitscan delivery', () => {
    expect(ABILITY_DELIVERY.souldrinker[1]).toBe('hitscan');
    expect(ABILITY_HP_SCALED_DAMAGE.souldrinker[1]).toBeGreaterThan(0);

    const baseCtx = { playerClass: PlayerClass.SOULDRINKER, abilityIndex: 1, directionX: 1, directionY: 0, cooldownExpiresAt: 0, nowMs: 0 };
    const fullHp = dispatchAbility({ ...baseCtx, casterHp: 100, casterMaxHp: 100 });
    const lowHp = dispatchAbility({ ...baseCtx, casterHp: 20, casterMaxHp: 100 });
    expect(fullHp.ok).toBe(true);
    expect(lowHp.ok).toBe(true);
    if (fullHp.ok && lowHp.ok) {
      expect(lowHp.value.damage).toBeGreaterThan(fullHp.value.damage);
      expect(lowHp.value.selfCostHpApplied).toBe(0); // only Blood Spike has a self-cost, not Crimson Lash
    }
  });

  it('Dark Pact (slot 2): drains a percentage of the target ally\'s current HP to the caster and grants a self damageBuff', () => {
    const config = ABILITY_STATUS_EFFECT.souldrinker[2];
    expect(config).toEqual({ effectType: 'damageBuff', magnitude: 0.25, durationMs: 4000, scope: 'self' });

    const target = mockPlayer({ id: 'ally', hp: 80 });
    const caster = mockPlayer({ id: 'caster', hp: 40 });
    const drainAmount = target.hp * DARK_PACT_DRAIN_PCT;
    expect(drainAmount).toBe(8);

    // Composes two EXISTING functions (Story 3.19's Non-goals — no new "drain" primitive).
    // applyPlayerDamage has no down-safety floor (unlike calculateSelfCostHp's explicit
    // 1-HP floor) — draining pushes the target's real HP down with no compensating clamp.
    const dmgResult = applyPlayerDamage(target, drainAmount, 0);
    expect(dmgResult.ok).toBe(true);
    if (dmgResult.ok) expect(dmgResult.value.player.hp).toBe(72);

    const healedCaster = healPlayer(caster, drainAmount);
    expect(healedCaster.hp).toBe(48);

    const applied = applyStatusEffect(
      healedCaster,
      { type: config!.effectType, magnitude: config!.magnitude, expiresAtMs: 0 + config!.durationMs },
      0,
    );
    expect(applied.ok).toBe(true);
    if (applied.ok) {
      expect(applied.value.target.statusEffects).toEqual([{ type: 'damageBuff', magnitude: 0.25, expiresAtMs: 4000 }]);
    }
  });

  it('Void Pulse (slot 3): projectile delivery, impact damage, then a pull-effect chained zone', () => {
    expect(ABILITY_DELIVERY.souldrinker[3]).toBe('projectile');
    const chainConfig = ABILITY_CHAINED_ZONE.souldrinker[3];
    expect(chainConfig?.effectType).toBe('pull');
    expect(chainConfig?.radius).toBeGreaterThan(0);
    expect(chainConfig?.tickIntervalMs).toBeGreaterThan(0);
    expect(chainConfig?.durationMs).toBeGreaterThan(0);

    const damage = ABILITY_DAMAGE.souldrinker[3];
    expect(damage).toBeGreaterThan(0);

    // Impact damage first (existing projectile-hit path, Story 3.13's AC4 ordering) —
    // the chain spawn itself is GameRoom.ts's job, not this pure function's.
    const projectile: ProjectileState = { id: 'proj-1', ownerId: 'caster', x: 100, y: 0, class: PlayerClass.SOULDRINKER, abilityIndex: 3 };
    const hitResult = resolveProjectileHit(projectile, mockEnemy(), damage, 0);
    expect(hitResult.ok).toBe(true);
    if (hitResult.ok) expect(hitResult.value.enemy.hp).toBe(100 - damage);

    // Chained pull zone reuses the same displacement primitive as Stone Wall's pull (3.16).
    const { dx, dy } = applyDisplacement(200, 0, 100, 0, VOID_PULSE_PULL_STRENGTH_PX);
    expect(dx).toBeCloseTo(-VOID_PULSE_PULL_STRENGTH_PX);
    expect(dy).toBeCloseTo(0);
  });

  it('no other class has projectile delivery or a chained-zone config (Souldrinker-only in this story)', () => {
    for (const cls of [PlayerClass.STONEHIDE, PlayerClass.SPIRITCALLER, PlayerClass.STORMCALLER]) {
      expect(ABILITY_DELIVERY[cls]).toEqual(['hitscan', 'hitscan', 'hitscan', 'hitscan']);
      expect(ABILITY_CHAINED_ZONE[cls]).toEqual([null, null, null, null]);
    }
  });
});
