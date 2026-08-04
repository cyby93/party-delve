---
baseline_commit: a4886fdefea0a1c124ec71f7f3aa50787cc10ba7
---

# Story 4.15c: Leave-Run Button & Vote UI

Status: ready-for-dev

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

- [ ] **Task 1 — Session send methods (AC: 2, 7)**
  - [ ] `apps/mobile-controller/src/session/mobile-session.ts`: add to the `MobileSession` interface (`:15-29`), beside `sendVote`:
        `sendAbandonPropose: () => void;` and `sendAbandonVote: (msg: AbandonVoteMsg) => void;`
  - [ ] Extend the `net-protocol` type import at `:3` with `AbandonProposeMsg, AbandonVoteMsg`.
  - [ ] Implement in **both** return objects — `joinSession` (`:137-152`) and `reconnectToSession`
        (`:178-192`) — following the `sendReturnToCamp`/`sendContinue` idiom for the payload-less one:
        ```ts
        sendAbandonPropose: () => room.send(EventNames.RUN_ABANDON_PROPOSE, { type: 'run:abandon-propose' } satisfies AbandonProposeMsg),
        sendAbandonVote: (msg: AbandonVoteMsg) => room.send(EventNames.RUN_ABANDON_VOTE, msg),
        ```

- [ ] **Task 2 — Generalize `VotePopup` (AC: 3, 4)**
  - [ ] Change `VotePopupProps` (`ControllerScreen.tsx:583-587`) from `{ proposal: RunProposal; onAccept; onDecline }` to `{ title: string; subtitle: string; onAccept; onDecline }`.
  - [ ] Move the `difficultyLabel` map (`:598`) out of the component to module scope (or inline it at the run-start call site) — the component no longer knows about difficulty.
  - [ ] Render `{title}` in the display-font header (`:602-604`) and `{subtitle}` in the secondary line (`:605-607`). Leave everything else — layout, the `hasAccepted` state, its `useEffect` timeout, the button styling — **byte-for-byte unchanged**.
  - [ ] Drop the now-unused `import type { RunProposal }` (`:8`) if nothing else in the file uses it.

- [ ] **Task 3 — Leave button (AC: 1, 2)**
  - [ ] Add the button inside `ControllerScreen`'s root `<div>` (`:1279-1289`), placed next to the other absolutely-positioned top-bar controls (after the fullscreen/iOS-hint block, `:1345-1414`). Exact JSX in Dev Notes → "Leave button placement".
  - [ ] Render condition: `{inDungeon && (...)}`.

- [ ] **Task 4 — Abandon vote popup (AC: 3, 5)**
  - [ ] Add a second `<VotePopup>` render immediately after the existing run-start one (`:1557-1564`):
        condition `inDungeon && (gameState?.abandonProposal ?? null) !== null`.
  - [ ] Give **both** popups distinct `key` props (`key="run-start"` / `key="abandon"`) so React can never carry `hasAccepted` state across them.
  - [ ] Handlers: `onAccept={() => session?.sendAbandonVote({ type: 'run:abandon-vote', accept: true })}`, `onDecline={() => session?.sendAbandonVote({ type: 'run:abandon-vote', accept: false })}`.
  - [ ] Subtitle: resolve the proposer's name from the roster — see Dev Notes → "Proposer name".

- [ ] **Task 5 — Bond-state cleanup on abandon (AC: 6)**
  - [ ] `apps/mobile-controller/src/App.tsx`, in `handleDelta` (`:132-148`), add a branch beside the existing `run:complete`/`run:failed` lines (`:145-146`):
        ```ts
        else if (delta.type === 'run:abandoned') { setInBondMoment(false); setBondNotification(null); bondMomentLevelRef.current = null; }
        ```
  - [ ] **Do not** set `runOutcome` or `runVictoryEssence` (AC5) — an abandon is not a run outcome.

- [ ] **Task 6 — Client-UX hook (AC: 8)**
  - [ ] `npm run typecheck` (root) — clean.
  - [ ] Walk the manual checklist in Dev Notes and record results in Completion Notes.

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

- [ ] **Reachability** — "Leave" is visible from the moment the dungeon loads, on every phone, without entering a POI or menu.
- [ ] **Joystick mapping** — dragging the movement joystick from near the top-left still works; the 44×44 button does not swallow joystick touches (it sits above the joystick zone's `touchAction:'none'` area — confirm a drag starting just below/right of it still moves the player).
- [ ] **Skill mapping** — all four skill cells behave exactly as before, including hold-through-cooldown and the RELEASE drag gesture.
- [ ] **Both prompts** — tap Leave on phone A: both phones show `Leave Run?` with A's name. Tap Accept on A: A's button dims to `Waiting...`. Tap Decline on B: both prompts dismiss, run continues.
- [ ] **Unanimous path** — propose again, accept on both: both controllers return to the hub layout, no victory/post-run screen, skill cells live again.
- [ ] **Bond moment** — trigger a bond moment (clear a level), propose + accept from there: no stuck "Continue" button, no lingering `BondCard`, skill cells enabled in the hub.
- [ ] **Reconnect UX** — drop one phone (airplane mode / devtools offline) and reconnect; confirm "Leave" still sends after reconnect (AC7 — this is the regression the second `mobile-session.ts` object literal guards).
- [ ] **Sleep/background recovery** — background a phone during a pending vote and return; the prompt state matches the server's (either still pending, or dismissed if the vote resolved/cancelled meanwhile).
- [ ] **Couch/minimal-attention** — "Leave" is legible at a glance and does not compete with the HP strip or `InteractButton` for the top strip.
- [ ] **Run-start vote regression** — from the hub, propose a run at the dungeon entrance and confirm the original popup still reads `Run Proposed` / `Grassland · Easy` and still shows `Waiting...` on Accept (Story 4.13).

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

### Debug Log References

### Completion Notes List

### File List
