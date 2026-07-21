---
baseline_commit: 1f9b932f57fcab246b1dcffdda5367da338fc243
---

# Story 4.13: Vote-Accept Button Submitted State

Status: done

## CLAUDE.md Required Task Header

```
Phase: E4 — Procedural Dungeon & Full Run Structure (Story 4.13 — mobile UI polish,
  no protocol change)
Context: `VotePopup` (apps/mobile-controller/src/screens/ControllerScreen.tsx, ~line
  559-598) renders the Accept/Decline buttons shown to every connected phone when
  `gameState.runProposal` is non-null (Story 4.2). Today, tapping Accept calls
  `session?.sendVote({ type: 'run:vote', accept: true })` with zero local feedback —
  the button has no `disabled` attribute, no pending style, and nothing prevents a
  repeat tap from firing `sendVote` again. The server (`GameRoom.ts` VOTE handler,
  ~line 233-256) is idempotent against repeat accepts (`this.runVotes.set(sessionId,
  'accept')` — a Map, last-write-wins, harmless), so there is no server-side bug, but
  the player gets no visual confirmation that their tap registered while they wait for
  the rest of the party — it looks unresponsive. This story is a client-only fix
  confined to `VotePopup`.
Owner agent: Mobile Controller Engineer (change confined to
  apps/mobile-controller/src/screens/ControllerScreen.tsx — single ownership area; no
  shared-types or net-protocol changes; no new wire message)
Goal: Give `VotePopup`'s Accept button an immediate local pending state on tap —
  dimmed/disabled visual, "Waiting..." label, no further `sendVote` calls possible
  while pending — that clears automatically when the popup unmounts (proposal
  resolves to accept/decline, or the popup is otherwise hidden by its parent's
  conditional render).
Allowed paths:
  - apps/mobile-controller/src/screens/ControllerScreen.tsx
Blocked paths:
  - packages/**
  - apps/simulation-server/**
  - apps/host-client/**
  - apps/backend-platform/**
  - tests/**
Inputs:
  - apps/mobile-controller/src/screens/ControllerScreen.tsx — read `VotePopup` in full
    (~line 559-598) and its mount/unmount conditional at ~line 1331-1338 before editing;
    confirm exact current line numbers (may have shifted since this story was written)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx — read `BondCard`
    (~line 888-930) for the established "local pending/disabled button" convention
    already used elsewhere in this same file (see Dev Notes) — reuse it, do not invent
    a new pattern
Non-goals:
  - Do not add server-side per-vote tracking to `gameState` (e.g. a broadcast list of
    who has voted). The AC only asks for the tapping player's own local confirmation
    that their tap registered — not a "3/4 accepted" indicator visible to the whole
    party. That would be a `shared-types`/`net-protocol` change requiring Protocol
    Architect review and is out of scope for this story.
  - Do not disable or dim the Decline button when Accept is pending. The AC names only
    "the button" (the one tapped) getting a pending state; a player who tapped Accept
    by mistake should still be able to tap Decline — the server's VOTE handler already
    treats `accept: false` as an unconditional override regardless of any prior vote
    (`GameRoom.ts` ~line 241-248: `if (!msg.accept) { this.gameState.runProposal =
    null; ... }`), so Decline must stay live.
  - Do not add a network round-trip acknowledgement (e.g. wait for a server ack before
    showing pending). The pending state is optimistic client-side UI only — tap →
    immediate visual feedback — matching how every other local-only UI state in this
    file behaves (e.g. `dismissReady` in `BondCard`, `tapFlash` on skill cells).
  - Do not add automated tests. `apps/mobile-controller` has zero existing test files
    (confirmed: no `*.test.*`/`*.spec.*` under `apps/mobile-controller`) and
    project-context.md's Testing Rules table scopes Unit tests to
    `packages/game-rules/tests/` and `apps/simulation-server/tests/` only — this is a
    client-UX-hook change (manual smoke check), not a unit/contract/e2e-test-owning
    change.
Acceptance criteria:
  1. When a player taps Accept on the `VotePopup`, the Accept button immediately
     switches to a disabled/pending visual state (dimmed + a "Waiting..." label
     replacing "Accept") — this must happen on the very first tap, synchronously with
     the `sendVote` call, not after any server round-trip.
  2. While pending, further taps on the Accept button do not call `sendVote` again —
     no double-submission of `run:vote` messages from repeat taps.
  3. The pending state clears when the popup unmounts — i.e. when
     `gameState.runProposal` resolves to `null` (unanimous accept starts the run,
     server-side auto phase transition to `dungeon`, or any player's decline clears the
     proposal for everyone) or when the popup is otherwise hidden by its existing
     parent conditional (entering a dungeon, or the dungeon-entrance screen opening).
     No stale "Waiting..." state must be visible the next time a `VotePopup` mounts for
     a fresh proposal.
  4. Decline remains fully functional and un-dimmed regardless of Accept's pending
     state.
  5. Full monorepo typecheck passes with no regressions (`npm run typecheck`).

Required hooks:
  - Client-UX hook (mobile UI modified): joystick mapping N/A (untouched), skill
    mapping N/A (untouched), reconnect UX N/A (untouched), sleep/background recovery
    N/A (untouched), minimal-attention check — relevant: the "Waiting..." label lets
    the player glance away from the phone back to the host screen with confidence
    their input registered, which is exactly this story's purpose.

Required tests:
  - None automated (see Non-goals). Manual smoke check: propose a run with 2+ phones
    connected, tap Accept on one phone, confirm the button dims and shows
    "Waiting...", confirm rapid repeat taps produce no console/network duplicate
    vote spam, confirm the popup disappears cleanly (no lingering pending state) once
    all players accept or any player declines.

Telemetry impact: None — no new user-facing flow, no new event, no payload shape
  change. Purely a local rendering/interaction fix on an existing popup.
```

