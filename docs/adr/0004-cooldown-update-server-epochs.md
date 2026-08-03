# ADR-0004: `cooldown:update` carries server epochs, not a duration

- **Status:** Proposed — pending Protocol Architect review
- **Date:** 2026-07-25
- **Deciders:** (author) via cooldown-sync investigation; Protocol Architect review required (contract-change hook)
- **Affected contract:** `packages/net-protocol` — `CooldownUpdateMsg` (server → mobile controller)

## Context

A playtest surfaced two long-standing symptoms on the mobile controller:

1. **AUTO abilities** held down fire a few times, then stall and fire only sporadically, with no cooldown shown — traced to the controller emitting ability inputs at ~30/s unthrottled (fixed separately, mobile-only) plus the sim burning cooldowns on zero-aim casts (fixed separately, `dispatchAbility`).
2. **RELEASE abilities** show a cooldown overlay that "randomly resets" — traced to this contract.

The old message was duration-based:

```ts
interface CooldownUpdateMsg { type: 'cooldown:update'; abilityIndex: number; remainingMs: number; }
```

The client computed `expiresAt = Date.now() + remainingMs` at **message-receipt time**. Two defects:

- **Latency/receipt anchoring:** the client's cooldown ends ~one-way latency later than the server's.
- **Reconnect arc corruption:** on reconnect the server sent the *remaining* time, so the client set the arc's total sweep duration to that remaining value — the arc animated as if the whole cooldown were that short. This is the "overlay reset" the user saw.

The duration form was, however, **immune to host↔phone wall-clock skew** (it's a delta on the client's own clock). The controller and the sim run on **separate devices** in Local Party Mode, whose wall clocks can differ (NTP drift), so any epoch-based scheme must not assume synchronized clocks.

## Decision

`cooldown:update` now carries **server epochs plus the server send-clock**:

```ts
interface CooldownUpdateMsg {
  type: 'cooldown:update';
  abilityIndex: number;
  startedAtMs: number;  // server epoch the cooldown began
  expiresAtMs: number;  // server epoch it ends; <= serverNowMs means "cleared / ready now"
  serverNowMs: number;  // server Date.now() at send, for skew correction
}
```

The client corrects for cross-device clock skew per message:

```ts
if (msg.expiresAtMs > msg.serverNowMs) {
  const skew = Date.now() - msg.serverNowMs;         // one-way latency + clock offset
  cd = { startAt: msg.startedAtMs + skew, expiresAt: msg.expiresAtMs + skew };
} else {
  cd = null;                                          // cleared
}
```

This is latency-corrected to within one-way LAN latency (~10 ms — negligible), reconnect-correct (the server reconstructs the true `startedAt = expiresAt − fullCooldownMs`), and clock-skew-immune.

## Alternatives considered

- **Raw server epochs (no `serverNowMs`)** — rejected: breaks if the phone's wall clock differs from the host's by more than a fraction of the cooldown (a 1 s skew fully corrupts a 1 s arc).
- **Keep `remainingMs`, add `totalMs`** — viable and skew-immune, but still latency-anchored at receipt; the epoch+skew form is strictly more accurate and no more complex on the wire.

## Compatibility checklist (contract-change hook)

- **Breaking change** to `CooldownUpdateMsg` (field replaced, not added). Acceptable because in Local Party Mode the sim, host, and mobile builds are versioned and deployed together — there is no mixed-version wire scenario.
- All 7 server emit sites updated (`GameRoom.sendCooldownUpdate` helper) and the single client consumer (`App.tsx`).
- Contract test updated (`tests/contract/cooldown-update-msg.test.ts`) — round-trips all epoch fields and the "cleared" encoding.
- No change to `EventNames`, message routing, session lifecycle, reconnect *flow* (only the reconnect *payload* is now reconstructed correctly), or any snapshot/delta.

## Consequences

- The controller cooldown display now matches the sim's authoritative timing and survives reconnect.
- Future consumers read server truth directly; "cleared" is `expiresAtMs <= serverNowMs`.
- Any new emit site must go through `GameRoom.sendCooldownUpdate` so `serverNowMs` is stamped consistently.
