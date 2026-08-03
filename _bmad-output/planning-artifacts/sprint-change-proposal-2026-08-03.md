# Sprint Change Proposal — 2026-08-03

**Trigger:** User-authored `TODO.md` notes ("extras", "controller", "VFX" sections), worked through via `gds-correct-course`.

---

## 1. Issue Summary

Five independent gaps/issues the user noted while playing the current build, none of them new PRD/GDD requirements — all either close a spec/implementation gap between already-shipped stories, or scope a small piece of net-new UX polish.

1. **No way to voluntarily leave a run.** `session.phase` (`packages/shared-types/src/session.ts:9`) only transitions `'dungeon'` → `'hub'` via `run:complete` (victory) or full-party defeat. There is no path for a party to bail out of a run they no longer want to finish.
2. **A redundant, never-removed hub POI.** Story 2.8 already removed the training-dummy POI's ability-use gate (abilities work everywhere in the hub now), but explicitly deferred removing the POI itself. It's still on the map, visually and mechanically inert.
3. **Ability VFX invisible in the hub.** Casting an ability in the hub produces no visual effect, even though the exact same ability delta plays a full VFX sequence in a dungeon run.
4. **A UI overflow bug.** The "Pick Selected Class" confirm button (Story 2.2) clips its own label instead of wrapping it.
5. **No aim/destination preview.** Abilities that require aiming give the player no visual feedback about where the ability will land before they commit to firing — most acutely for zone-placement abilities (Storm Eye, Stone Wall, Dark Pact, Crimson Lash), where the player can't see the destination until after release.

Each was verified against the current shipped code before scoping (not assumed from the TODO.md wording alone) — see Impact Analysis below for the specific evidence per item.

---

## 2. Impact Analysis

### Epic Impact

- **Epic 2 (Hub World & Class Selection)** — was `done`, reopened. Two small, unrelated stories: **2.10** (remove the training-dummy POI, closing what 2.8 deferred) and **2.11** (class-pick button text-overflow fix). No dependency between them.
- **Epic 4 (Procedural Dungeon & Full Run Structure)** — was `done`, reopened. New "Abandon-Run Vote" correction, split by ownership: **4.15a** (Protocol Architect — contract), **4.15b** (Simulation Engineer — vote resolution + phase transition), **4.15c** (Mobile Controller Engineer — button + vote UI). Sequenced a → {b, c}.
- **Epic 7 (Ability & Environmental VFX)** — already `in-progress`. Two unrelated corrections: **7.14** (hub-screen VFX wiring, single-owner Host Experience Engineer) and **7.15a-d** (aim/destination preview, split by ownership: 7.15a contract → {7.15b sim, 7.15c host render, 7.15d mobile send}).
- No other epic affected. MVP scope, GDD, and architecture pillars are unaffected in substance.

### Artifact Conflicts

