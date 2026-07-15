# ADR-0002: Body/Spirit Position Split

## Status
Accepted

## Context

`PlayerState` (`packages/shared-types/src/player.ts`) tracks a single controllable position, `x`/`y`. While `isDown` (health at zero, pre-revive-timer-expiry), that position is frozen in place. Once the revive timer expires and `isSpirit` becomes `true`, the *same* `x`/`y` fields start moving again — this time under the downed player's own spirit-form input.

This means there is no way to represent "where the body fell" once the spirit has wandered off. A teammate attempting to revive a downed player checks proximity against `x`/`y`, which — for a player already in spirit form — is the spirit's current (moving) position, not the body's original location. The revive objective (reach the fallen body) and the actual proximity check (reach the moving spirit) silently diverge the moment spirit form begins.

Scoped from the 2026-07-14 correct-course review of `TODO.md` — not a new PRD/GDD functional requirement, but a correction to Story 3.6's original single-position model.

## Decision

Add two new optional fields to `PlayerState`: `bodyX?: number` and `bodyY?: number`. They are set once, at the moment a player transitions to `isDown`, to that player's position at that instant, and are left unchanged until the player is revived. `x`/`y` remain the single source of truth for the player's *controllable* position — the body's position while down-and-not-yet-spirit, the spirit's position once `isSpirit` is true.

The corresponding wire delta, `PlayerDownedDelta` (`packages/net-protocol`), gains the same two optional fields so the host's mirrored `GameState` can track the body position without a full snapshot.

This decision is split across three sequenced stories, one per ownership area, per CLAUDE.md's cross-context rule:
- **3.21a** (Protocol Architect): this schema/contract change.
- **3.21b** (Simulation Engineer): populates `bodyX`/`bodyY` at every down-transition, repoints the revive-proximity check at the body instead of the (now independently-moving) spirit, and snaps `x`/`y` back to `bodyX`/`bodyY` on revive.
- **3.21c** (Host Experience Engineer): renders the body and spirit as two distinct entities.

### Why optional, not required

`PlayerState` and `PlayerDownedDelta` are each constructed as object literals at multiple call sites inside `apps/simulation-server/src/rooms/GameRoom.ts` — outside this story's (3.21a's) allowed paths. A required field would fail those literals' typechecking the instant this schema change lands, forcing either scope creep into a blocked path or a broken build across a story boundary. Optional fields let 3.21a ship a complete, typechecking, contract-first change with zero simulation-code changes; 3.21b then populates real values at every relevant call site. This mirrors the same additive-extension pattern already used elsewhere in this codebase (e.g. `AbilityDeliveryType` growing new members without touching existing table entries).

## Rationale

A dedicated field pair, rather than reusing `x`/`y` with a computed "was this the down position" flag, keeps the down-position immutable and trivially inspectable — no need to reconstruct it from event history or guess based on `isDown`/`isSpirit` state. It also keeps the wire contract explicit: any client can render "the body" without knowing the down/spirit state machine's internals, it just reads `bodyX`/`bodyY` directly.

## Consequences

Positive:
- The revive objective (reach the body) and the actual proximity/targeting check can now agree, even after the spirit has moved.
- Host rendering can show two entities (body + spirit) without inventing its own position-tracking logic.
- Additive, backward-compatible wire change — no existing field renamed, removed, or retyped.

Negative:
- Two new fields on the hottest, most-frequently-constructed state object in the simulation (`PlayerState`) — small, fixed memory cost per player.
- Optional-field typing means TypeScript cannot enforce that `bodyX`/`bodyY` are always set once `isDown` is true; that invariant is enforced by 3.21b's implementation discipline, not the type system, consistent with this codebase's general preference for trusting internal invariants over type-level enforcement.
- A brief transition window exists between 3.21a landing and 3.21b landing where `player:downed` deltas may omit `bodyX`/`bodyY`; `apply-delta.ts` falls back to the player's current `x`/`y` in that case so the mirrored host state degrades gracefully rather than leaving the fields `undefined`.
