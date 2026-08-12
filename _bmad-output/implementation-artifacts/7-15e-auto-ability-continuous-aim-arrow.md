---
baseline_commit: f5b9748
---

# Story 7.15e: Continuous Aim Arrow for AUTO Abilities

Status: done

## CLAUDE.md Required Task Header

```
Phase: E7 — Ability & Environmental VFX Prototyping. Follow-up refinement to
  Stories 7.15c/7.15d, both at `review`. Requested directly by the user
  (2026-08-06) after the 7.15b/7.15c implementation notes flagged the underlying
  behaviour as a known limitation.

Context: Stories 7.15b and 7.15c both recorded, as an outstanding concern, that
  ADR-0008's premise about `AUTO` abilities is wrong. The ADR assumed those
  abilities "already stream a live direction every ~33ms via their existing
  continuous-fire input". They do not: the cooldown-sync fix of 2026-07-25 added
  `if (isOnCooldownRef.current) return;` to `SkillCell`'s auto-interval, so an
  `AUTO` ability sends input only when it is actually off cooldown — roughly once
  per cooldown period (1000ms for Lightning Arc / Blood Spike / Avalanche,
  1500ms for Ancestor's Voice), not 30×/second.

  Consequence the user observed in play: the aim arrow appears at the moment of
  each cast and is then cleared ~150ms later by the host's staleness window, so
  it blinks at the cooldown cadence instead of tracking the thumb. That is
  backwards for this input type — `AUTO` abilities are *held*, have short
  cooldowns, and the player is continuously aiming the NEXT shot. The arrow is
  most useful precisely during the cooldown gap.

  Two independent causes, one on each surface, and fixing either alone does
  nothing:
    1. The phone sends nothing at all during the cooldown gap, so the sim has
       nothing to broadcast.
    2. Even when a preview does arrive, the host clears it on `ability:fired` —
       a rule written for `RELEASE` abilities, where firing genuinely means the
       thumb lifted.

Owner: split by surface — Mobile Controller Engineer (part 1) and Host
  Experience Engineer (part 2).

  **Cross-context note (CLAUDE.md Ownership hook):** this story touches
  `apps/mobile-controller/**` and `apps/host-client/**`. Normally that requires
  a split. It is deliberately kept as one story because the two halves are a
  single behavioural rule that is meaningless apart — sending previews during
  cooldown achieves nothing while the host clears them on fire, and keeping them
  on the host achieves nothing while the phone sends nothing. The change is two
  small, independently-tested edits, and the user requested the behaviour
  directly. Recorded here rather than assumed.

Goal: While an `AUTO` ability is held, keep the host's aim arrow continuously
  visible — including through the cooldown gap between casts.

Allowed paths:
  - apps/mobile-controller/**   (part 1)
  - apps/host-client/**         (part 2)
  - tests/**                    (this story's coverage)

Blocked paths:
  - apps/simulation-server/**   (no sim change needed — verified, see Dev Notes)
  - packages/shared-types/**
  - packages/net-protocol/**
  - packages/game-rules/**

Non-goals:
  - NO contract change. This reuses the `input:aim-preview` event and the
    `ability:aim-preview` delta exactly as Story 7.15a defined them.
  - NO sim change. `broadcastAimPreviews` already handles a preview for an
    `AUTO` ability correctly (direction-only, no target) — confirmed by test.
  - NO change to when an ability actually fires, or to the cooldown-sync fix's
    anti-flood guarantee.
  - NO change for `RELEASE` abilities: firing still clears their preview
    immediately, which is correct because the thumb has lifted.

Required hooks:
  - **Client-UX hook (TRIGGERED)** — both mobile input and host rendering
    changed. No device or display in this sandbox; the manual pass is disclosed
    as outstanding, matching 7.15c/7.15d.
  - Contract-change / Simulation-safety hooks: NOT triggered.
  - Ownership hook: TRIGGERED and dispositioned above (single cross-surface
    story, user-requested, rationale recorded).

Telemetry impact: None — cosmetic.
```

---

## Story

As a player holding an `AUTO` ability,
I want the aim arrow to stay visible while I hold it, not just flash at each cast,
so that I can line up where the next shot will go during the cooldown.

---

## Acceptance Criteria

**AC1 — the phone keeps reporting the aim during an AUTO cooldown:**
**Given** an `AUTO` ability is held and is currently on cooldown, so its cast input is suppressed by the cooldown-sync fix
**When** the hold continues
**Then** the phone sends `input:aim-preview` on the same interval instead of the suppressed cast — one message per interval, exactly as before, never both
**And** the anti-flood property of the cooldown-sync fix is preserved, because the sim never casts from an aim-preview

**AC2 — a zero aim still sends nothing:**
**Given** a held `AUTO` ability whose drag has not left the deadzone
**When** the interval fires, on or off cooldown
**Then** nothing is sent — the existing zero-aim skip now gates the preview as well as the cast, since there is no aim to show either way

**AC3 — `AIM_CAST` is unaffected:**
**Given** Soul Mend, the only `AIM_CAST` ability
**When** it is held
**Then** its behaviour is unchanged — it channels with no cooldown, so it never reaches the new branch and continues to send real cast inputs at the same cadence

**AC4 — the host stops clearing held-ability previews on fire:**
**Given** an `ability:fired` delta
**When** the fired ability's `inputType` is `AUTO` or `AIM_CAST`
**Then** the aim preview is **not** cleared — the player is still holding, and the staleness window remains the correct terminator for when they let go
**And** for `RELEASE` and `TAP` abilities the preview is still cleared immediately, unchanged from Story 7.15c

**AC5 — an unresolvable caster clears:**
**Given** an `ability:fired` naming a player not present in mirror state (late-join / reconnect race)
**When** it is dispatched
**Then** the preview is cleared — a stale arrow is worse than a missing one

**AC6 — no arrow blink across a repeated cast:**
**Given** an `AUTO` ability held across several cast/cooldown cycles
**When** each cast fires
**Then** the preview entry survives continuously, never toggling off and back on

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2, #3) — `ControllerScreen.tsx`: in `SkillCell`'s `AUTO`/`AIM_CAST` interval, hoist the zero-aim skip above the cooldown check (it disqualifies both paths), then send `onAimPreview` instead of returning when on cooldown.
- [x] **Task 2** (AC: #4, #5) — `ability-vfx-dispatch.ts`: resolve the fired ability's `inputType` from the caster's class and only clear `refs.aimPreviews` for non-held types.
- [x] **Task 3** (AC: #4, #5, #6) — Unit tests for the clearing rule across `AUTO` / `RELEASE` / `AIM_CAST` / `TAP` / unresolvable-caster, plus a repeated-cast loop.
- [x] **Task 4** (AC: #1) — e2e test that a held `AUTO` ability's previews are accepted and answered during a real cooldown, direction-only.
- [x] **Task 5** — Full regression: `npm run typecheck`, `npm test`, lint.

---

## Dev Notes

### Why the fix is on the aim-preview channel rather than relaxing the cooldown skip

The obvious-looking alternative — let the `AUTO` interval keep sending cast inputs during cooldown — is exactly what the 2026-07-25 cooldown-sync fix removed. That flooded the socket at ~30/s while the server rejected all but one per cooldown, producing the "fires 3-4× then stalls" symptom. Re-introducing it to get an arrow would trade a visual nicety for a networking regression.

The `input:aim-preview` event already exists for precisely this shape of signal: presentation-only, throttled, never casts, never mutates state. Sending it in place of the suppressed cast costs the same one message per interval that this branch already budgeted for, and it structurally cannot re-flood, because the sim's aim-preview path has no cast in it.

### No sim change was needed, and that was verified rather than assumed

`broadcastAimPreviews` was written to handle previews from any ability type. For an `AUTO` ability it passes the eligibility guard, skips the `TAP` check, is not caught by the `RELEASE`-fired suppression, and computes `showsTarget = inputType === 'RELEASE' && delivery !== 'projectile'` → `false`, so it emits a direction-only preview. That is exactly right: an `AUTO` ability's landing point is not knowable while aiming (Lightning Arc's real target is a corridor-gathered nearest enemy), so it gets an arrow and no destination ghost. Confirmed by the new e2e test rather than by reading alone.

### Why the host also had to change

The `RELEASE`-fired suppression added during code review means the sim does not double-broadcast for `RELEASE`. `AUTO` is deliberately excluded from that suppression — the cast *is* the moment the aim refreshes for those abilities. But the host was still deleting the preview on `ability:fired` unconditionally.

That delete is not harmless even though a preview usually follows in the same tick: each delta arrives as its own WebSocket message and therefore its own dispatch pass, so the re-inserting `ability:aim-preview` lands a frame after the delete. At a 1000ms cooldown that is a one-frame arrow drop-out per second — subtle, but exactly the kind of flicker the user is asking to remove. Gating the delete on input type removes the round-trip entirely rather than racing it.

### Testing note

The host-side rule is unit-testable without PixiJS by passing `engine: null`, which routes every branch to the legacy `onCastFlash` fallback while still exercising the preview bookkeeping. Both new test files were verified the right way — by reverting each fix and confirming the relevant tests fail (3 unit tests fail without the host change), not merely by watching them pass.

### References

- [Source: `apps/mobile-controller/src/screens/ControllerScreen.tsx`] — `SkillCell`'s `AUTO`/`AIM_CAST` interval and the 2026-07-25 cooldown-sync comment.
- [Source: `apps/host-client/src/vfx/ability-vfx-dispatch.ts`] — the `ability:fired` preview-clearing rule.
- [Source: `apps/host-client/src/vfx/aim-preview.ts`] — `AIM_PREVIEW_STALE_MS`, the terminator that now covers held abilities.
- [Source: `apps/simulation-server/src/rooms/GameRoom.ts`] — `broadcastAimPreviews`; unchanged, verified compatible.
- [Source: `docs/adr/ADR-0008-aim-preview-contract.md`] — the "AUTO already streams at 33ms" premise this story corrects in practice.
- [Source: `_bmad-output/implementation-artifacts/7-15b-aim-preview-resolution.md`] — where the `AUTO` cadence finding was first recorded.
- [Source: `_bmad-output/implementation-artifacts/7-15c-render-aim-arrow-and-destination-preview.md`] — AC4, refined here.

## Dev Agent Record

### Agent Model Used

Claude Opus 5 (claude-opus-5)

### Debug Log References

- No implementation failures. Typecheck clean on the first run after adding the `CLASS_DEFINITIONS` import to the dispatcher.
- Both fixes were negative-tested: reverting the host change fails 3 of the 6 new unit tests (`KEEPS the preview when an AUTO ability fires`, `KEEPS … for an AIM_CAST ability`, `a repeated AUTO cast keeps refreshing`); the e2e test passes against the unchanged sim, confirming no sim work was required.

### Completion Notes List

- **Part 1 (mobile):** the zero-aim skip moved above the cooldown check — it disqualifies the preview as much as the cast — and the cooldown branch now sends `onAimPreview` instead of returning. Net message rate is unchanged: still exactly one send per interval while held, just a cheaper message during the gap.
- **Part 2 (host):** `ability:fired` resolves the fired ability's `inputType` from the caster's class and clears the preview only for non-held types. Unknown caster falls through to clearing, which is the safe default.
- **`AIM_CAST` is untouched in practice** — Soul Mend channels with no cooldown, so `isOnCooldownRef.current` is never true for it and it never reaches the new mobile branch. It is included in the host-side rule anyway, so the rule reads on input semantics rather than on a coincidence of which abilities currently have cooldowns.
- **The anti-flood property is preserved by construction**, not by care: the sim has no cast path reachable from an aim-preview input, so this branch cannot reproduce the 2026-07-25 flooding regardless of send rate.
- **Required hooks: Client-UX hook TRIGGERED — manual pass NOT performed** (no device or display here). A human should confirm: holding Lightning Arc / Blood Spike / Avalanche / Ancestor's Voice shows an arrow that tracks the thumb continuously with no blink at the cooldown boundary; releasing clears it within the staleness window; `RELEASE` abilities still clear instantly on fire; and Soul Mend's channel behaviour is unchanged.
- **Regression:** `npm run typecheck` clean (10/10 tsconfigs). `npm test`: **738 passed**, 1 failed, 9 skipped across 60 files — the failure is the documented pre-existing Stone Wall centering assertion, and the "failed" e2e files are the known WSL2 port-binding timeout with their tests skipped. Lint on both touched files shows only the pre-existing baseline (`no-undef` browser globals, plus the pre-existing `game-rules` restricted import in `ControllerScreen.tsx`). Zero regressions attributable to this story.
- **Confidence: 88%.** Both halves have direct tests, and both were negative-tested by reverting the fix. The reservation is the usual one for this surface: no automated test renders a pixel or drives a touch gesture, so "the arrow no longer blinks" is verified as a state-machine property (the preview entry survives a cast) rather than visually.

### File List

- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — `AUTO` interval sends `onAimPreview` while on cooldown; zero-aim skip hoisted above the cooldown check (Task 1)
- `apps/host-client/src/vfx/ability-vfx-dispatch.ts` — `ability:fired` clears the aim preview only for non-held input types; `CLASS_DEFINITIONS` import (Task 2)
- `apps/host-client/src/vfx/ability-vfx-dispatch.test.ts` — **new.** 6 tests covering the clearing rule across `AUTO`/`RELEASE`/`AIM_CAST`/`TAP`/unresolvable-caster plus a repeated-cast loop (Task 3)
- `tests/e2e/aim-preview.test.ts` — new test: a held `AUTO` ability's previews are accepted and answered direction-only during a real cooldown (Task 4)
- `_bmad-output/implementation-artifacts/7-15e-auto-ability-continuous-aim-arrow.md` — this story file
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — status entry

### Manual Client-UX Pass (2026-08-07) — performed by the user

The user ran the real game across a host screen and a phone and confirmed the feature set works, reporting "almost perfect" on the initial six stories and "works like a charm" after Story 7.15e's `AUTO` continuous-arrow fix. That closes the **Client-UX hook** gate this story disclosed as outstanding — it was the one gate no automated layer in this sandbox could satisfy, and it is now genuinely satisfied rather than waived.

One finding came out of the pass and was fixed rather than deferred: the `AUTO` aim arrow blinked at the cooldown cadence instead of tracking the thumb. See `7-15e-auto-ability-continuous-aim-arrow.md`. No other visual defects were reported — notably no report of the cone ghosts rendering as slivers (the Story 7.13 failure mode this branch's geometry was specifically written to avoid), and no report of host frame-rate trouble with aim previews live, which was the top item flagged for measurement in Story 7.15c.

## Change Log

- 2026-08-06 — Story created and implemented in one pass, from a direct user request following the `AUTO` cadence limitation recorded in Stories 7.15b and 7.15c. Status → review.
