# Sprint Change Proposal — Ability & Environmental VFX Prototyping Epic

**Date:** 2026-07-21
**Trigger:** User observation that abilities are mechanically complete (Epics 1–6, Epic 3 Extension) but have no dedicated visual identity — every ability renders as a generic colored circle. Follows up on a note excluded from `sprint-change-proposal-2026-07-14.md` (§6) for being underspecified at the time: *"Placeholder VFX for abilities before the last four epics."* Now fully scoped.
**Mode:** Incremental
**Prepared by:** Correct Course workflow

---

## 1. Issue Summary

Reviewing `apps/host-client/src/screens/DungeonScreen.tsx` against the 16 shipped abilities (4 classes × 4 abilities, reworked in the Epic 3 Extension) and the Grassland boss (Epic 6) confirms the gap is real and specific, not a matter of taste:

- **Every projectile**, regardless of ability or class, renders identically: `g.circle(0, 0, 8).fill({ color: 0xffffff })` (`DungeonScreen.tsx:308`) — Blood Spike and Lightning Arc are visually indistinguishable.
- **Every zone/field**, regardless of ability, renders identically: `g.circle(0, 0, zone.radius).fill({ color: 0x9b59b6, alpha: 0.25 })` (`DungeonScreen.tsx:329`) — Void Pulse and Storm Eye look the same.
- **Status effects** are one generic badge differentiated only by fill color (`DungeonScreen.tsx:258-260,286`) — the code comment itself flags this: *"one generic badge per entity, differentiated by color only."*
- **Boss charge attacks have no visual telegraph at all**: `boss:charged` is emitted by the sim (`GameRoom.ts:1926`) but is not in the host's transient-delta whitelist (`host-session.ts:50-63`) — a `ponytail:` comment at the emit site notes *"charge is a movement event handled by tickBoss — no client delta needed,"* which was true for movement but leaves the attack itself unsignaled.
- Ability-cast feedback on the caster is a flat opacity flash (`ABILITY_FLASH_MS`, `DungeonScreen.tsx:29,125-143`) — same treatment for a tap-heal and a channelled AoE.

This is not a bug against any shipped acceptance criteria — every AC that mentions rendering ("ability effect delta event... rendered in-canvas," Story 3.3) is technically satisfied by the flat circle. It's a scoped gap the epic list never accounted for: the GDD's Art Direction section commits to isometric pixel art via PixelLab MCP, but explicitly has no reference images yet and production hasn't started (`gdd.md:355`). Nothing currently bridges "mechanically done" to "art not started yet."

---

## 2. Impact Analysis

### Epic Impact

| Epic | Current status | Impact |
|---|---|---|
| Epic 1–6, Epic 3 Extension | `done` | **No impact.** Nothing here reopens or regresses shipped ACs — every ability's data path (delta events, `ProjectileState`/`ZoneState` fields incl. `class`/`abilityIndex` from Story 3.13) already carries what a richer renderer needs. |
| Epic 7 (Progression), Epic 8 (Full Class Roster), Epic 9 (Ancient Forest Biome), Epic 10 (Polish/Telemetry) | all `backlog`, **zero stories written** (`sprint-status.yaml:590-612`) | Cheapest possible point to insert and renumber. Full Class Roster (+24 abilities) and Ancient Forest Biome (new boss + enemy pool) both benefit from having a VFX vocabulary in place *before* they add more abilities that would otherwise repeat today's flat-circle treatment. |

**New epic required:** yes — inserted as **Epic 7: Ability & Environmental VFX Prototyping**, renumbering Progression → 8, Full Class Roster → 9, Ancient Forest Biome → 10, Polish/Performance/Telemetry → 11.

### Artifact Conflicts

