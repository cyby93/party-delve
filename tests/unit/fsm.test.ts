import { describe, it, expect } from 'vitest';
import { tickEnemy, ChargeLayer, StompLayer } from 'game-rules';
import type { EnemyContext } from 'game-rules';
import { EnemyType, DifficultyTier, EnemyFSMState } from 'shared-types';
import type { EnemyState } from 'shared-types';
import { ENEMY_CHASE_RANGE, ENEMY_ATTACK_RANGE, ENEMY_ATTACK_COOLDOWN_TICKS, getEnemyCount } from 'game-rules';

const DT = 1 / 30;

function makeEnemy(overrides: Partial<EnemyState> = {}): EnemyState {
  return {
    id: 'e1',
    type: EnemyType.GRUNT,
    x: 960,
    y: 540,
    hp: 100,
    maxHp: 100,
    difficultyTier: DifficultyTier.EASY,
    isAlive: true,
    fsmState: EnemyFSMState.IDLE,
    attackCooldownTicks: 0,
    ...overrides,
  };
}

function ctxAt(distance: number): EnemyContext {
  return {
    nearestPlayerPos: { x: 960 + distance, y: 540 },
    nearestPlayerDistance: distance,
    dt: DT,
  };
}

function ctxNoPlayer(): EnemyContext {
  return { nearestPlayerPos: null, nearestPlayerDistance: Infinity, dt: DT };
}

// ─── Easy: base FSM ──────────────────────────────────────────────────────────

describe('Base FSM — Easy (no layers)', () => {
  it('IDLE → CHASE when player within chase range', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.IDLE });
    tickEnemy(enemy, ctxAt(200), []);
    expect(enemy.fsmState).toBe(EnemyFSMState.CHASE);
  });

  it('IDLE stays IDLE when no player nearby', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.IDLE });
    tickEnemy(enemy, ctxNoPlayer(), []);
    expect(enemy.fsmState).toBe(EnemyFSMState.IDLE);
  });

  it('IDLE stays IDLE when player beyond chase range', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.IDLE });
    tickEnemy(enemy, ctxAt(ENEMY_CHASE_RANGE + 1), []);
    expect(enemy.fsmState).toBe(EnemyFSMState.IDLE);
  });

  it('CHASE → ATTACK when player within attack range', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.CHASE });
    tickEnemy(enemy, ctxAt(ENEMY_ATTACK_RANGE - 1), []);
    expect(enemy.fsmState).toBe(EnemyFSMState.ATTACK);
    expect(enemy.attackCooldownTicks).toBe(ENEMY_ATTACK_COOLDOWN_TICKS);
  });

  it('CHASE → IDLE when player leaves chase range', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.CHASE });
    tickEnemy(enemy, ctxAt(ENEMY_CHASE_RANGE + 50), []);
    expect(enemy.fsmState).toBe(EnemyFSMState.IDLE);
  });

  it('CHASE returns enemy:moved delta', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.CHASE });
    const result = tickEnemy(enemy, ctxAt(150), []);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some(e => e.type === 'enemy:moved')).toBe(true);
    }
  });

  it('ATTACK counts down and returns to IDLE', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.ATTACK, attackCooldownTicks: 1 });
    tickEnemy(enemy, ctxAt(ENEMY_ATTACK_RANGE - 1), []);
    expect(enemy.attackCooldownTicks).toBe(0);
    expect(enemy.fsmState).toBe(EnemyFSMState.IDLE);
  });

  it('ATTACK stays in ATTACK while cooldown > 0', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.ATTACK, attackCooldownTicks: 5 });
    tickEnemy(enemy, ctxAt(ENEMY_ATTACK_RANGE - 1), []);
    expect(enemy.fsmState).toBe(EnemyFSMState.ATTACK);
    expect(enemy.attackCooldownTicks).toBe(4);
  });
});

// ─── Normal: ChargeLayer ─────────────────────────────────────────────────────

