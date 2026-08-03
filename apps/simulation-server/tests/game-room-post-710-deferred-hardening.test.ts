/**
 * Tests for Story 7.12 — closing the two deferred findings re-verified against
 * current source (D-7.10-B, D-7.7a-B).
 *
 * GameRoom isn't instantiable outside a live Colyseus room, so the finite-gate
 * logic (D-7.10-B) is mirrored as a standalone function, same pattern as
 * game-room-post-410-deferred-hardening.test.ts and
 * game-room-post-413-deferred-hardening.test.ts. The exhaustiveness guard
 * (D-7.7a-B) is a compile-time check proven by `npm run typecheck`, not a
 * runtime test — see Dev Notes.
 */
import { describe, it, expect } from 'vitest';

// Mirrors the phase-3/3b `:moved` read-back gate (D-7.10-B): a non-finite
// read-back must never be written or broadcast, regardless of how far it
// differs from the prior position.
function shouldWritePosition(newX: number, newY: number, x: number, y: number): boolean {
  if (!Number.isFinite(newX) || !Number.isFinite(newY)) return false;
  return Math.abs(newX - x) > 0.5 || Math.abs(newY - y) > 0.5;
}

describe('GameRoom :moved finite guard (Story 7.12, D-7.10-B)', () => {
  it('does not write/broadcast when newX is NaN', () => {
    expect(shouldWritePosition(NaN, 10, 0, 0)).toBe(false);
  });

  it('does not write/broadcast when newY is NaN', () => {
    expect(shouldWritePosition(10, NaN, 0, 0)).toBe(false);
  });

  it('does not write/broadcast when newX is Infinity', () => {
    expect(shouldWritePosition(Infinity, 10, 0, 0)).toBe(false);
  });

  it('does not write/broadcast when newY is -Infinity', () => {
    expect(shouldWritePosition(10, -Infinity, 0, 0)).toBe(false);
  });

  it('preserves existing behavior: writes/broadcasts for finite input crossing the 0.5 threshold', () => {
    expect(shouldWritePosition(10, 0, 0, 0)).toBe(true);
  });

  it('preserves existing behavior: does not write for finite input within the 0.5 threshold', () => {
    expect(shouldWritePosition(0.2, 0.2, 0, 0)).toBe(false);
  });
});

// Mirrors the enemy AI phase's `for (const aiEvt of result.value) { ... continue ... }`
// loop (Story 7.12 code review, control-flow gap): a non-finite `enemy:moved` event must
// be dropped from the broadcast list without affecting any other event type emitted for
// the same enemy in the same tick.
function processEnemyEvents(
  events: { type: string }[],
  enemyPos: { x: number; y: number },
): { type: string }[] {
  const broadcasted: { type: string }[] = [];
  for (const evt of events) {
    if (evt.type === 'enemy:moved' && (!Number.isFinite(enemyPos.x) || !Number.isFinite(enemyPos.y))) {
      continue;
    }
    broadcasted.push(evt);
  }
  return broadcasted;
}

// Mirrors the boss-event `switch (evt.type) { case 'boss:moved': ... break; ... }` (Story
// 7.12 code review, control-flow gap): a non-finite `boss:moved` event must `break` out of
// only its own case, leaving every other boss event emitted in the same tick's
// `bossResult.value` array to broadcast normally.
function processBossEvents(events: { type: string; x?: number; y?: number }[]): string[] {
  const broadcasted: string[] = [];
  for (const evt of events) {
    switch (evt.type) {
      case 'boss:moved':
        if (!Number.isFinite(evt.x) || !Number.isFinite(evt.y)) break;
        broadcasted.push(evt.type);
        break;
      default:
        broadcasted.push(evt.type);
    }
  }
  return broadcasted;
}

describe('GameRoom enemy AI loop — continue scopes to the current event only (Story 7.12 review)', () => {
  it('drops only the non-finite enemy:moved event, keeping other event types from the same enemy', () => {
    const events = [{ type: 'enemy:attacked' }, { type: 'enemy:moved' }, { type: 'enemy:statusApplied' }];
    const result = processEnemyEvents(events, { x: NaN, y: 0 });
    expect(result).toEqual([{ type: 'enemy:attacked' }, { type: 'enemy:statusApplied' }]);
  });

  it('keeps enemy:moved when the position is finite', () => {
    const events = [{ type: 'enemy:attacked' }, { type: 'enemy:moved' }];
    const result = processEnemyEvents(events, { x: 10, y: 20 });
    expect(result).toEqual(events);
  });
});

describe('GameRoom boss-event switch — break scopes to the boss:moved case only (Story 7.12 review)', () => {
  it('drops only the non-finite boss:moved event, keeping other boss events from the same tick', () => {
    const events = [
      { type: 'boss:phaseChanged' },
      { type: 'boss:moved', x: NaN, y: 5 },
      { type: 'add:spawned' },
    ];
    expect(processBossEvents(events)).toEqual(['boss:phaseChanged', 'add:spawned']);
  });

  it('keeps boss:moved when the position is finite', () => {
    const events = [{ type: 'boss:phaseChanged' }, { type: 'boss:moved', x: 10, y: 20 }];
    expect(processBossEvents(events)).toEqual(['boss:phaseChanged', 'boss:moved']);
  });
});