---

## Story

As a player,
I want to see that my vote was registered when I tap Accept on a dungeon run proposal,
so that I know my input was received while waiting for the rest of the party.

---

## Acceptance Criteria

**Given** the dungeon run proposal popup is showing on a player's phone
**When** the player taps Accept
**Then** the button immediately shows a disabled/pending visual state (e.g. dimmed + "Waiting..." label) — no double-submission is possible while pending
**And** the pending state clears when `gameState.runProposal` resolves (accepted, declined, or expires) or the popup closes

---

## Tasks / Subtasks

- [x] **Task 1** (AC: #1, #2) — In `VotePopup` (`apps/mobile-controller/src/screens/ControllerScreen.tsx`, ~line 565-598), add local `useState<boolean>` pending state (e.g. `hasAccepted`), set to `true` synchronously inside the Accept button's `onPointerDown` handler before calling `onAccept()`, and guard the handler so it no-ops if already `true`.
- [x] **Task 2** (AC: #1) — Style the Accept button conditionally on the pending state: dimmed background/opacity, disabled cursor, `pointerEvents: 'none'` while pending, label text switches from `"Accept"` to `"Waiting..."`. Mirror the existing disabled-button convention already used in `BondCard`'s `dismissReady` pattern (~line 888-930) in the same file — same opacity/pointerEvents/cursor shape, not a new visual language.
- [x] **Task 3** (AC: #4) — Confirm the Decline button's `onPointerDown` and styling are untouched — no dimming, no guard added, stays fully interactive regardless of `hasAccepted`.
- [x] **Task 4** (AC: #3) — Confirm no extra unmount-handling code is needed: because `VotePopup` is only rendered while `!inDungeon && gameState?.runProposal != null && !dungeonEntranceOpen` (~line 1332), any resolution path (unanimous accept → phase becomes `'dungeon'` → `inDungeon` true; any decline → server nulls `runProposal` → broadcasts `SNAPSHOT`) removes `VotePopup` from the tree entirely, which discards its local `useState` for free. Verify by reading the conditional render logic — do not add a manual reset effect; the unmount already does it.
- [x] Run `npm run typecheck` (full monorepo) — confirm 0 errors.
- [x] Manual smoke test per "Required tests" above (2+ simulated/real phones, propose → accept → confirm dimmed pending state → confirm popup clears cleanly on resolution).

### Review Findings

- [x] [Review][Defer] Optimistic pending state has no recovery path if the server silently fails to honor the vote
  [apps/simulation-server/src/rooms/GameRoom.ts:613-639 `startDungeon` catch block; apps/mobile-controller/src/screens/ControllerScreen.tsx `VotePopup`] — deferred, pre-existing. If `startDungeon`'s unanimous-accept path throws (e.g. `loadLevel(1)` fails), the `catch` block reverts `runProposal`/`phase`/`difficulty` to their prior values and clears `runVotes` — but never calls `broadcast(...)`, unlike every other resolution path in this file. Since the client's `gameState.runProposal` value is unchanged, `VotePopup` never unmounts, so `hasAccepted` never resets — the tapping player's Accept button is now stuck on "Waiting..." (`pointerEvents: 'none'`) with no recovery beyond a reconnect, whereas before this story's UI change a repeat tap was at least possible (harmless no-op either way). Same class of gap covers `session` being null/undefined at tap time (`onAccept={() => session?.sendVote(...)}` silently no-ops, but `hasAccepted` is set regardless). Root cause is in `apps/simulation-server/**`, a Blocked path for this story, and the story's own Non-goals explicitly rule out adding a network round-trip acknowledgement (optimistic client-side UI only, matching every other local-only UI state in this file). Revisit as a follow-up story: add a `broadcast` on the `startDungeon` catch-path failure so `VotePopup` unmounts naturally, and/or consider a client-side pending timeout as a last-resort UI recovery.

---

## Dev Notes

### Context — current behavior (read before editing)

`VotePopup` today (`apps/mobile-controller/src/screens/ControllerScreen.tsx`, current lines 559-598):

```tsx
interface VotePopupProps {
  proposal: RunProposal;
  onAccept: () => void;
  onDecline: () => void;
}

function VotePopup({ proposal, onAccept, onDecline }: VotePopupProps) {
  const difficultyLabel: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,14,16,0.85)', zIndex: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>
        Run Proposed
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Grassland · {difficultyLabel[proposal.difficulty] ?? proposal.difficulty}
      </div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onPointerDown={e => { e.preventDefault(); onDecline(); }}
          style={{ /* ... Decline styles, unchanged ... */ }}
        >
          Decline
        </button>
        <button
          onPointerDown={e => { e.preventDefault(); onAccept(); }}
          style={{ /* ... Accept styles ... */ }}
        >
          Accept
        </button>
      </div>
    </div>
  );
}
```

Mounted at ~line 1331-1338:

```tsx
{/* Vote popup — shown to all players when a run is proposed */}
{!inDungeon && (gameState?.runProposal ?? null) !== null && !dungeonEntranceOpen && (
  <VotePopup
    proposal={gameState!.runProposal!}
    onAccept={() => session?.sendVote({ type: 'run:vote', accept: true })}
    onDecline={() => session?.sendVote({ type: 'run:vote', accept: false })}
  />
)}
```

There is currently **no** local state in `VotePopup` at all — every tap on Accept (or Decline) unconditionally fires `session?.sendVote(...)` with no visual acknowledgement and no guard against repeat taps.

### Why this is safe as a client-only fix (no server/protocol change)

- Server-side, `GameRoom.ts`'s VOTE handler (~line 233-256) stores votes in `this.runVotes:
  Map<sessionId, 'accept'>` — a private, non-`gameState` field never broadcast to clients.
  Setting the same key twice is a harmless no-op overwrite; there is no server-side
  double-count bug to fix, only a client feedback gap.
- `RunProposal` (`packages/shared-types/src/run-proposal.ts`) has no per-player
  accepted/declined list — `{ biome, difficulty, proposedBy }` only. Adding one would be a
  `shared-types` change requiring Protocol Architect review; out of scope (see Non-goals).
- Any proposal resolution (unanimous accept, or any decline) is guaranteed to null out
  `gameState.runProposal` (or flip `session.phase` to `'dungeon'`) **before** a new proposal
  can be created — `RUN_PROPOSE`'s handler at ~line 211 (`if (this.gameState.runProposal !==
  null) return;`) rejects a new propose while one is outstanding. This means `VotePopup`
  always fully unmounts between rounds; a fresh mount always starts with `hasAccepted =
  false`. No manual reset-on-new-proposal logic is needed — React's unmount/remount does it.

### Established codebase convention to reuse — `BondCard`'s `dismissReady` pattern

This exact "local pending-state disables a button until a condition is met" shape already
exists in the same file, `BondCard` (~line 888-930):

```tsx
function BondCard({ bondNotification, bondName, partnerName, onContinue }: BondCardProps) {
  const [dismissReady, setDismissReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDismissReady(true), 1500);
    return () => clearTimeout(t);
  }, []);
  // ...
  <button
    onPointerDown={e => { if (!dismissReady) return; e.preventDefault(); onContinue(); }}
    style={{
      background: dismissReady ? 'var(--interactive)' : 'var(--bg-surface)',
      border: `2px solid ${dismissReady ? 'var(--accent-spirit)' : 'var(--border)'}`,
      color: dismissReady ? 'var(--bg-base)' : 'var(--text-secondary)',
      cursor: dismissReady ? 'pointer' : 'default',
      opacity: dismissReady ? 1 : 0.3,
      transition: 'opacity 0.3s ease-out, background 0.3s, color 0.3s',
      pointerEvents: dismissReady ? 'auto' : 'none',
      touchAction: 'manipulation',
    }}
  >
```

This story's fix is the inverse polarity of the same pattern (button starts enabled,
becomes disabled on tap, instead of starting disabled and becoming enabled on a timer) —
reuse the same style-shape (`opacity`, `pointerEvents`, `cursor`, guard clause in the
handler) rather than inventing new CSS/interaction conventions. Suggested shape:

```tsx
function VotePopup({ proposal, onAccept, onDecline }: VotePopupProps) {
  const [hasAccepted, setHasAccepted] = useState(false);
  const difficultyLabel: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  return (
    <div style={{ /* unchanged overlay styles */ }}>
      {/* ...unchanged heading/subheading... */}
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onPointerDown={e => { e.preventDefault(); onDecline(); }}
          style={{ /* unchanged Decline styles — never dimmed */ }}
        >
          Decline
        </button>
        <button
          onPointerDown={e => {
            if (hasAccepted) return;
            e.preventDefault();
            setHasAccepted(true);
            onAccept();
          }}
          style={{
            flex: 1, minHeight: 56, borderRadius: 8, border: 'none',
            background: hasAccepted ? 'var(--bg-surface)' : 'var(--interactive)',
            color: hasAccepted ? 'var(--text-secondary)' : 'var(--bg-base)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
            cursor: hasAccepted ? 'default' : 'pointer',
            opacity: hasAccepted ? 0.5 : 1,
            pointerEvents: hasAccepted ? 'none' : 'auto',
            touchAction: 'manipulation',
            boxShadow: hasAccepted ? 'none' : '0 0 16px rgba(110,168,216,0.4)',
          }}
        >
          {hasAccepted ? 'Waiting...' : 'Accept'}
        </button>
      </div>
    </div>
  );
}
```

Exact colors/opacity values above are a suggestion consistent with existing tokens
(`--bg-surface`, `--text-secondary`) already used for disabled/secondary buttons elsewhere in
this file (e.g. Decline's own resting style) — dev may fine-tune, but must use existing CSS
custom properties, not new hard-coded colors.

`useState` is already imported at the top of `ControllerScreen.tsx` (line 1:
`import { useEffect, useRef, useState, useCallback } from 'react';`) — no new import needed.

### Project Structure Notes

- Single-component, single-file change — no new files, no new exports, no new
  dependencies, no wire message change.
- `apps/mobile-controller` has no test directory at all (`find apps/mobile-controller
  -iname "*.test.*" -o -iname "*.spec.*"` returns nothing) — this story does not introduce
  one; manual smoke test only, per Testing Rules table (project-context.md) which scopes
  automated Unit tests to `packages/game-rules/tests/` and `apps/simulation-server/tests/`.

### Project Context Rules

- **Ownership**: Change confined to `apps/mobile-controller/**`, owned by Mobile
  Controller Engineer — single ownership area, no cross-context approval needed.
- **Client-UX hook** (project-context.md Mobile Controller Constraints / CLAUDE.md Client-UX
  hook): triggered because mobile UI is modified. Touch target stays ≥44×44px (button
  `minHeight: 56` unchanged); minimal-attention check is the point of this story — a glanced
  phone confirms the tap landed without needing to stare at it.
- **Authority Model**: This is a pure local render-state change — no `GameState` mutation,
  no new input event type, `sendVote` call site and payload shape are unchanged. Fully
  compliant with "mobile sends typed input events only."
- **Event Contract Discipline**: No change to `packages/net-protocol` message shapes; the
  existing `VoteMsg { type: 'run:vote', accept: boolean }` is unchanged and still the only
  thing sent.
- **Result<T, E> rule**: Not applicable — no `packages/game-rules` function involved.
- **PC/Keyboard input**: Not applicable — `onPointerDown` touch interaction pattern is
  unchanged.

### Previous Story Intelligence (from 4.12)

Story 4.12 (immediately prior story in this epic, though a simulation-server fix rather
than a mobile one) reinforced two patterns worth carrying forward:

- **Read the exact current state before editing** — line numbers drift between stories;
  confirm via re-read of `ControllerScreen.tsx` before editing (this file is large, ~1400+
  lines, and other stories may have touched it since this story was written).
- **Small, scoped diffs; no speculative abstractions** — do not extract `VotePopup`'s new
  pending-button styling into a shared `<PendingButton>` component just because `BondCard`
  has a similar shape. Two near-identical inline button styles in the same file is not a
  DRY violation worth a shared component (matches this codebase's repeated Non-goals
  precedent in 4.10/4.11/4.12 rejecting speculative extraction for 2-3 call sites).

### References

- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.13: Vote-Accept Button Submitted State] — original AC
- [Source: _bmad-output/planning-artifacts/epics.md#Story 4.2: Dungeon Entrance Vote & Run Initialisation] — original vote UI/protocol this story polishes (unanimous-accept flow, decline-cancels-for-all flow)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx#VotePopup] — the component this story fixes (~line 559-598 as of baseline commit)
- [Source: apps/mobile-controller/src/screens/ControllerScreen.tsx#BondCard] — established local-pending-button convention to reuse (~line 888-930)
- [Source: apps/simulation-server/src/rooms/GameRoom.ts#RUN_PROPOSE, #VOTE, #resolveVoteIfComplete] — server-side vote handling confirming no server bug exists, only client feedback gap (~line 206-256, 602-611)
- [Source: packages/shared-types/src/run-proposal.ts] — `RunProposal` shape, confirms no per-player vote list exists client-side (by design, out of scope per Non-goals)
- [Source: packages/net-protocol/src/messages/mobile-to-server.ts#VoteMsg] — `{ type: 'run:vote', accept: boolean }`, unchanged by this story
- [Source: _bmad-output/implementation-artifacts/4-12-full-hp-restore-on-level-transition.md] — immediately prior story in this epic; established scoped-diff and read-before-edit discipline this story follows
- [Source: _bmad-output/project-context.md#Testing Rules, #Mobile Controller Constraints, #Code Organization Rules] — test category placement (no automated mobile-controller tests exist), touch-target/minimal-attention constraints, monorepo ownership boundaries

---

## Dev Agent Record

### Agent Model Used

Claude Sonnet 5 (claude-sonnet-5)

### Debug Log References

- `npm run typecheck` (full monorepo, 10 project references) — 0 errors.
- `npm -w apps/mobile-controller run build` (`tsc --noEmit && vite build`) — succeeded in 54.85s, no warnings.

### Completion Notes List

- Added `hasAccepted` local `useState<boolean>` to `VotePopup`, guarding the Accept button's `onPointerDown` so a second tap no-ops before `onAccept()`/`sendVote` fires again (AC #1, #2).
- Accept button styling now branches on `hasAccepted`: background/color swap to the existing `--bg-surface`/`--text-secondary` disabled tokens (same tokens `BondCard`'s `dismissReady` pattern and Decline's own resting style already use), `opacity: 0.5`, `pointerEvents: 'none'`, `cursor: 'default'`, `boxShadow: 'none'`, label `"Accept"` → `"Waiting..."`. No new CSS custom properties introduced.
- Decline button's handler and style block are untouched — verified unchanged in the diff (AC #4).
- Confirmed (read, no code change) that `VotePopup` is only ever mounted under `!inDungeon && gameState?.runProposal != null && !dungeonEntranceOpen` (~line 1323-1329) — every resolution path (unanimous accept → `inDungeon` true, any decline → server nulls `runProposal`) unmounts the component, discarding `hasAccepted` for free. No manual reset effect added (AC #3).
- No new imports needed — `useState` was already imported at the top of `ControllerScreen.tsx`.
- No `packages/**`, `apps/simulation-server/**`, or `apps/host-client/**` files touched — single-file change confined to the Allowed paths.
- Verification performed: full monorepo `npm run typecheck` (0 errors) and a production `vite build` of `apps/mobile-controller` (succeeds, no runtime import/type errors). This sandbox has no browser-automation or physical-device tooling available, so the literal 2+-phone tap-through in "Required tests" was not executed by the agent — the code path was instead verified by direct trace against the acceptance criteria and by mirroring the already-shipped `BondCard` pending-button convention line-for-line. Recommend a quick real-device/browser tap check before merge to close that gap.
- Confidence: 85% — the change is a narrow, single-component visual/state addition that exactly mirrors an existing, already-verified pattern (`BondCard`) and passes full typecheck + production build; the 15% gap is the unexecuted live tap-through smoke test noted above.

### File List

- `apps/mobile-controller/src/screens/ControllerScreen.tsx` (modified — `VotePopup` pending-state Accept button)
