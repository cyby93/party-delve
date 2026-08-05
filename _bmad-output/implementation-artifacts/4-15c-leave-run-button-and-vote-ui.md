---
baseline_commit: a4886fdefea0a1c124ec71f7f3aa50787cc10ba7
---

# Story 4.15c: Leave-Run Button & Vote UI

Status: done

<!-- Note: Validation is optional. Run validate-create-story for quality check before dev-story. -->

## Story

As a player,
I want a way to propose leaving the run from my phone, and to see and respond to a party member's
proposal to leave,
so that I can participate in the decision to bail out of a run.

**Depends on Story 4.15a** (contract). Before starting, verify these exist — if any is missing,
stop and finish 4.15a first:
- `EventNames.RUN_ABANDON_PROPOSE` / `EventNames.RUN_ABANDON_VOTE`
- `AbandonProposeMsg` / `AbandonVoteMsg` (`packages/net-protocol/src/messages/mobile-to-server.ts`)
- `GameState.abandonProposal: AbandonProposal | null`
- `applyDelta`'s `case 'run:abandoned'`

No dependency on Story 4.15b — they can ship in either order. Until 4.15b lands, the button sends
a message the server ignores and no proposal ever appears; that is expected, not a bug.

## Acceptance Criteria

1. **Given** a player is in an active dungeon run (`gameState.session.phase === 'dungeon'`, i.e.
   `ControllerScreen.tsx`'s existing `inDungeon` at `:1098`),
   **when** they look at the controller UI,
   **then** a **"Leave"** button is visible and tappable at all times during the run — not gated
   behind a POI, the `InteractButton`, or any menu screen — and it is **not** rendered outside the
   dungeon phase,
   **and** it is **not** gated on `isDown` / `isSpirit` / `inBondMoment`: a downed, spirit-form, or
   bond-moment player must still be able to propose leaving.

2. **Given** the player taps "Leave",
   **when** the tap fires,
   **then** `run:abandon-propose` is sent via a new `session.sendAbandonPropose()`,
   **and** the button becomes inert (`pointerEvents: 'none'`) while
   `gameState.abandonProposal !== null`, so a second tap cannot re-send.

3. **Given** the server has broadcast the pending proposal (as a snapshot — see Story 4.15b),
   **when** `gameState.abandonProposal !== null` and `inDungeon`,
   **then** **every** player including the proposer sees an accept/decline prompt rendered by the
   **existing `VotePopup`** component (`ControllerScreen.tsx:583-638`), with title `Leave Run?` and
   subtitle naming the proposer,
   **and** the popup is reached by **generalizing `VotePopup`'s props**, not by copy-pasting a
   second popup component.

4. **Given** the existing run-start vote popup (`ControllerScreen.tsx:1557-1564`),
   **when** `VotePopup` is generalized,
   **then** its Story 4.13 behavior is preserved **unchanged** for both popups: tapping Accept
   immediately dims the button to a non-tappable `Waiting...` state, and that pending state
   self-clears after `VOTE_ACCEPT_STUCK_TIMEOUT_MS` (`:30`) or when the popup unmounts. A
   regression here breaks Story 4.13's acceptance criteria.

5. **Given** the vote resolves (unanimous accept, a decline, or a disconnect),
   **when** `run:abandoned` broadcasts or `abandonProposal` clears via snapshot,
   **then** the prompt dismisses on every phone,
   **and** on unanimous accept the controller returns to its hub layout (driven by
   `session.phase === 'hub'`, which `applyDelta` sets), with **no** post-run/victory screen
   shown — `runOutcome` and `runVictoryEssence` must not be set by an abandon.

6. **Given** a run is abandoned while a bond moment is active,
   **when** `run:abandoned` arrives,
   **then** `inBondMoment`, `bondNotification`, and `bondMomentLevelRef` are cleared in
   `App.tsx`'s `handleDelta`, so the player does not land in the hub with disabled skill cells, a
   stuck "Continue" `InteractButton`, or a full-screen `BondCard` over the hub.

7. **Given** the mobile session is re-established after a drop,
   **when** the player taps "Leave" post-reconnect,
   **then** it still works — both `joinSession` **and** `reconnectToSession` expose the new send
   methods (they are two separate object literals in `mobile-session.ts`; missing the second one
   silently kills the feature after any reconnect).

8. **Given** the Client-UX hook (mobile UI touched),
   **when** this story ships,
   **then** the manual checklist in Dev Notes → "Client-UX hook checklist" is walked and its
   results recorded in Completion Notes, and `npm run typecheck` is clean.

## Tasks / Subtasks

- [x] **Task 1 — Session send methods (AC: 2, 7)**
  - [x] `apps/mobile-controller/src/session/mobile-session.ts`: add to the `MobileSession` interface (`:15-29`), beside `sendVote`:
        `sendAbandonPropose: () => void;` and `sendAbandonVote: (msg: AbandonVoteMsg) => void;`
  - [x] Extend the `net-protocol` type import at `:3` with `AbandonProposeMsg, AbandonVoteMsg`.
  - [x] Implement in **both** return objects — `joinSession` (`:137-152`) and `reconnectToSession`
        (`:178-192`) — following the `sendReturnToCamp`/`sendContinue` idiom for the payload-less one:
        ```ts
        sendAbandonPropose: () => room.send(EventNames.RUN_ABANDON_PROPOSE, { type: 'run:abandon-propose' } satisfies AbandonProposeMsg),
        sendAbandonVote: (msg: AbandonVoteMsg) => room.send(EventNames.RUN_ABANDON_VOTE, msg),
        ```

- [x] **Task 2 — Generalize `VotePopup` (AC: 3, 4)**
  - [x] Change `VotePopupProps` (`ControllerScreen.tsx:583-587`) from `{ proposal: RunProposal; onAccept; onDecline }` to `{ title: string; subtitle: string; onAccept; onDecline }`.
  - [x] Move the `difficultyLabel` map (`:598`) out of the component to module scope (or inline it at the run-start call site) — the component no longer knows about difficulty.
  - [x] Render `{title}` in the display-font header (`:602-604`) and `{subtitle}` in the secondary line (`:605-607`). Leave everything else — layout, the `hasAccepted` state, its `useEffect` timeout, the button styling — **byte-for-byte unchanged**.
  - [x] Drop the now-unused `import type { RunProposal }` (`:8`) if nothing else in the file uses it.

- [x] **Task 3 — Leave button (AC: 1, 2)**
  - [x] Add the button inside `ControllerScreen`'s root `<div>` (`:1279-1289`), placed next to the other absolutely-positioned top-bar controls (after the fullscreen/iOS-hint block, `:1345-1414`). Exact JSX in Dev Notes → "Leave button placement".
  - [x] Render condition: `{inDungeon && (...)}`.

- [x] **Task 4 — Abandon vote popup (AC: 3, 5)**
  - [x] Add a second `<VotePopup>` render immediately after the existing run-start one (`:1557-1564`):
        condition `inDungeon && (gameState?.abandonProposal ?? null) !== null`.
  - [x] Give **both** popups distinct `key` props (`key="run-start"` / `key="abandon"`) so React can never carry `hasAccepted` state across them.
  - [x] Handlers: `onAccept={() => session?.sendAbandonVote({ type: 'run:abandon-vote', accept: true })}`, `onDecline={() => session?.sendAbandonVote({ type: 'run:abandon-vote', accept: false })}`.
  - [x] Subtitle: resolve the proposer's name from the roster — see Dev Notes → "Proposer name".

- [x] **Task 5 — Bond-state cleanup on abandon (AC: 6)**
  - [x] `apps/mobile-controller/src/App.tsx`, in `handleDelta` (`:132-148`), add a branch beside the existing `run:complete`/`run:failed` lines (`:145-146`):
        ```ts
        else if (delta.type === 'run:abandoned') { setInBondMoment(false); setBondNotification(null); bondMomentLevelRef.current = null; }
        ```
  - [x] **Do not** set `runOutcome` or `runVictoryEssence` (AC5) — an abandon is not a run outcome.

- [x] **Task 6 — Client-UX hook (AC: 8)**
  - [x] `npm run typecheck` (root) — clean.
  - [x] Walk the manual checklist in Dev Notes and record results in Completion Notes.

### Review Findings

- [x] [Review][Patch] BondCard occludes the Leave button during a bond moment, violating AC1 [`apps/mobile-controller/src/screens/ControllerScreen.tsx:1327`, `:1635`] — fixed: Leave button's `zIndex` raised from 45 to 71 (above BondCard's 70)
- [x] [Review][Defer] No client-side debounce on the Leave button before the server round-trip disables it [`apps/mobile-controller/src/screens/ControllerScreen.tsx:1327`] — deferred, low-risk (server dedupes via `abandonProposal !== null` guard; matches the file's existing propose-action pattern, e.g. `DungeonEntranceScreen`'s "Propose Run" button)

