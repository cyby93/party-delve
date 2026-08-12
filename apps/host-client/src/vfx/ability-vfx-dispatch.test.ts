import { describe, it, expect } from 'vitest';
import type { GameState, PlayerState } from 'shared-types';
import { PlayerClass, SessionColor } from 'shared-types';
import type { DeltaEventMsg } from 'net-protocol';
import { dispatchAbilityVfx } from './ability-vfx-dispatch';
import { createVfxRuntimeRefs } from './vfx-runtime-refs';

/**
 * Story 7.15e: an `ability:fired` must clear the aim preview for RELEASE
 * abilities (the thumb lifted) but NOT for AUTO/AIM_CAST ones (the thumb is
 * still down and the player is aiming the next shot).
 *
 * `engine` is deliberately null: that routes every branch to the legacy
 * `onCastFlash` fallback, so these tests exercise the preview bookkeeping without
 * needing a PixiJS renderer — which is what makes them unit tests at all.
 */

function player(overrides: Partial<PlayerState> = {}): PlayerState {
  return {
    id: 'p1',
    displayName: 'Aimer',
    sessionColor: SessionColor.RED,
    class: PlayerClass.STORMCALLER,
    x: 500, y: 400,
    hp: 100, maxHp: 100,
    isFrozen: false, isDown: false, isSpirit: false,
    downCount: 0,
    nearPoiId: null,
    statusEffects: [],
    channelingAbility: null,
    ...overrides,
  } as PlayerState;
}

function stateWith(p: PlayerState): GameState {
  return { players: [p], enemies: [], zones: [], projectiles: [], boss: null } as unknown as GameState;
}

const previewDelta = (abilityIndex: number): DeltaEventMsg => ({
  type: 'ability:aim-preview',
  playerId: 'p1',
  abilityIndex,
  directionX: 0,
  directionY: 1,
});

const firedDelta = (abilityIndex: number): DeltaEventMsg => ({
  type: 'ability:fired',
  playerId: 'p1',
  abilityIndex,
  directionX: 0,
  directionY: 1,
});

function ctxFor(gameState: GameState) {
  const refs = createVfxRuntimeRefs();
  return {
    refs,
    ctx: {
      engine: null,
      gameState,
      refs,
      onCastFlash: () => {},
    },
  };
}

describe('aim-preview lifecycle across ability:fired (Story 7.15e)', () => {
  it('KEEPS the preview when an AUTO ability fires — the player is still holding', () => {
    // Lightning Arc (stormcaller[0]) is AUTO.
    const { refs, ctx } = ctxFor(stateWith(player()));
    dispatchAbilityVfx(previewDelta(0), ctx);
    expect(refs.aimPreviews.has('p1')).toBe(true);

    dispatchAbilityVfx(firedDelta(0), ctx);
    expect(refs.aimPreviews.has('p1')).toBe(true);
  });

  it('CLEARS the preview when a RELEASE ability fires — the thumb lifted', () => {
    // Storm Eye (stormcaller[3]) is RELEASE.
    const { refs, ctx } = ctxFor(stateWith(player()));
    dispatchAbilityVfx(previewDelta(3), ctx);
    expect(refs.aimPreviews.has('p1')).toBe(true);

    dispatchAbilityVfx(firedDelta(3), ctx);
    expect(refs.aimPreviews.has('p1')).toBe(false);
  });

  it('KEEPS the preview for an AIM_CAST ability — it channels while held', () => {
    // Soul Mend (spiritcaller[2]) is AIM_CAST. It does not normally emit
    // ability:fired, but the clearing rule must not depend on that.
    const { refs, ctx } = ctxFor(stateWith(player({ class: PlayerClass.SPIRITCALLER })));
    dispatchAbilityVfx(previewDelta(2), ctx);
    dispatchAbilityVfx(firedDelta(2), ctx);
    expect(refs.aimPreviews.has('p1')).toBe(true);
  });

  it('CLEARS when the caster cannot be resolved — a stale arrow is worse than a missing one', () => {
    const { refs, ctx } = ctxFor(stateWith(player()));
    dispatchAbilityVfx(previewDelta(0), ctx);
    // Simulate the late-join / reconnect race: the delta names a player the
    // mirror state does not have yet.
    const orphaned = { ...ctx, gameState: stateWith(player({ id: 'someone-else' })) };
    dispatchAbilityVfx(firedDelta(0), orphaned);
    expect(refs.aimPreviews.has('p1')).toBe(false);
  });

  it('CLEARS on a TAP ability fire — nothing is being aimed', () => {
    // Thunder Clap (stormcaller[2]) is TAP.
    const { refs, ctx } = ctxFor(stateWith(player()));
    dispatchAbilityVfx(previewDelta(2), ctx);
    dispatchAbilityVfx(firedDelta(2), ctx);
    expect(refs.aimPreviews.has('p1')).toBe(false);
  });

  it('a repeated AUTO cast keeps refreshing rather than toggling the preview', () => {
    // The behaviour the player actually sees while holding Lightning Arc: cast,
    // cooldown (previews keep arriving), cast again — the arrow never drops.
    const { refs, ctx } = ctxFor(stateWith(player()));
    for (let i = 0; i < 5; i++) {
      dispatchAbilityVfx(previewDelta(0), ctx);
      dispatchAbilityVfx(firedDelta(0), ctx);
      expect(refs.aimPreviews.has('p1'), `iteration ${i}`).toBe(true);
    }
  });
});