- **GDD:** No conflict — this doesn't replace the planned PixelLab pixel-art pass, it's explicitly framed as pre-art prototyping. One line worth adding to the GDD's Art Direction section so a future reader doesn't mistake the shape-based VFX for the final call.
- **Architecture (`game-architecture.md`):** No conflict expected. This is additive rendering logic entirely inside `apps/host-client`, consuming delta events and state fields that already exist (`ability:fired`/cooldown deltas, `status:applied`/`status:expired`, `ProjectileState`, `ZoneState`, `boss:*`). One gap to close as part of this work, not a new contract: `boss:charged` needs adding to the host's transient-delta whitelist (`host-session.ts`) — a one-line fix, not a schema change.
- **UX specs (`DESIGN.md`/`EXPERIENCE.md`):** No conflict. Nothing in the UX specs mandates flat circles; this is unspecified/unbuilt territory, and the work stays inside the existing "no HTML overlay for in-canvas effects" principle (UX-DR16, UX-DR12).
- **PRD/FRs:** No FR or NFR currently mandates ability VFX before final art — this is a quality/sequencing decision, not a requirements gap. Framed honestly in the epic as "no new FRs," similar precedent to the Epic 3 Extension (scoped from a brainstorming session, not new PRD FRs).

---

## 3. Recommended Approach

**Option 1 — Direct Adjustment.** Insert a new epic within the existing structure; renumber the three unstarted backlog epics behind it. No rollback (nothing shipped needs undoing — this is pure addition on top of working systems) and no PRD/MVP scope reduction.

- Effort: **Medium** — 4 classes × 4 abilities + boss + a handful of environmental items, but the sim-side data (which ability, which class, which effect type) already exists on every relevant delta/state field, so this is a host-client rendering epic, not a protocol epic.
- Risk: **Low** — single ownership area (Host Experience Engineer, `apps/host-client` + `packages/ui-kit`), ~zero chance of touching simulation authority or existing contracts.

---

## 4. Detailed Change Proposals

### `epics.md` — Epic List (renumber)

**OLD** (lines 180–222):
```
## Epic List
...
### Epic 7: Progression & Persistent Meta
...
### Epic 8: Full Class Roster
...
### Epic 9: Ancient Forest Biome
...
### Epic 10: Polish, Performance & Telemetry
...
```

**NEW:**
```
## Epic List
...
### Epic 7: Ability & Environmental VFX Prototyping
Every shipped ability (16 across the 4 alpha classes) and the Grassland boss's attacks get a distinct, shape/particle-based visual identity — replacing today's undifferentiated flat-color circles — before any final pixel art is integrated. Status effects, projectiles, zones, boss charge telegraphs, and existing environmental effects (purification pulse, bond tethers) are brought to a consistent prototype-quality bar.
**FRs covered:** none new — visual-groundwork epic, scoped from direct user observation of the shipped combat systems (Epics 3, 3 Extension, 6). Precedes final art production per the GDD's Art Direction section (PixelLab MCP, no references yet).

### Epic 8: Progression & Persistent Meta
[unchanged content, renumbered from Epic 7]

### Epic 9: Full Class Roster
[unchanged content, renumbered from Epic 8]

### Epic 10: Ancient Forest Biome
[unchanged content, renumbered from Epic 9]

### Epic 11: Polish, Performance & Telemetry
[unchanged content, renumbered from Epic 10]
```

**Rationale:** Epics 7–10 have no stories yet — renumbering touches only the overview section and the FR Coverage Map (below), nothing implemented.

### `epics.md` — FR Coverage Map (renumber references)

| FR | OLD | NEW |
|---|---|---|
| FR3 | E1 (guest), E7 (complete) | E1 (guest), **E8** (complete) |
| FR4 | E7 | **E8** |
| FR11 | E3 (4 classes), E8 (all 10) | E3 (4 classes), **E9** (all 10) |
| FR23 | E3 (collection), E7 (persistence) | E3 (collection), **E8** (persistence) |
| FR24 | E6 (reward reveal), E7 (persistence) | E6 (reward reveal), **E8** (persistence) |
| FR25 | E7 | **E8** |
| FR26 | E7 | **E8** |
| FR29 | E4, E10 | E4, **E11** |
| FR34 | E4 (Grassland), E9 (+ Forest) | E4 (Grassland), **E10** (+ Forest) |
| FR35 | E6 (Grassland), E9 (Forest) | E6 (Grassland), **E10** (Forest) |

### New Epic 7 — Story Breakdown

Sequenced so 7.1 (shared engine) lands first; 7.2–7.8 have no inter-dependencies on each other, same pattern as the Epic 3 Extension's engine-first sequencing.

