---
title: 'Add Kill Boss debug button to DungeonScreen'
type: 'feature'
created: '2026-07-06'
status: 'done'
route: 'one-shot'
---

## Intent

**Problem:** The debug "Kill All" button in `DungeonScreen` doesn't kill the boss, making it impossible to test the boss defeat sequence without playing through the full fight. A `debug:kill-boss` server handler already exists but has no UI.

**Approach:** Add `sendDebugKillBoss` to `HostSession` and wire a "Kill Boss" button that sends the existing message. The button is gated to boss level only and hidden after defeat.

## Suggested Review Order

- [`apps/host-client/src/session/host-session.ts:12`](../../apps/host-client/src/session/host-session.ts) — interface + impl addition (2 lines)
- [`apps/host-client/src/screens/DungeonScreen.tsx:595`](../../apps/host-client/src/screens/DungeonScreen.tsx) — button render with level + defeat guards

## Spec Change Log

- Adversarial review found: button showed on non-boss levels and after defeat. Fixed: added `levelIndex === 4 && !bossDefeatedRef.current` guard.
