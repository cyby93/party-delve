# ADR-0007: Abandon-Run Vote Contract

## Status

Accepted

## Context

`TODO.md` (user notes, worked through via `gds-correct-course` on 2026-08-03) asked for a way to leave an in-progress dungeon run and return everyone to the hub. No such path exists today: `session.phase` (`packages/shared-types/src/session.ts:9`) only transitions `'dungeon'` → `'hub'` via `run:complete` (victory) or a full-party defeat — both are outcomes of playing the run to its end, not a voluntary exit.

The project already has a precedent for a party-wide decision: starting a run requires a unanimous vote (`RunProposal`, `run:propose` / `run:vote` / `run:starting`, `GameRoom.ts:198-248`). The user chose (2026-08-03) to reuse that same unanimous-consent shape for leaving a run, rather than letting any single player end the run for the whole party unilaterally, and chose to allow the abandon vote at any time — including during an active boss encounter, with no phase-gating.

`RunProposal`'s existing payload (`biome`, `difficulty`) has no meaning for an abandon request, so this is modeled as its own proposal type rather than overloading `RunProposal`.

## Decision

Add a second, independent unanimous-vote contract, parallel to but distinct from the run-start vote:

- **Mobile → server:** `run:abandon-propose` (no payload — any player currently in `session.phase === 'dungeon'` may propose), `run:abandon-vote` (`{ accept: boolean }`)
- **Server → all clients (broadcast delta):** `run:abandoned` — signals unanimous accept; `session.phase` transitions directly to `'hub'`, dungeon state is cleared, player positions reset to hub spawn. No reward/post-run screen is shown — this is a bail-out, not a completion.
- A decline from any single player, or a disconnect during the vote, cancels the proposal — same resolution semantics as the existing `run:vote` (`GameRoom.ts:239-248`'s decline-clears-proposal pattern).
- No phase guard blocks the proposal during a boss encounter — allowed at any point in `'dungeon'` phase, per explicit user direction.

`AbandonProposal` is tracked as its own `gameState` field, separate from `runProposal`, so an abandon vote in flight can never be confused with (or clobber) a run-start vote, and vice versa.

## Consequences

Positive:
- Reuses an established, already-understood UX pattern (`VotePopup`-style accept/decline) instead of inventing a new interaction model.
- Additive only — no existing message shape changes, no reconnect/session-lifecycle surface touched.
- Clean phase transition: `'dungeon'` → `'hub'` directly, symmetric with the existing `'lobby'` → `'hub'` and `'post-run'` → `'hub'` transitions already in `apply-delta.ts`.

Negative / trade-offs:
- A second parallel proposal-tracking field (`abandonProposal` alongside `runProposal`) is a small duplication of the vote-resolution pattern rather than a generalized "any proposal" abstraction. Accepted for now — generalizing two call sites into a framework is premature; revisit if a third vote type is ever needed.
- Allowing abandon mid-boss-fight (no phase gate) means a party can walk away from a boss they're losing with no penalty beyond losing run progress. This is an explicit design choice, not an oversight.

## References

- `sprint-change-proposal-2026-08-03.md`
- Existing precedent: `run:propose` / `run:vote` / `run:starting` (`GameRoom.ts:198-248`, `packages/net-protocol/src/messages/mobile-to-server.ts`)
- Stories 4.15a/4.15b/4.15c (`epics.md`, "Epic 4 Correction: Abandon-Run Vote")