| Artifact | Impact |
|---|---|
| GDD | None — all five items are below the GDD's altitude (UI polish, contract-fill for existing systems). |
| Architecture (`game-architecture.md`) | None directly; two new ADRs extend existing precedent (see below). |
| `epics.md` | Updated — "Epic 2 Correction: Hub POI Cleanup & Class-Pick Button Fit" (2.10, 2.11), "Epic 4 Correction: Abandon-Run Vote" (4.15a/b/c), "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview" (7.14, 7.15a-d) — full AC text already written into the file. |
| `docs/adr/` | Two new ADRs: `ADR-0007-abandon-run-vote-contract.md` (parallels the existing run-start vote precedent), `ADR-0008-aim-preview-contract.md` (extends ADR-0003's ability-presentation contract to a pre-fire aiming state). |
| UX Design | None of the four named zone-preview abilities' mobile input mapping changes — the 2×2 skill-cell grid and RELEASE/AUTO/TAP/AIM_CAST interaction types are unchanged. |
| Tests | New coverage needed: `run:abandoned` contract round-trip + unanimous/decline/disconnect resolution tests (4.15a/b); `ability:aim-preview` contract round-trip + per-ability preview-target-matches-real-placement tests (7.15a/b); no test changes needed for 2.10/2.11/7.14 beyond confirming no regression. |

### Technical Impact

- **Contract-change hook triggered twice** — 4.15a touches `packages/shared-types` (new `abandonProposal` field) and `packages/net-protocol` (new `run:abandon-propose`/`run:abandon-vote`/`run:abandoned` messages); 7.15a touches `packages/shared-types` (new `InputEvent` variant) and `packages/net-protocol` (new `ability:aim-preview` delta). Both require Protocol Architect review, a compatibility note (additive-only in both cases), and the contract tests named in their own acceptance criteria. Story 2.10 also technically touches `packages/shared-types` (removing a POI entry/enum value) — flagged for a fast-path review since it's pure data removal, not a shape change.
- **Simulation-safety hook triggered twice** — 4.15b (`apps/simulation-server`) and 7.15b (`apps/simulation-server`, plus reuse of existing `packages/game-rules` placement math, no duplication). Both require typecheck, unit tests, a deterministic-tick test (7.15b's preview delta is explicitly presentation-only and non-mutating, but still gets a perf sanity check per the hook), and a perf sanity check.
- **Client-UX hook triggered** for 2.11 (mobile), 4.15c (mobile), 7.14 (host), 7.15c (host), 7.15d (mobile) — standard joystick/skill mapping, reconnect-UX, and couch-readability checks apply as usual; nothing here changes reconnect or session-lifecycle behavior.
- No session-lifecycle, room-state, or join-flow surface is touched by any of the five items.

---

## 3. Recommended Approach

**Selected: Direct Adjustment (Option 1)** — new stories within the existing epic structure (reopening 2 and 4, extending 7), no rollback, no MVP/PRD scope change.

- **Effort:** Medium overall, uneven per item. 2.10/2.11/7.14 are each small (data removal + render cleanup, CSS fix, VFX-wiring extraction respectively). 4.15a-c and 7.15a-d are each a real (if contained) new contract, split across all three engineering roles per `CLAUDE.md`'s ownership rule.
- **Risk:** Low for 2.10/2.11. Low-to-medium for 7.14 (a refactor touching `DungeonScreen.tsx`'s VFX wiring, but behaviorally inert by design — no regression should be observable). Medium for 4.15a-c and 7.15a-d — both are genuine new wire contracts, which is why each was split into single-owner stories with its own explicit hook requirements rather than one cross-boundary story.
- **Rollback (Option 2) was not viable/needed** — nothing here is broken or blocking; these are gap-fills and small new features, not fixes for a defect that demands reverting prior work.
- **MVP/PRD review (Option 3) was not needed** — no GDD/PRD goal, pillar, or platform requirement is affected. All five items stay within "hub polish" and "ability presentation," layers the GDD delegates to per-story detail.

Two design decisions were made explicitly by the user during this review, not inferred:
- Abandon-run requires a **unanimous vote** (reusing the existing `run:propose`/`run:vote` shape), not a single-tap unilateral exit.
- Abandon-run is allowed **at any point**, including during an active boss encounter — no phase gate.

---

## 4. Detailed Change Proposals

All five items were reviewed and approved incrementally with the user before this document was compiled. Full technical detail for each lives in `epics.md`'s new correction sections; summarized here for the record:

1. **Story 2.10 — Remove Training-Dummy POI.** Data removal (`packages/shared-types/src/poi.ts`'s `training-dummy` entry + `PoiType.TRAINING_DUMMY`) + host render cleanup (`HubWorldScreen.tsx`). No sim code change — `GameRoom.ts` iterates the shared array generically.
2. **Story 2.11 — Class-Pick Button Fit.** CSS-only: wrap the confirm button's label instead of clipping it (`ControllerScreen.tsx:456-497`).
3. **Story 4.15a — Abandon-Run Vote Contract.** New `run:abandon-propose`/`run:abandon-vote`/`run:abandoned` messages + `abandonProposal` state slot. ADR-0007.
4. **Story 4.15b — Abandon-Run Resolution.** `GameRoom.ts` vote tracking + unconditional (no boss-phase gate) resolution to `session.phase = 'hub'`.
5. **Story 4.15c — Leave-Run Button & Vote UI.** Mobile "Leave Run" button + reused `VotePopup` accept/decline pattern.
6. **Story 7.14 — Hub-Screen VFX Wiring.** Extract `DungeonScreen.tsx`'s VFX engine wiring into a shared hook both screens call; boss-specific VFX stays Dungeon-only (no boss in the hub).
7. **Story 7.15a — Aim-Preview Contract.** New `InputEvent` variant `'aim-preview'` + `ability:aim-preview` broadcast delta, presentation-only. ADR-0008 (extends ADR-0003).
8. **Story 7.15b — Aim-Preview Resolution.** Sim computes preview target reusing existing real-cast placement math (never duplicated); `AUTO`/`AIM_CAST` abilities source the broadcast from their existing continuous-fire input, no new client signal needed for those.
9. **Story 7.15c — Render Aim Arrow & Destination Preview.** Host renders a translucent direction arrow + a ghosted zone/cone/circle preview for the four named abilities, reusing the 7.13 cone/wedge primitive.
10. **Story 7.15d — Mobile Drag-Preview Sending.** Phone sends throttled `input:aim-preview` during a `RELEASE`-type ability's drag phase only.

Plus:
- **ADR-0007** written — abandon-run vote contract, parallel to the existing run-start vote precedent.
- **ADR-0008** written — aim-preview contract, extending ADR-0003's ability-presentation contract to a pre-fire aiming state.
- **`epics.md`** updated with three new correction sections (see Impact Analysis above).
- **`TODO.md`** trimmed to remove the now-actioned "extras"/"controller"/"VFX" sections, matching the 2026-07-28 precedent.

---

## 5. Implementation Handoff

**Scope classification: Moderate.** Not Minor (four of the ten new stories touch a contract surface — `shared-types`/`net-protocol` — requiring Protocol Architect sign-off, not just direct Developer-agent patches). Not Major (no PM/Architect-level replan, no PRD/GDD change, no epic resequencing beyond reopening two already-`done` epics, which this project has done routinely).

**Handoff:**
- **Protocol Architect** — review and sign off on Story 4.15a (`run:abandon-*` messages, `abandonProposal` field, ADR-0007) and Story 7.15a (`InputEvent` `'aim-preview'` variant, `ability:aim-preview` delta, ADR-0008) before their dependent stories (4.15b/c, 7.15b/c/d) proceed. Also a fast-path glance at Story 2.10's `poi.ts` data removal.
- **Simulation Engineer** — implement Story 4.15b (`GameRoom.ts` abandon-vote resolution, unconditional phase transition) and Story 7.15b (preview-target computation reusing existing placement math, throttled broadcast). Owns the Simulation-safety hook for both (typecheck, unit tests, deterministic-tick test, perf sanity check).
- **Host Experience Engineer** — implement Story 2.10's render cleanup, Story 7.14 (hub VFX wiring extraction), and Story 7.15c (aim arrow + destination preview rendering).
- **Mobile Controller Engineer** — implement Story 2.11 (button CSS fix), Story 4.15c (Leave-Run button + vote UI), and Story 7.15d (drag-preview sending for `RELEASE`-type abilities).
- **Orchestrator** — sequence 4.15a before 4.15b/4.15c, and 7.15a before 7.15b/7.15c/7.15d; 2.10, 2.11, and 7.14 have no cross-story dependencies and can proceed independently.

**Success criteria:** All ten new stories' acceptance criteria (as written in `epics.md`) pass; new contract/unit tests green (`run:abandoned` round-trip + vote-resolution tests, `ability:aim-preview` round-trip + preview-matches-real-placement tests); Protocol Architect sign-off recorded for 4.15a and 7.15a; no regression in existing Epic 2/4/7 acceptance criteria, in particular Story 2.8 (hub ability-use gate) and Epic 7's Stories 7.1-7.13 (VFX behavior in `DungeonScreen.tsx` unchanged after the 7.14 extraction).

---

## Documents produced/modified by this proposal

- `docs/adr/ADR-0007-abandon-run-vote-contract.md` (new)
- `docs/adr/ADR-0008-aim-preview-contract.md` (new)
- `_bmad-output/planning-artifacts/epics.md` (new sections: "Epic 2 Correction: Hub POI Cleanup & Class-Pick Button Fit" [2.10, 2.11], "Epic 4 Correction: Abandon-Run Vote" [4.15a/b/c], "Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview" [7.14, 7.15a-d])
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (epic-2 and epic-4 reopened to `in-progress`; 8 new story entries added at `backlog`)
- `TODO.md` (trimmed — see below)
- This document
