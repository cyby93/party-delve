# ADR-0003: Ability Presentation Contract

## Status
Accepted

## Context

Epic 7 adds bespoke visual effects (VFX) for every ability. To draw an effect where the ability actually lands and at the size it actually hits, the host renderer needs each ability's *spatial* geometry — its hit range, hit radius, delivery type (beam / projectile / zone), and a few spatial-sweep values (Spirit Nova's swept radius, Storm Eye's zone radius, projectile speed/range).

Those values live in `packages/game-rules/src/balance.ts`. The project's boundary rule (`_bmad-output/project-context.md`) is blunt: **"Never import `packages/game-rules` in `apps/host-client`."** The host is a pure renderer; `game-rules` is protected authoritative-simulation core. So Stories 7.2 and 7.3 did the only thing the rule allowed — they **hand-transcribed** the geometry into local host constants (`hitRangePx`, `ANCESTORS_VOICE_RANGE_PX`, …).

That transcription is a silent copy. Change `ABILITY_HIT_RANGE_PX.stonehide[3]` in `balance.ts` and the sim hits farther while the VFX keeps drawing at the old range — a visual that now *lies* about the ability's reach, which is exactly the property (a trustworthy validation surface) the VFX is supposed to provide. This drift was flagged in the 7.2 code review as **`D-7.2-A`**.

Two ways to address it were considered:
- **Option A — a contract test that detects drift.** A `tests/contract` assertion comparing the host literals to the balance values. Rejected as the primary fix: it only *detects* drift after the fact and still requires a human to hand-edit two places in lockstep.
- **Option B — one source of truth both sides read (chosen).** Move the ability *spatial/presentation* geometry to a host-importable shared location so the sim and the renderer read the **same** values; changing a range updates both from a single edit. User decision, 2026-07-23.

`shared-types` is the correct shared home and introduces **no dependency cycle**: `packages/game-rules` already depends on `shared-types` (`game-rules → shared-types`, one-way); `shared-types` imports nothing from `game-rules`; and the host already imports from `shared-types` (`PlayerClass`, `PURIFICATION_PULSE_DURATION_MS`, …). Adding geometry constants there and having `game-rules` re-export them keeps every arrow pointing one way.

## Decision

Introduce the **ability presentation contract**: `packages/shared-types/src/ability-geometry.ts` (re-exported from the `shared-types` barrel). It holds the **spatial + delivery + spatial-sweep** subset of ability tuning that both the simulation and the host renderer must agree on:

