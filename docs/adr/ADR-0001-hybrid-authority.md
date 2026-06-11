# ADR-0001: Hybrid Authority Model

## Status
Accepted

## Context

The project is a real-time cooperative dungeon crawler where the game runs on a shared host screen and players join from their phones as controllers. The product must support two modes:
- Local Party Mode, where phones connect over the local network and low latency is critical.
- Online / Remote Mode, where players connect over the internet and latency mitigation is required.

The architecture must support host rendering, mobile input, shared contracts, future progression systems, and telemetry without forcing cloud round trips into the local gameplay loop.

## Decision

Adopt a hybrid authority model:
- In Local Party Mode, the authoritative session runs on the host machine.
- In Online / Remote Mode, the authoritative session runs in a cloud region.
- In both modes, the same core simulation module is used.
- The host client is not the authority for collision, hit resolution, combat outcomes, or enemy AI.
- Mobile controllers send explicit input events only.
- Cloud services may handle account, progression, room metadata, telemetry, and post-run synchronization, but are not on the critical gameplay path in local mode.

## Rationale

This model minimizes latency in the flagship local couch mode while preserving a path to remote multiplayer. It also avoids duplicating gameplay logic across local and remote deployments because both modes share one simulation core.

## Consequences

Positive:
- low input latency in local sessions
- clearer separation between rendering and simulation
- easier long-term support for both local and remote modes
- better testability through explicit event contracts

Negative:
- more complexity than a purely local or purely cloud solution
- reconnect, room lifecycle, and session placement need stronger design discipline
- state sync and compatibility require stricter protocol ownership

## Guardrails

- The host client may render authoritative state but may not invent gameplay outcomes.
- The mobile controller may submit input but may not mutate game state directly.
- Any change to authority boundaries requires an ADR update.
- Any protocol change affecting both modes requires compatibility review.

## Boundary Examples

These examples are intended to be read without referencing the full ADR. When a question arises during implementation, check this section first.

### What the host client MAY do

- **Render interpolated positions** between two authoritative ticks for visual smoothness. This is a purely presentational operation; the interpolated position is never fed back into any gameplay decision.
- **Play sounds or particle effects** triggered by state events received from the simulation server (e.g., play a hit sound when a received `PlayerStateSnapshot` shows reduced HP).
- **Show reconnect UI** when a `SessionStateEvent` indicates a player has disconnected. The host displays the state the server reported; it does not decide the player is disconnected on its own.
- **Apply animation-layer smoothing** — for example, blending between run and idle animations based on the velocity field in a received `PlayerStateSnapshot`. This is allowed because it is a purely presentational layer. The underlying state values (position, HP, state enum) must always be sourced from authoritative snapshots. The host must never feed smoothed values back into any gameplay decision.
- **Display HUD elements** (HP bars, cooldown indicators, skill availability) derived directly from fields in `PlayerStateSnapshot`. The host reads and displays; it does not recalculate.
- **Cache the last known `PlayerStateSnapshot`** for a disconnected player to show a "ghost" position on screen while the reconnect flow is in progress. Displaying stale state is acceptable. Fabricating new state is not.

### What the host client MAY NOT do

- **Resolve collision** between players or between players and walls. All collision is owned by the simulation server.
- **Decide whether a skill hit an enemy.** Hit detection, damage application, and combat outcome resolution are simulation-only operations.
- **Mutate player HP directly.** The host must wait for a server-authoritative `PlayerStateSnapshot` that reflects the new HP value. It may not decrement HP locally as a prediction.
- **Reorder, drop, or replay input events on behalf of a mobile controller.** `MoveInputEvent` and `SkillInputEvent` travel from phone to simulation server. The host is not in that path and must not intercept or manipulate it.
- **Invent a `PlayerStateSnapshot` when the server is silent.** If no update has arrived, the host may display the last known state (marked stale if needed), but it may never fabricate a state update.
- **Run enemy AI or decide enemy movement.** All non-player entity behavior is owned exclusively by the simulation server.

### Explicit answers to common implementation questions

**Q: Can the host apply animation-layer smoothing?**
Yes. The host may apply animation smoothing as a purely presentational layer, provided the underlying state values (position, HP, state enum) are always sourced from authoritative `PlayerStateSnapshot` events. The smoothed values must never be fed back into any gameplay decision.

**Q: Can the host reorder events for rendering?**
No for input events. The host must not reorder or replay `MoveInputEvent` or `SkillInputEvent` on behalf of controllers.
For state events (`PlayerStateSnapshot`), the host may buffer and interpolate between two received snapshots for visual smoothness, but must always advance toward the most recent authoritative state. It may not suppress, discard, or reorder authoritative state updates.

### Decision rule

When in doubt: if the host would need to know a rule from `packages/game-rules` to make a decision, that decision belongs in the simulation server.

---

## Follow-up Documents

- `docs/specs/networking-spec.md`
- `docs/specs/telemetry-spec.md`
- `docs/specs/controller-ux-spec.md`
- `docs/specs/host-ux-spec.md`
