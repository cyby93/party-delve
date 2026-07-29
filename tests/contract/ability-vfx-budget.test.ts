import { describe, expect, it } from 'vitest';
import { PlayerClass, SPIRIT_NOVA_DURATION_MS } from 'shared-types';
import { ABILITY_BALANCE } from 'game-rules';
import {
  getAbilityVfxConfig,
  type AbilityVfxConfig,
} from '../../apps/host-client/src/vfx/ability-vfx.js';

/**
 * Cross-package contract test (Story 7.9, AC5). `tests/contract/**` is the one
 * tier permitted to import BOTH `game-rules` and the host visual constants, so it
 * backstops the 7.2 **AC5 budget invariant** — every on-screen effect must be
 * strictly shorter than its ability's cooldown, so at most one instance per
 * ability per player is ever live — against the LIVE `ABILITY_BALANCE` cooldowns
 * rather than a hand-copied cooldown literal in the host unit test (which drifts;
 * that literal was removed from `ability-vfx.test.ts` by this story).
 *
 * Two coverage sources are combined so the invariant does not silently shrink to
 * one class:
 *   1. Every ability whose durations are exposed as data via `getAbilityVfxConfig`
 *      (`ability-vfx.ts` imports only `shared-types`, no PixiJS, so it is safe to
 *      pull into this node test). Coverage grows automatically as 7.4/7.5 land
 *      their config tables.
 *   2. Spiritcaller's Spirit Nova sweep, whose duration is the importable shared
 *      constant `SPIRIT_NOVA_DURATION_MS` — its imperative composer
 *      (`spiritcaller-vfx.ts`) pulls PixiJS and cannot be imported here, but its
 *      longest effect duration IS this contract value, so it is checked directly.
 */

/** Every duration one cast of this config can put on screen. */
function durationsOf(cfg: AbilityVfxConfig): number[] {
  return [
    ...cfg.rings.map(r => r.durationMs),
    ...(cfg.beam ? [cfg.beam.durationMs] : []),
    ...(cfg.burst ? [cfg.burst.durationMs] : []),
  ];
}

const CLASSES = [
  PlayerClass.STONEHIDE,
  PlayerClass.SPIRITCALLER,
  PlayerClass.SOULDRINKER,
  PlayerClass.STORMCALLER,
] as const;

/** Flatten every checkable (ability, longest-effect, live-cooldown) triple. */
function collectConfigChecks(): { label: string; longest: number; cooldown: number }[] {
  const checks: { label: string; longest: number; cooldown: number }[] = [];
  for (const cls of CLASSES) {
    for (let i = 0; i < 4; i++) {
      const cfg = getAbilityVfxConfig(cls, i);
      if (cfg === null) continue;
      const durations = durationsOf(cfg);
      if (durations.length === 0) continue;
      checks.push({
        label: `${cls}[${i}]`,
        longest: Math.max(...durations),
        cooldown: ABILITY_BALANCE[cls][i as 0 | 1 | 2 | 3].cooldownMs,
      });
    }
  }
  return checks;
}

describe('ability VFX cooldown-budget invariant (7.2 AC5, live cooldowns)', () => {
  const configChecks = collectConfigChecks();

  it('actually runs budget assertions — guards a silently-empty pass', () => {
    // Hardened: asserts the *assertion set* is non-empty, not merely that some
    // non-null config exists. A future non-null config carrying no ring/beam/burst
    // duration would no longer sneak through as a green no-op.
    expect(configChecks.length).toBeGreaterThan(0);
  });

  for (const { label, longest, cooldown } of configChecks) {
    it(`${label} longest effect is shorter than its live cooldown`, () => {
      expect(longest).toBeLessThan(cooldown);
    });
  }

  it('Spirit Nova sweep is shorter than its live cooldown (importable-constant coverage)', () => {
    // Spiritcaller's longest effect is the Spirit Nova ring sweep, whose duration
    // is the shared SPIRIT_NOVA_DURATION_MS. Spirit Nova is slot 1.
    expect(SPIRIT_NOVA_DURATION_MS).toBeLessThan(ABILITY_BALANCE[PlayerClass.SPIRITCALLER][1].cooldownMs);
  });
});
