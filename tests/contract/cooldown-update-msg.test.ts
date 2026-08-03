import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from 'net-protocol';
import type { CooldownUpdateMsg } from 'net-protocol';

// ADR-0004: cooldown:update carries server epochs + the server send-clock, so the
// controller can render a cooldown that matches the sim's authoritative timing and
// survives reconnect (replaces the former duration-based `remainingMs`).
describe('CooldownUpdateMsg round-trip', () => {
  it('survives serialize → deserialize with all epoch fields', () => {
    const msg: CooldownUpdateMsg = {
      type: 'cooldown:update',
      abilityIndex: 2,
      startedAtMs: 1_700_000_000_000,
      expiresAtMs: 1_700_000_003_000,
      serverNowMs: 1_700_000_000_000,
    };
    expect(deserialize<CooldownUpdateMsg>(serialize(msg))).toEqual(msg);
  });

  it('encodes "cleared" as expiresAtMs <= serverNowMs (both 0)', () => {
    const msg: CooldownUpdateMsg = {
      type: 'cooldown:update',
      abilityIndex: 0,
      startedAtMs: 0,
      expiresAtMs: 0,
      serverNowMs: 1_700_000_000_000,
    };
    const round = deserialize<CooldownUpdateMsg>(serialize(msg));
    expect(round).toEqual(msg);
    // The client's "cleared" predicate: expiresAtMs <= serverNowMs.
    expect(round.expiresAtMs <= round.serverNowMs).toBe(true);
  });
});