describe('ChargeLayer — Normal difficulty', () => {
  it('activates when player in charge range', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.CHASE });
    const chargeLayer = new ChargeLayer();
    const result = tickEnemy(enemy, ctxAt(150), [chargeLayer]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some(e => e.type === 'enemy:moved')).toBe(true);
    }
  });

  it('sets cooldown after activation', () => {
    const chargeLayer = new ChargeLayer();
    tickEnemy(makeEnemy(), ctxAt(150), [chargeLayer]);
    expect(chargeLayer.currentCooldown).toBe(chargeLayer.cooldown);
  });

  it('decrements cooldown when not activating', () => {
    const chargeLayer = new ChargeLayer();
    chargeLayer.currentCooldown = 10;
    // Player at distance 50 — below CHARGE_ACTIVATION_MIN (100), so shouldActivate = false
    tickEnemy(makeEnemy({ fsmState: EnemyFSMState.CHASE }), ctxAt(50), [chargeLayer]);
    expect(chargeLayer.currentCooldown).toBe(9);
  });

  it('base FSM runs as fallback when layer does not activate', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.IDLE });
    tickEnemy(enemy, ctxNoPlayer(), [new ChargeLayer()]);
    expect(enemy.fsmState).toBe(EnemyFSMState.IDLE);
  });

  it('base FSM is not modified by adding ChargeLayer', () => {
    const easyEnemy = makeEnemy({ fsmState: EnemyFSMState.IDLE });
    const normalEnemy = makeEnemy({ fsmState: EnemyFSMState.IDLE });

    // distance 50: below CHARGE_ACTIVATION_MIN (100) so ChargeLayer won't activate;
    // base FSM runs for both and both transition IDLE→CHASE
    tickEnemy(easyEnemy, ctxAt(50), []);
    tickEnemy(normalEnemy, ctxAt(50), [new ChargeLayer()]);

    expect(easyEnemy.fsmState).toBe(EnemyFSMState.CHASE);
    expect(normalEnemy.fsmState).toBe(EnemyFSMState.CHASE);
  });
});

// ─── Hard: ChargeLayer + StompLayer ─────────────────────────────────────────

describe('StompLayer — Hard difficulty', () => {
  it('activates when player within stomp range', () => {
    const enemy = makeEnemy({ fsmState: EnemyFSMState.ATTACK });
    // 70px: below CHARGE_ACTIVATION_MIN (100) so ChargeLayer won't activate; StompLayer will
    const result = tickEnemy(enemy, ctxAt(70), [new ChargeLayer(), new StompLayer()]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.some(e => e.type === 'enemy:stomped')).toBe(true);
    }
  });

  it('enemy:stomped delta has correct shape', () => {
    const enemy = makeEnemy({ x: 100, y: 200 });
    const result = tickEnemy(enemy, ctxAt(70), [new ChargeLayer(), new StompLayer()]);
    expect(result.ok).toBe(true);
    if (result.ok) {
      const stompEvt = result.value.find(e => e.type === 'enemy:stomped');
      expect(stompEvt).toBeDefined();
      expect(stompEvt).toMatchObject({ enemyId: 'e1', x: 100, y: 200 });
      expect((stompEvt as { radius: number }).radius).toBeGreaterThan(0);
    }
  });

  it('layers are independently testable with no Colyseus or planck imports', () => {
    expect(() => new ChargeLayer()).not.toThrow();
    expect(() => new StompLayer()).not.toThrow();
  });
});

// ─── Result type — error handling ────────────────────────────────────────────

describe('Result type — error handling', () => {
  it('returns ok:false for invalid fsmState', () => {
    const enemy = makeEnemy({ fsmState: 'invalid' as EnemyFSMState });
    const result = tickEnemy(enemy, ctxAt(100), []);
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.error.code).toBe('INVALID_FSM_STATE');
    }
  });

  it('does not throw — returns Result', () => {
    const enemy = makeEnemy({ fsmState: 'invalid' as EnemyFSMState });
    expect(() => tickEnemy(enemy, ctxAt(100), [])).not.toThrow();
  });
});

// ─── Enemy count scaling ──────────────────────────────────────────────────────

describe('Enemy count scaling (FR22)', () => {
  it('scales with player count, not difficulty', () => {
    const earlyCount3 = getEnemyCount(3, 'early');
    const earlyCount8 = getEnemyCount(8, 'early');
    expect(earlyCount8).toBeGreaterThan(earlyCount3);
  });

  it('3 players early = ceil(3 * 1.5) = 5', () => {
    expect(getEnemyCount(3, 'early')).toBe(5);
  });

  it('8 players mid = ceil(8 * 2.0) = 16', () => {
    expect(getEnemyCount(8, 'mid')).toBe(16);
  });

  it('4 players late = ceil(4 * 2.5) = 10', () => {
    expect(getEnemyCount(4, 'late')).toBe(10);
  });
});
