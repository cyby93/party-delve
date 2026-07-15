# Sprint Change Proposal — TODO.md Backlog Triage

**Date:** 2026-07-14
**Trigger:** User-maintained `TODO.md` (known issues / missing features / features not working as intended) — not a specific story's code review, an ad hoc backlog accumulated outside the sprint cycle.
**Mode:** Batch
**Prepared by:** Correct Course workflow

---

## 1. Issue Summary

`TODO.md` contains 9 actionable items (a 10th — placeholder VFX — is excluded, see §6) spanning controller UX, host rendering, and simulation logic. None were captured as stories during planning. Grounding each item against the current codebase surfaced three categories:

1. **Regressions against already-approved, already-"done" epic acceptance criteria** (boss never takes damage, despite Epic 6's AC requiring it; hub ability gate is *working as originally specified* in Story 2.4, but the spec itself is now wrong).
2. **Straightforward net-new asks** with no architecture conflict (rotation lock, fullscreen, vote button state, HP restore, debug mode, regular-enemy damage numbers).
3. **One genuine architecture conflict**: the body/spirit split contradicts the single-entity design already shipped in Stories 3.5, 3.6, and 3.18.

No item invalidates the PRD/GDD's MVP goals or requires a rollback of completed work.

---

## 2. Impact Analysis

### Epic Impact

| Epic | Current status | Impact |
|---|---|---|
| Epic 2 (Hub World & Class Selection) | `done` | **Reopen.** Story 2.4's AC explicitly scoped ability use to the training-dummy POI — that's not a bug, it's a spec that needs to change now that the trainer POI is being repurposed. |
| Epic 3 (Core Combat) | `in-progress` (3.19/3.20 still `ready-for-dev`) | No reopen needed. Append one new story addressing the body/spirit split — see §4. |
| Epic 4 (Procedural Dungeon) | `done` | **Reopen.** Two independent gaps: no HP restore on level transition (new ask, no prior AC), no vote-button submitted state (new ask, no prior AC). |
| Epic 6 (Grassland Boss) | `done` | **Reopen.** Story 6.1/6.3's AC required `BossDamagedDelta` emission and in-canvas damage numbers — both exist in the protocol/host code but are **dead code**, because every hit-resolution loop in `GameRoom.ts` only iterates `gameState.enemies`, never `gameState.boss`. This is a shipped regression, not new scope. |
| No-epic dev bucket | — | Rotation lock, fullscreen toggle, and debug god-mode don't extend any specific epic's approved scope — same category as the existing `dev-1-mobile-controller-network-binding` entry. |

No future backlog epics (7–10) are affected or invalidated.

### Artifact Conflicts

- **GDD/PRD:** No conflict. All items are consistent with existing pillars; none change MVP scope.
- **Architecture (`game-architecture.md`):** Conflict on one point only — `PlayerState` (line ~502, ~769) models a single `x/y` per player. The body/spirit split requires this to become two tracked positions. Needs an architecture update + ADR, not just a story.
- **UX/UI specs:** No conflict found for any item (all are additive UI states — button pressed state, fullscreen button, floating numbers — none contradict existing UX-designs artifacts).
- **Net-protocol:** `boss:damaged` already exists and needs no schema change (§4, Epic 6 items). The body/spirit split needs a new or extended delta shape (contract-change hook triggers per CLAUDE.md).

---

## 3. Recommended Approach

**Option 1 — Direct Adjustment**, for all 9 items. New/corrected stories are added within the existing epic structure (reopening Epic 2, 4, 6 per the project's own established precedent — this has been done 6 times already for epics 1, 2, 3, 5). No rollback, no MVP/PRD scope reduction.

- Effort: Low for 8 of 9 items (single-owner, isolated). Medium for the body/spirit split (contract-change, 3 ownership areas, touches 3 already-shipped stories).
- Risk: Low for 8 items. Medium for the body/spirit split — it changes behavior Soul Mend (3.18, shipped one day ago) depends on, so sequencing matters.

No item justifies Option 2 (rollback) or Option 3 (MVP review) — nothing here reduces scope or reverts prior work.

---

## 4. Detailed Change Proposals

### Epic 2 — reopen to `in-progress`

**New Story 2.8 — Hub Ability Use Outside Training-Dummy POI**
- Owner: Simulation Engineer
- Change: `GameRoom.ts:1701-1703` currently guards `if (!inDungeon && !atTrainingDummy) continue;` before processing ability input. Remove the `atTrainingDummy` requirement — abilities process anywhere in the hub, same as in dungeons.
- Epics.md correction: Story 2.4's AC ("abilities fire near the training dummy POI") is superseded — add a note that ability activation is no longer POI-gated; training-dummy POI visuals/interact-button/targetability are unchanged and reserved for future repurposing (per user's stated intent — POI itself stays, only the ability gate is removed).
- Non-goals: redesigning what the training-dummy POI becomes next — out of scope here.

### Epic 3 — append (no reopen, already `in-progress`)

**New Story 3.21 — Downed Player Body/Spirit Entity Split**
- This is the one Major item. Recommend splitting across ownership per CLAUDE.md's "split unless strong reason not to":
  - **3.21a (Protocol Architect):** Extend `PlayerState` (`packages/shared-types/src/player.ts`) with a fixed `bodyX`/`bodyY` (set once at down-time) alongside the existing `x`/`y`, which becomes spirit-only once `isSpirit` is true. Update `player:downed`/`player:revived` delta shapes in `packages/net-protocol`. Requires an ADR update (`docs/adr/**`) and at least one new contract test — contract-change hook.
  - **3.21b (Simulation Engineer):** While `isDown` (pre-timer-expiry), freeze at the down position as today. On `isSpirit` transition, stop moving the same `x/y` and instead let the spirit move independently; revive proximity check (`GameRoom.ts:2255-2266`) targets `bodyX/bodyY`, not the moving spirit. Verify Soul Mend (Story 3.18) still resolves correctly against the (now-separate) spirit position — this is the story most likely to regress 3.18, call it out explicitly in Dev Notes.
  - **3.21c (Host Experience Engineer):** Render two in-canvas entities per downed player — the stationary body sprite and the mobile spirit sprite — replacing the current single dimmed-figure rendering from Story 3.6.
- Sequencing: 3.21a → 3.21b → 3.21c, same pattern as the 3.11→3.16 shared-capability sequencing already used in this epic's extension.

### Epic 4 — reopen to `in-progress`

**New Story 4.12 — Full HP Restore on Level Transition**
- Owner: Simulation Engineer
- Change: `loadLevel()` (`GameRoom.ts:931+`) currently only revives `isDown`/`isSpirit` players to `REVIVE_HP` (:984-993); alive-but-damaged players carry HP over unchanged. Extend to reset every player's `hp` to `maxHp` on level load, not just downed ones.

**New Story 4.13 — Vote-Accept Button Submitted State**
- Owner: Mobile Controller Engineer
- Change: `VotePopup` (`ControllerScreen.tsx:565-594`) has no local pending/submitted state after `onAccept()` fires. Add a disabled/"waiting" visual immediately on tap, cleared when `gameState.runProposal` resolves or clears.

### Epic 6 — reopen to `in-progress`

**New Story 6.7 — Boss Combat Resolution Wiring**
- Owner: Simulation Engineer
- Change: every hit-resolution loop in `GameRoom.ts` (melee :1837/:1845, ability :1898/:1901, nova AoE :1971/:1991, legacy path :1392) iterates only `gameState.enemies`. Include `gameState.boss` in target resolution, apply damage via the existing `applyDamage()` (`combat.ts:15`), and emit the already-defined `boss:damaged` delta (currently never emitted). No protocol changes needed — the contract already exists end-to-end.

**New Story 6.8 — Floating Damage Numbers for Regular Enemies**
- Owner: Host Experience Engineer
- Change: `DungeonScreen.tsx` has a working boss damage-number pattern (:503-508, currently unreachable until 6.7 ships) but zero damage-number rendering on `enemy:damaged` deltas — only `enemy:killed` triggers a fade. Extend the existing boss pattern to regular enemies.

### No-epic dev bucket (precedent: `dev-1-mobile-controller-network-binding`)

**dev-2 — Controller Rotation Lock Enforcement** (Mobile Controller Engineer): enforce landscape orientation after session join; block/prompt in portrait.
**dev-3 — Controller Fullscreen Toggle** (Mobile Controller Engineer): auto-fullscreen on join + header toggle button, using the Fullscreen API.
**dev-4 — Debug Invincible/High-Damage Mode** (Simulation Engineer): extends the existing `NODE_ENV`-gated `debug:kill-boss`/`debug:kill-all` pattern (`GameRoom.ts:329-351`) with a toggle that zeroes incoming damage and multiplies outgoing damage for the toggling player.

---

## 5. PRD/MVP Impact

None. No MVP goal is affected, reduced, or reordered. All changes are corrections or additions within already-planned epics.

---

## 6. Excluded Item — Needs Clarification

**"Placeholder VFX for abilities before the last four epics"** — the TODO.md entry is an incomplete sentence and doesn't specify which abilities, or which VFX are missing vs. merely placeholder-quality. Epics 7–10 also have no stories defined yet ("Stories: not yet defined"), so scoping this against "the last four epics" isn't possible yet. Recommend the user complete this note before it's triaged — not included in this proposal.

---

## 7. Implementation Handoff

| Scope | Items | Route to |
|---|---|---|
| **Minor** (single-owner, no epic reopen ceremony beyond a status flip) | dev-2, dev-3, dev-4, 4.13, 6.8 | Developer agent — direct implementation via `create-story` → `dev-story` |
| **Moderate** (epic reopen + epics.md correction, single owner) | 2.8, 4.12, 6.7 | Product Owner/Developer — epics.md gets the story added, then normal dev-story cycle |
| **Major** (contract-change hook, 3 ownership areas, touches shipped stories 3.5/3.6/3.18) | 3.21a/b/c | Protocol Architect leads 3.21a (schema + ADR); Simulation Engineer and Host Experience Engineer follow in sequence |

**Success criteria:** each new story ships through the normal `create-story` → `dev-story` → `code-review` cycle already in use on this project; Epic 2/4/6 flip back to `done` once their new stories complete, same as the epic-1/2/3/5 reopen-and-close pattern already established.