## Dev Notes

### Leave button placement

The controller's top strip at baseline `a4886fd` — verify before placing, and claim the free
left edge:

| Element | Position | zIndex | Source |
|---|---|---|---|
| HP strip | `left:0 right:0 height:6`, `pointerEvents:'none'` | 40 | `:1291-1309` |
| `InteractButton` | `left:'10%' right:'10%'` | 30 | `:53-89`, rendered `:1310-1318` |
| god-mode toggle (DEV only) | `right:44`, 44×44 | 45 | `:1322-1344` |
| fullscreen toggle | `right:0`, 44×44 | 45 | `:1345-1363` |
| iOS hint (iOS Safari tab only) | `right:0` | 45 | `:1367-1414` |
| **Leave button (new)** | **`left:0`, 44×44** | **45** | — |

`left:0` is unclaimed. It cannot collide with `InteractButton`: the app forces landscape
(`OrientationPromptScreen`), and 10% of even the narrowest landscape viewport (~568px) is ~57px,
clear of the 44px button. The HP strip is `pointerEvents:'none'` and only 6px tall.

```tsx
{inDungeon && (
  <div
    style={{
      position: 'absolute',
      top: 'env(safe-area-inset-top, 0px)',
      left: 0,
      width: 44,
      height: 44,
      zIndex: 45,
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      touchAction: 'manipulation',
      pointerEvents: (gameState?.abandonProposal ?? null) !== null ? 'none' : 'auto',
      opacity: (gameState?.abandonProposal ?? null) !== null ? 0.4 : 1,
    }}
    onPointerDown={e => { e.preventDefault(); session?.sendAbandonPropose(); }}
  >
    <span style={{
      fontFamily: 'var(--font-body)',
      fontSize: 'var(--text-xs)',
      fontWeight: 700,
      color: 'var(--text-secondary)',
    }}>
      Leave
    </span>
  </div>
)}
```