- `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX`
- `ABILITY_DELIVERY` (and the `AbilityDeliveryType` union)
- `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`
- `SPIRIT_NOVA_MAX_RADIUS_PX`, `SPIRIT_NOVA_DURATION_MS` (the visible sweep must match the real swept radius)
- `STORM_EYE_ZONE_RADIUS_PX`, and `VOID_PULSE_ZONE_RADIUS_PX` (the Void Pulse chained-zone radius, extracted out of `ABILITY_CHAINED_ZONE` into a named constant so the table's game-logic fields — `effectType`, `tickIntervalMs`, `durationMs` — stay in `balance.ts` and reference the shared radius).

Every value is byte-identical to its former `balance.ts` definition — this is a relocation, not a re-tune.

- **The simulation** reads these via `game-rules`, which now **re-exports** them from `shared-types` (`export { ABILITY_HIT_RANGE_PX, … } from 'shared-types'`). Every existing `import { … } from 'game-rules'` keeps resolving; `apps/simulation-server` sees zero import churn and behaves identically.
- **The host** imports the contract directly from `shared-types` and computes its VFX placement/sizing from it. The hand-transcribed geometry literals in `apps/host-client/src/vfx/ability-vfx.ts` and `spiritcaller-vfx.ts` are deleted.
- **Pure balance stays put.** Damage, cooldown, heal, status-effect magnitude, displacement strength, lifesteal, and self-cost remain in `balance.ts` and remain **host-forbidden** — the host never renders them as geometry. The one design-time coupling that survives (VFX effect durations must fit inside `ABILITY_COOLDOWNS_MS`) is enforced by a `tests/contract` test, the one tier allowed to import both `game-rules` and the host visual constants.

### The refined boundary rule

The host boundary is narrowed, not abandoned:

> **The host never imports `game-rules` *logic*. The shared ability spatial/presentation contract lives in `shared-types` and is host-importable.**

The split is decided by one question — *does the host need this value at runtime to render honestly?*

| Constant | Host renders it as geometry? | Home |
|---|---|---|
| `ABILITY_HIT_RANGE_PX`, `ABILITY_HIT_RADIUS_PX` | Yes — where/how big the effect lands | `shared-types` (contract) |
| `ABILITY_DELIVERY` | Yes — beam vs projectile vs zone | `shared-types` |
| `SPIRIT_NOVA_MAX_RADIUS_PX` / `SPIRIT_NOVA_DURATION_MS` | Yes — the visible sweep must match the real sweep | `shared-types` |
| `STORM_EYE_ZONE_RADIUS_PX`, `VOID_PULSE_ZONE_RADIUS_PX` | Yes — zone size | `shared-types` |
| `PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX` | Yes — trail placement (7.8) | `shared-types` |
| `ABILITY_DAMAGE`, `ABILITY_HEAL_AMOUNT`, status magnitude, displacement, lifesteal, self-cost | No — pure balance, never a shape | `game-rules` (host-forbidden) |
| `ABILITY_COOLDOWNS_MS` | No at runtime — only a design-time budget bound | `game-rules`; budget invariant enforced by `tests/contract` |

This refines the original `project-context.md` rule ("Never import `game-rules` in the host"). That rule's real intent was *"the renderer must not execute or depend on authoritative simulation logic"* — pure spatial data was never part of that intent.

## Consequences

Positive:
- VFX tracks balance automatically: tuning an ability's range/radius moves the sim hit **and** its on-screen effect from a single edit. The visuals become a trustworthy validation tool rather than a snapshot that silently drifts.
- `D-7.2-A` is resolved at the source, not merely detected.
- Additive, backward-compatible: no existing `game-rules` import path breaks (re-export), no wire message / schema field / session-lifecycle / reconnect / room-state / join-flow / prediction surface changes — the change is a compile-time constant relocation, behaviourally inert.
- Future ability VFX (7.4/7.5/7.6/7.8) are authored against the contract from the start; their specs were re-pointed by Story 7.9 so they import rather than transcribe.

Negative / trade-offs:
- The host/`game-rules` boundary is now a slightly more nuanced rule ("no *logic* import") than the old blunt one ("no import"). This ADR is the canonical statement of where the line falls, so the nuance is documented rather than folklore.
- One more responsibility for `shared-types`: it now owns presentation-relevant spatial constants, not only wire/DTO types. Acceptable — it was already the home for host-imported timing constants (`PURIFICATION_PULSE_DURATION_MS`).

## Alternatives considered

- **A contract test alone (Option A).** Rejected as the primary fix — it detects drift after it happens and still requires two hand-edits in lockstep. (Retained only for the cooldown-budget invariant, which is genuinely balance-only.)
- **A new `game-config` / `ability-config` package.** Rejected — `shared-types` is the existing importable home with the right dependency direction already established; a new package is ceremony for no benefit.
- **Moving the whole `balance.ts` into `shared-types`.** Rejected — that would make pure simulation balance (damage/cooldown/heal) host-importable, dissolving the boundary this ADR is trying to *refine*, not erase.

## References

- `D-7.2-A` — `_bmad-output/implementation-artifacts/deferred-work.md`
- Story 7.9 — `_bmad-output/implementation-artifacts/7-9-shared-ability-geometry-contract.md`
- ADR-0001 (hybrid authority), ADR-0002 (body/spirit position split)
- `_bmad-output/project-context.md` — the original "never import game-rules in the host" rule this ADR refines
