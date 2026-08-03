# ADR-0008: Aim-Preview Contract

## Status

Accepted

## Context

`TODO.md` (worked through via `gds-correct-course` on 2026-08-03) asked for two related visuals: a generic aiming-direction indicator for any aimed ability, and a destination/zone preview for zone-targeted abilities specifically naming Storm Eye, Stone Wall, Dark Pact, and Crimson Lash.

Investigation found the host has **no visibility at all** into an in-progress aim before an ability fires. `handleAbilityFire` (`apps/mobile-controller/src/screens/ControllerScreen.tsx:1145-1152`) only sends the `ability` input event — carrying `directionX`/`directionY` — at the moment of fire. For `AUTO`/`AIM_CAST` abilities (continuous/held types), that moment repeats every ~33ms while the input is held, so a live direction stream already exists as a side effect of firing. For `RELEASE`-type abilities — which is what all four named zone-target abilities are (`class-definitions.ts`: Stone Wall, Crimson Lash, Dark Pact, Storm Eye all `inputType: 'RELEASE'`) — nothing is sent until the thumb lifts and the ability actually casts. There is no drag-phase signal to preview from.

This is a genuine contract gap, not a rendering gap: per `CLAUDE.md`'s event-contract discipline, phones send typed input events and the sim broadcasts typed deltas — there is currently no typed event for "aiming, not yet firing."

## Decision

Add a presentation-only, non-mutating extension to the existing ability-presentation contract (ADR-0003):

- **Mobile → server:** `input:aim-preview` (`{ abilityIndex, directionX, directionY }`), throttled at the same ~33ms cadence as the existing joystick input. Sent only while a `RELEASE`-type ability is mid-drag, before release/fire; stops on release, fire, or touch-cancel. `AUTO`/`AIM_CAST` abilities never send this — their existing continuous-fire input already carries live direction.
- **Server → all clients (broadcast delta):** `ability:aim-preview` (`{ playerId, abilityIndex, directionX, directionY, targetX?, targetY? }`). The sim computes `targetX`/`targetY` (for zone-placement abilities) using the *same* geometry/delivery math already used at real cast time (`ABILITY_GEOMETRY`, existing placement functions) — never a duplicated formula. This delta is derived, throttled, and never written to persistent `GameState`; it carries no gameplay effect and does not touch the PRNG or tick determinism.
- **Host:** renders a translucent aim-direction arrow off whichever direction is currently live (the real fire-direction stream for `AUTO`/`AIM_CAST`, the new preview stream for `RELEASE`), plus a destination/zone preview shape for the four named abilities — Storm Eye (circle), Stone Wall/Crimson Lash (cone, reusing the 7.13 cone/wedge primitive), Dark Pact (its existing hit-shape). Cleared on fire or on the aim stopping.

## Consequences

Positive:
- No duplicated placement math — the preview reuses the exact functions that already compute real cast placement, so preview and actual landing spot can never drift apart the way `D-7.2-A` (ADR-0003's motivating drift bug) did.
- Additive only: new input type, new delta type, no existing message shape changes.
- `AUTO`/`AIM_CAST` abilities need zero mobile-side change — the aiming arrow for those is nearly free once the broadcast/render side lands.

Negative / trade-offs:
- `RELEASE`-type abilities need a genuinely new mobile-side sending path (Story 7.15d) — this is not purely a host/VFX-layer addition, despite originating from a VFX ask.
- One more throttled broadcast channel per aiming player; expected negligible at current player counts (≤8), but call out for the same perf-sanity-check discipline used elsewhere in the Simulation-safety hook.

## References

- `sprint-change-proposal-2026-08-03.md`
- ADR-0003 (Ability Presentation Contract) — this extends that contract's "does the host need this to render honestly?" framing to a pre-fire, in-progress state
- ADR-0005 (Cone Hit-Geometry) — the cone/wedge primitive reused for Stone Wall/Crimson Lash's zone preview
- Stories 7.15a/7.15b/7.15c/7.15d (`epics.md`, "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview")