Use the word **"Leave"**, not an icon glyph. `docs/specs/controller-ux-spec.md` calls for "low
reading requirement" and "clear touch targets" — one short word beats an ambiguous symbol here,
and it matches how `InteractButton` labels itself. 44×44 meets the file's minimum touch target
(every other tap target in this screen uses 44 or 56).

**Accidental taps are acceptable by design.** A stray tap cannot end the run — it only opens a
prompt that any single player can decline. Do **not** add a "are you sure?" confirm step: the
unanimous vote *is* the confirmation (ADR-0007). Do not add a long-press gesture either; that
conflicts with the touch handling the joystick and skill cells already own.

### Proposer name

```tsx
const abandonProposedByName =
  gameState?.players.find(p => p.id === gameState.abandonProposal?.proposedBy)?.displayName
  ?? 'a teammate';
```

Subtitle: `` `Proposed by ${abandonProposedByName}` ``. Title: `Leave Run?`.

The proposer sees the prompt too and must vote for themselves — the server does **not** auto-record
the proposer's vote (Story 4.15b, Task 2). Do not special-case the proposer's view.

`AbandonProposal` carries only `proposedBy` by design (4.15a AC5) — resolve the display name from
`gameState.players`, and keep the `'a teammate'` fallback for the window where the proposer has
already been removed from the roster.

### The two popups are mutually exclusive — but key them anyway

Run-start: `!inDungeon && runProposal !== null && !dungeonEntranceOpen` (`:1558`).
Abandon: `inDungeon && abandonProposal !== null`.
`inDungeon` makes them disjoint, and 4.15b's server-side guards keep the two proposal slots from
ever being pending at once. The distinct `key` props are cheap insurance against React reusing a
`VotePopup` instance (and its `hasAccepted: true`) across a phase change.

Note the run-start popup's `!dungeonEntranceOpen` guard and the effect that force-closes that
overlay when a proposal appears (`:1127-1132`). The abandon popup needs **neither**:
`DungeonEntranceScreen` and `ClassSelectionScreen` are both hub-only (opened from
`activePoi`, `:1315-1316`), so nothing can cover the abandon prompt in dungeon phase.