**Story 7.1 — VFX Engine Foundations**
- Owner: Host Experience Engineer
- Change: add reusable PixiJS effect primitives to `packages/ui-kit` (or a new `apps/host-client/src/vfx/` module) — particle burst, trail, ring/shockwave, beam, tint-pulse — each parameterized by color/size/duration so per-ability stories only supply parameters, not bespoke `Graphics` code. Every later story in this epic consumes this, none of them depend on each other.

**Story 7.2 — Stonehide Ability VFX**
- Owner: Host Experience Engineer
- Change: distinct visuals for Stone Wall (RELEASE), Tremor Stomp (TAP), Iron Skin (TAP), Avalanche (AUTO) — replacing the shared flat-circle/flash treatment with shape/particle identity per ability, driven by the existing per-ability delta data.

**Story 7.3 — Spiritcaller Ability VFX**
- Owner: Host Experience Engineer
- Change: distinct visuals for Ancestor's Voice (AUTO), Spirit Nova (TAP), Soul Mend (AIM_CAST), Warding Cry (TAP).

**Story 7.4 — Souldrinker Ability VFX**
- Owner: Host Experience Engineer
- Change: distinct visuals for Blood Spike (AUTO), Crimson Lash (RELEASE), Dark Pact (RELEASE), Void Pulse (RELEASE) — including Blood Spike's lifesteal visual feedback.

**Story 7.5 — Stormcaller Ability VFX**
- Owner: Host Experience Engineer
- Change: distinct visuals for Lightning Arc (AUTO), Tempest Hurl (RELEASE), Thunder Clap (TAP), Storm Eye (RELEASE).

**Story 7.6 — Status Effect VFX**
- Owner: Host Experience Engineer
- Change: `DungeonScreen.tsx:258-288`'s single generic badge (color-differentiated only) becomes four distinct auras/overlays for `damageReduction`, `slow`, `damageBuff`, `shield` — reusing the Story 7.1 primitives instead of one more bespoke `Graphics` shape.

**Story 7.7 — Grassland Boss Attack VFX & Charge Telegraph**
- Owner: Host Experience Engineer
- Change: two parts. (1) Add `boss:charged` to the transient-delta whitelist in `host-session.ts:50-63` and give it a dedicated telegraph visual — currently zero visual signal reaches the host for this attack. (2) Reskin the existing `boss:stomped`/`boss:phaseChanged`/`boss:damaged` reactions (already functional since `dev-5-boss-transient-delta-whitelist-fix`) using the Story 7.1 primitives for visual consistency with the rest of the epic.

**Story 7.8 — Environmental & Bond VFX Polish**
- Owner: Host Experience Engineer
- Change: replace the single hardcoded projectile circle (`DungeonScreen.tsx:308`) and single hardcoded zone circle (`DungeonScreen.tsx:329`) with rendering driven by each `ProjectileState`/`ZoneState`'s existing `class`/`abilityIndex` fields (added in Story 3.13), so 7.2–7.5's per-ability visuals actually reach the projectile/zone layer instead of being overridden by the shared fallback shape. Also passes the purification pulse (Story 6.4) and bond tethers (Story 5.5) through a light consistency pass against the new visual language — no behavior change, no new mechanic.

**Non-goals for this epic:** no final pixel-art sprites (that's the separate PixelLab-driven art pass the GDD already scopes), no new abilities or mechanics, no protocol/schema changes beyond the one-line `boss:charged` whitelist fix.

---

## 5. PRD/MVP Impact

None. No FR/NFR is added, changed, or removed. No MVP goal is reduced or reordered — this is additive polish work sequenced ahead of Epics 8–10 (new content) rather than a scope change to any of them.

---

## 6. Implementation Handoff

| Scope | Items | Route to |
|---|---|---|
| **Moderate** (new epic insertion, single ownership area, no reopen of shipped epics) | Epic 7 (7.1–7.8), `epics.md` renumbering, `sprint-status.yaml` update | Host Experience Engineer — stories go through the normal `create-story` → `dev-story` → `code-review` cycle already used for every other epic in this project |

**Success criteria:** each of 7.1–7.8 ships through the standard cycle; Epic 7 status flips to `done` in `sprint-status.yaml` once complete, same pattern as Epics 1–6. Epics 8–10 (post-renumber) remain `backlog` and unaffected until their own sprint planning begins.
