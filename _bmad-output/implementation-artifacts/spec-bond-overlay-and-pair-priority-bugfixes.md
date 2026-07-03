---
title: 'Bond overlay stays visible + pair selection ignores unbonded players'
type: 'bugfix'
created: '2026-07-03'
status: 'done'
route: 'one-shot'
---

<frozen-after-approval reason="human-owned intent — do not modify unless human renegotiates">

## Intent

**Problem:** (1) After a bond is assigned the overlay text never fades — the fade/clear timers were cancelled when the parent component cleared `latestTransientDelta` to null at 400ms. (2) `selectBondPair` selected from all players randomly, ignoring whether they already had a bond.

**Approach:** (1) Move the overlay lifecycle timers to a separate `useEffect` keyed on `bondOverlay?.text` so they survive the 400ms delta clear. (2) Extend `selectBondPair` to prefer unbonded players: both from the unbonded pool when 2+ exist, the lone unbonded player forced into the pair when only 1, random fallback when all are bonded.

## Boundaries & Constraints

**Always:** Bond overlay text must disappear ~3s after appearing, fading out over 0.5s. Unbonded players must be preferred in pair selection whenever at least one exists.

**Ask First:** N/A — both are clear bug fixes with no design decision.

**Never:** Do not change the BondState shape, net-protocol contracts, or shared-types. Do not touch GameRoom tick logic.

## I/O & Edge-Case Matrix

| Scenario | Input / State | Expected Output / Behavior | Error Handling |
|----------|--------------|---------------------------|----------------|
| Overlay timer cancel | `latestTransientDelta` cleared to null at 400ms while overlay is visible | Overlay still fades at 2700ms, disappears at 3200ms | — |
| Same bond text re-assigned | Identical bond pair re-triggers `bond:assigned` | Timers reset (effect re-runs only if text changes; same text = no reset — acceptable for alpha) | — |
| 4 players, 2 bonded | `activeBonds = [p0+p1]` | `selectBondPair` always returns `[p2, p3]` | — |
| 3 players, 2 bonded | `activeBonds = [p0+p1]`, only `p2` unbonded | `selectBondPair` always includes `p2` | — |
| All players bonded | All in `activeBonds` | Falls back to random pair from all players | — |
| 2 players | `players = [p0, p1]`, both bonded | `poolB.length === 1`, index 0 — no panic | — |

</frozen-after-approval>

## Code Map

- `apps/host-client/src/screens/DungeonScreen.tsx:280` -- bond overlay state set here; lifecycle timers moved to separate effect at ~344
- `packages/game-rules/src/systems/bonds.ts:19` -- `selectBondPair` — added `bonds` param + priority logic
- `packages/game-rules/src/systems/bonds.ts:35` -- `assignBond` — passes `state.activeBonds` to `selectBondPair`
- `tests/unit/bonds.test.ts:55` -- `selectBondPair` tests — updated to `(players, [], rng)` signature + 2 new priority tests

## Tasks & Acceptance

**Execution:**
- [x] `apps/host-client/src/screens/DungeonScreen.tsx` -- remove timers from `bond:assigned` branch; add `useEffect` keyed on `bondOverlay?.text` -- timers survive parent clearing `latestTransientDelta`
- [x] `packages/game-rules/src/systems/bonds.ts` -- add `bonds: BondState[]` param to `selectBondPair`; prefer unbonded pool -- implements priority requirement
- [x] `packages/game-rules/src/systems/bonds.ts` -- `assignBond` passes `state.activeBonds` to `selectBondPair` -- wires priority into live flow
- [x] `tests/unit/bonds.test.ts` -- update `selectBondPair` callers to new 3-arg signature; add 2 priority assertion tests -- confirms priority behavior is enforced

**Acceptance Criteria:**
- Given a bond is assigned, when `latestTransientDelta` is cleared to null at 400ms, then the overlay still fades at 2700ms and is removed at 3200ms
- Given 4 players with 2 already bonded, when `selectBondPair` is called, then only the 2 unbonded players are selected
- Given 3 players with 2 bonded (1 unbonded), when `selectBondPair` is called, then the unbonded player is always included in the pair
- Given all players bonded, when `selectBondPair` is called, then any valid pair is returned without panicking

## Spec Change Log

## Suggested Review Order

1. [`packages/game-rules/src/systems/bonds.ts:19`](../../packages/game-rules/src/systems/bonds.ts) — `selectBondPair` new logic (pool A / pool B priority)
2. [`packages/game-rules/src/systems/bonds.ts:35`](../../packages/game-rules/src/systems/bonds.ts) — `assignBond` call with `state.activeBonds`
3. [`tests/unit/bonds.test.ts:55`](../../tests/unit/bonds.test.ts) — updated tests + 2 new priority assertions
4. [`apps/host-client/src/screens/DungeonScreen.tsx:280`](../../apps/host-client/src/screens/DungeonScreen.tsx) — `bond:assigned` branch (timers removed)
5. [`apps/host-client/src/screens/DungeonScreen.tsx:343`](../../apps/host-client/src/screens/DungeonScreen.tsx) — new lifecycle effect keyed on `bondOverlayText`

## Design Notes

**Why a separate effect for timers:** The main delta effect's cleanup cancels all returns when `latestTransientDelta` changes. Keying on `bondOverlay?.text` instead means the timers only reset when a genuinely new bond text arrives — not on every parent re-render or delta clear. The `fading` flag changes to `true` at 2700ms without changing `text`, so the effect doesn't re-run and timers aren't cancelled mid-fade.

**Why poolA / poolB instead of three code paths:** The two-pool approach covers all three cases (2+ unbonded, 1 unbonded, 0 unbonded) in 4 lines without duplicating the pair-selection arithmetic.

## Verification

**Commands:**
- `npx vitest run tests/unit/bonds.test.ts` -- expected: 28 pass, 0 fail
- `npx tsc -p apps/host-client/tsconfig.json --noEmit` -- expected: no errors
- `npx tsc -p packages/game-rules/tsconfig.json --noEmit` -- expected: no errors