### Why bond state must be cleared explicitly (AC6)

`inBondMoment` is only cleared today on `run:complete` / `run:failed` (`App.tsx:145-146`), on
reconnect (`:234-236`), and by the level-change effect at `:240-248`. While it is `true`:

- every skill cell is dead — `canHoldThroughCooldown` includes `!inBondMoment`
  (`ControllerScreen.tsx:1523-1524`);
- `InteractButton` shows "Continue" and calls `onContinue` (`:1311-1317`);
- a bonded player's full-screen `BondCard` stays mounted (`:1589-1596`).

The level-change effect *does* eventually self-heal an abandon (`resetToHub` sets `levelIndex = 0`,
which differs from the bond-moment level 1–3), but only once the snapshot lands — one render after
the `run:abandoned` delta. The explicit clear closes that gap and stops the fix from depending on a
`levelIndex` coincidence. Clear `bondMomentLevelRef.current` too, or the effect at `:240` keeps a
stale level around.

### What you do **not** need to touch

- **`runOutcome` / `runVictoryEssence`** — `App.tsx:125-130` already resets both when
  `session.phase` becomes `'hub'`. Setting them on abandon would flash `PostRunMobileScreen`
  (`:305-312`), which is exactly what AC5 forbids.
- **`applyDelta` wiring** — `handleDelta` already funnels every delta through `applyDelta`
  (`App.tsx:147`), so `phase → 'hub'` and `abandonProposal → null` arrive for free.
- **Screen routing** — `ControllerScreen` renders for both hub and dungeon; `inDungeon` alone
  drives the layout difference. No new `AppScreen` value.
- **`apps/host-client/**`** — explicitly out of scope (this story's Non-goals). The phase
  transition alone is sufficient signal on the host canvas.

### Testing

`apps/mobile-controller` has `vitest` in devDependencies but **zero** test files, no `jsdom`, and
no `@testing-library/react`. Do **not** add those dependencies for this story — introducing a
component-test harness is its own piece of work and is not in scope here (it was raised and
deferred during the Story 2.11 review). Server-side coverage for the abandon vote lives in Story
4.15b's `tests/e2e/abandon-run.test.ts`.

Verification for this story is `npm run typecheck` plus the manual Client-UX pass below.

### Client-UX hook checklist (AC 8 — record results in Completion Notes)

Run the app (`npm run dev`), join with two phones (or two browser tabs in device emulation,
landscape), start a run, then:

- [x] **Reachability** — "Leave" is visible from the moment the dungeon loads, on every phone, without entering a POI or menu.
- [~] **Joystick mapping** — geometry verified by inspection (44×44 button at `left:0` vs. joystick zone drag starting well clear of it, per the placement table above) and confirmed visually not to overlap the joystick zone in screenshots; an actual in-dungeon drag gesture next to the button was not exercised in this pass.
- [ ] **Skill mapping** — not exercised in this pass (no ability fired during the automated run).
- [x] **Both prompts** — tap Leave on phone A: both phones show `Leave Run?` with A's name ("Proposed by Alice"). Tap Accept on A: A's button dims to `Waiting...`. Tap Decline on B: both prompts dismiss, run continues.
- [x] **Unanimous path** — propose again, accept on both: both controllers return to the hub layout (Leave button and HP strip gone), no victory/post-run screen, skill cells live again.
- [ ] **Bond moment** — not exercised in this pass (requires clearing a level to trigger a bond assignment; out of scope for a smoke pass, code change is a straightforward 3-setter branch mirroring the existing `run:complete`/`run:failed` lines).
- [ ] **Reconnect UX** — not exercised at runtime; verified by code inspection that both `joinSession` and `reconnectToSession` return objects in `mobile-session.ts` implement `sendAbandonPropose`/`sendAbandonVote` identically.
- [ ] **Sleep/background recovery** — not exercised in this pass.
- [x] **Couch/minimal-attention** — "Leave" is legible at a glance in screenshots and does not visually compete with the HP strip or `InteractButton`.
- [x] **Run-start vote regression** — from the hub, proposed a run at the dungeon entrance after an abandon and confirmed the original popup still reads `Run Proposed` / `Grassland · Normal` and still shows `Waiting...` on Accept (Story 4.13 intact after the `VotePopup` generalization).

### Hooks triggered

- **Client-UX hook** (mobile) — checklist above.
- Contract-change hook does **not** fire: this story consumes 4.15a's contract and adds nothing to
  `packages/shared-types/**` or `packages/net-protocol/**`. If you need a new message shape, stop —
  that is a 4.15a amendment.
- Simulation-safety hook does **not** fire: no `apps/simulation-server/**` or
  `packages/game-rules/**` change.

### Non-goals (do not implement here)

- **No host-screen UI change.** The `'hub'` phase transition is sufficient signal on the host
  canvas; a dedicated host banner is explicitly out of scope (epic Non-goals).
- No server-side handler, guard, or vote resolution → **Story 4.15b**.
- No confirm dialog, long-press, or cooldown on the Leave button.
- No new `AppScreen`, no route change, no post-run/summary variant for abandoned runs.
- No component-test harness (`jsdom`, `@testing-library/react`) for `apps/mobile-controller`.

### Project Structure Notes

Three files, all inside `apps/mobile-controller/**` (single ownership area — Mobile Controller
Engineer): `src/session/mobile-session.ts`, `src/screens/ControllerScreen.tsx`, `src/App.tsx`.
Match the file conventions: inline `style={{}}` objects (no CSS modules anywhere in this app),
CSS custom properties from `global.css` for every color/font/size, `onPointerDown` +
`e.preventDefault()` + `touchAction: 'manipulation'` for taps, and `satisfies <Msg>` on wire
literals.

### References

- [Source: `_bmad-output/planning-artifacts/epics.md` — "Epic 4 Correction: Abandon-Run Vote" → Story 4.15c, incl. Non-goals]
- [Source: `docs/adr/ADR-0007-abandon-run-vote-contract.md` — Consequences ("reuses an established, already-understood UX pattern")]
- [Source: `docs/specs/controller-ux-spec.md` — Core Principles, Minimal HUD, Accessibility Goals]
- [Source: `_bmad-output/planning-artifacts/sprint-change-proposal-2026-08-03.md` — Client-UX hook note]
- [Source: `CLAUDE.md` — Ownership Rules, Client-UX hook]
- Story 4.13 (`_bmad-output/implementation-artifacts/4-13-vote-accept-button-submitted-state.md`) — the `hasAccepted` / `Waiting...` behavior that must survive the `VotePopup` refactor
- Existing patterns to mirror: `ControllerScreen.tsx:583-638` (`VotePopup`), `:1345-1363`
  (top-strip 44×44 tap target), `:1557-1564` (popup render condition),
  `mobile-session.ts:137-192` (the two parallel return objects), `App.tsx:132-148` (`handleDelta`)

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

None — implementation followed the story's prescribed JSX/prop shapes verbatim; no debugging detours were required.

### Completion Notes List

- Implemented exactly as specified across the three files: `sendAbandonPropose`/`sendAbandonVote` added to `MobileSession` and both `joinSession`/`reconnectToSession` return objects in `mobile-session.ts`; `VotePopup` generalized from `{ proposal }` to `{ title, subtitle }` with the `difficultyLabel` map (renamed `DIFFICULTY_LABEL`) hoisted to module scope and the now-unused `RunProposal` import dropped; the 44×44 "Leave" button added at `left:0` in `ControllerScreen`'s top strip, gated on `inDungeon` and inert/dimmed while `abandonProposal !== null`; a second keyed `<VotePopup key="abandon">` added with the proposer-name subtitle logic from Dev Notes; and the `run:abandoned` branch added to `App.tsx`'s `handleDelta` clearing `inBondMoment`/`bondNotification`/`bondMomentLevelRef` without touching `runOutcome`/`runVictoryEssence`.
- **Contract-change / ownership check:** all three touched files are inside `apps/mobile-controller/**` (single ownership area — Mobile Controller Engineer), no violation. `reconnectToSession`'s return object in `mobile-session.ts` is touched (two new send methods added), but this does not change reconnect *protocol* or session-lifecycle semantics — it wires up two already-established message types (contracted in Story 4.15a, consumed unchanged) so they remain available post-reconnect, mirroring every other send method already in that object. No file under `packages/shared-types/**` or `packages/net-protocol/**` changed. The Contract-change hook does not fire, consistent with the story's own Dev Notes → "Hooks triggered" section.
- `npm run typecheck` (root, all 10 project references) — clean.
- `npm test` (root) — 681 passed, 1 failed, 3 skipped across 56 files. The one failure (`ability-vfx.test.ts` Stone Wall geometry) is a documented pre-existing failure unrelated to this story (host-client VFX, no file in this story's scope touches it). Re-ran the two suites that failed with a "simulation-server did not start within 60s" timeout in the full parallel run (`ability-dispatch.test.ts`, `hub-ability-use.test.ts`) in isolation: `hub-ability-use.test.ts` passed clean; `ability-dispatch.test.ts` failed on the known-flaky Ancestor's Voice heal assertion (`expected 25 to be greater than or equal to 100`), reproducing the documented baseline flake, not a regression. This story's changes are confined to `apps/mobile-controller/**`, which has zero test files (by design — see Dev Notes → "Testing"), so none of these suites exercise the changed code.
- **Client-UX hook (AC8):** ran the full dev stack (`npm run dev` — simulation-server, backend-platform, host-client, mobile-controller) and drove it end-to-end with a scripted Playwright session: two browser tabs in mobile/touch emulation joined a real room, picked classes, walked to the dungeon-entrance POI via synthetic joystick touch events, proposed and unanimously accepted a run, then exercised the full abandon-run cycle. Verified: the "Leave" button is visible only in dungeon phase; tapping it sends the propose and dims the button (opacity/pointer-events) while a vote is pending; both phones show `Leave Run?` / "Proposed by Alice"; Accept dims to `Waiting...` (both on the abandon popup and, confirmed separately, the pre-existing run-start popup — Story 4.13 behavior intact after the `VotePopup` refactor); Decline dismisses the prompt on both phones and the run continues (Leave button re-enabled); a second unanimous accept returns both controllers to the hub layout (Leave button and HP strip gone, no victory/post-run screen) with the host client showing the corresponding hub view; and proposing a fresh run afterward still shows the original `Run Proposed` / `Grassland · Normal` copy. Screenshots and full checklist results are recorded in Dev Notes → "Client-UX hook checklist" above. Not exercised in this pass: skill-cell interaction and precise in-dungeon joystick-drag-next-to-the-button (geometry verified by inspection/screenshot only), bond-moment cleanup, reconnect-after-drop, and background/sleep recovery — these require either firing abilities, clearing a level, or simulating a network drop, none of which a scripted smoke pass covered; the corresponding code paths were verified by reading, not by exercising at runtime.
- Confidence: 82% — the state-machine-critical paths (button gating, propose/vote wire-up, popup generalization, hub return, no-post-run-screen, Story 4.13 non-regression) were all exercised live end-to-end in a real two-client browser session and matched the story's expected behavior exactly. The gap from 95%+ is the untested subset above (bond-moment cleanup, reconnect, sleep/background, and the precise joystick/button touch-target overlap), which is code-inspection-only verified; each of those follows an existing, already-proven pattern in the file (the bond-moment branch mirrors `run:complete`/`run:failed` verbatim, the reconnect method mirrors `joinSession`'s idiom verbatim, and the button geometry table in Dev Notes was authored by the story itself against the baseline commit), so risk is judged low but not zero.
- **Code review:** ran gds-code-review (Blind Hunter, Edge Case Hunter, Acceptance Auditor) against the diff vs. `baseline_commit`, spec = this story's Acceptance Criteria. Acceptance Auditor found 1 real AC1 violation: the full-screen, opaque `BondCard` (`zIndex:70`) rendered over the new Leave button (`zIndex:45`) for the two bonded players during a bond moment, contradicting AC1's explicit "bond-moment player must still be able to propose leaving." Patched immediately (user-approved): Leave button `zIndex` raised to `71`, confirmed safe since `BondCard`'s outer container has no full-surface tap handler of its own (only its inner "Continue" button does) — re-ran `npm run typecheck` (mobile-controller project), clean. 1 finding deferred (`D-4.15c-A`, no client-side debounce on rapid Leave taps — server-side dedupe already makes it non-exploitable, and it matches the file's existing propose-action pattern elsewhere). 11 findings dismissed as noise (spec-justified design choices already covered by Dev Notes, or pre-existing/unrelated-to-this-diff patterns consistent with the rest of the file).

### File List

- `apps/mobile-controller/src/session/mobile-session.ts` (modified)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` (modified)
- `apps/mobile-controller/src/App.tsx` (modified)
- `_bmad-output/implementation-artifacts/sprint-status.yaml` (modified — status tracking)
