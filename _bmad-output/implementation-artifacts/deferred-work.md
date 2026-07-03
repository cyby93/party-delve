# Deferred Work

Items surfaced during reviews that are real findings but pre-exist the triggering change or are out of scope for the current story. Each entry records the source story, the finding, and why it was deferred.

---

## From INFRA-001 — cascade auto-advance (2026-06-13)

**D1 — All-failed terminal state not handled in dispatch loop**
The loop exits when all shards are `status: complete OR failed`, but the "After All Developer Shards Complete" block only handles the all-complete case. A mixed or all-failed outcome routes to `step-04-merge.md` with no meaningful content. Pre-existing gap in the loop termination condition.

**D2 — EnterWorktree failure leaves shard in `pending`, loop may spin**
If `EnterWorktree` fails, the shard is never updated out of `pending`. On the next iteration the same shard is selected again, creating an infinite dispatch attempt. No error branch after step 2. Pre-existing.

**D3 — Retry ([R]) produces duplicate Phase Log entries**
When a user retries a shard, the agent appends a second Phase Log entry for the same role. "Latest entry" heuristic is sufficient in the happy path but accumulates noise across multiple retries. Needs Phase Log entry anchoring or shard-scoped markers. Pre-existing Phase Log design issue.

**D4 — Micro-shard confidence not included in final summary**
Micro-shards are created dynamically and are not in the original pipeline order list. The summary is undefined for them — include, exclude, or fold into parent shard's confidence? Needs a micro-shard tracking strategy.

**D5 — ExitWorktree failure after agent completion causes re-dispatch**
If `ExitWorktree` fails, the worktree stays open. The shard's status hasn't been written yet (step 7 runs after step 5). Next loop iteration selects the same shard and attempts `EnterWorktree` on an already-open branch. Pre-existing.

**D6 — No timeout or max-retry count on HALT responses**
If a session is closed mid-HALT and resumed, the workflow manager has no persisted "paused at HALT" state in the story file. It re-enters the loop and potentially re-dispatches completed shards. Needs a `dispatch_state: paused` field in story frontmatter or similar.

**D7 — Confidence tag format tolerance**
The `[confidence: N%]` tag is matched literally. Minor format variations (`[Confidence: 85%]`, `[confidence: 85 %]`) cause a false missing-tag HALT. A normalization step or regex tolerance note would prevent unnecessary interruptions. Pre-existing.

---

## From root-dev-script — add dev script to root package.json (2026-06-22)

**D15 — No startup ordering guarantee**
When packages evolve to ship compiled output rather than raw TypeScript source, `host-client` and `mobile-controller` may boot before workspace packages are ready. The `dev` script encodes no ordering guarantee. Pre-existing structural concern; not triggered by current scaffold.

**D16 — `backend-platform` always started in `npm run dev`**
Phase 2 (Local Party MVP) keeps cloud off the critical path, but `backend-platform` is included in the root `dev` command. Developers who only want local gameplay must have Redis available. Consider splitting into `dev:local` (sim + host + mobile) and `dev:full` in a later story.

**D17 — No `engines.npm` field**
The `-w` workspace flag requires npm ≥ 7. The project has no `engines.npm` constraint, so a developer on an older npm gets a confusing failure. Pre-existing.

---

## Deferred from: code review of 1-1-monorepo-architecture-clean-slate-and-package-scaffold (2026-06-22)

**D8 — `deserialize<T>` unsafe cast** (`packages/net-protocol/src/serialize.ts`)
`JSON.parse` returns `unknown`; casting directly to `T` is a false type-safety guarantee — a malformed payload silently passes the type checker. Acceptable for Phase 1. Add schema validation (e.g. Zod) in Phase 5 when the wire protocol is finalized.

**D9 — `deserialize` error leaks raw input** (`packages/net-protocol/src/serialize.ts`)
The thrown `SyntaxError` includes the first 80 characters of the raw input, which could leak network payload content into logs. Game input is not sensitive in Phase 1; revisit if PII or auth tokens ever flow through this path.

**D10 — `simulation-server` missing `start` script** (`apps/simulation-server/package.json`)
No `"start": "node dist/index.js"` script defined. Needed for production deployment gate. Deferred to Story 1.2, which defines the actual server implementation and entrypoint.

**D11 — `DeltaEventMsg` missing `tick` field** (`packages/net-protocol/src/messages/server-to-host.ts`)
All delta event variants lack a `tick: number` field, so clients cannot order or deduplicate out-of-order events. Not needed until Phase 5 (prediction/reconciliation). Ticket for Story 5.x.

**D12 — `@colyseus/ws-transport` not a declared dependency** (`apps/simulation-server/package.json`)
Colyseus 0.17 requires an explicit transport to be registered at server construction; without it, the server throws at startup. No runtime exists in Story 1.1 (scaffold only). Deferred to Story 1.2.

**D13 — `runSeed: number` wrong type for xoshiro128++** (`packages/shared-types/src/session.ts`)
xoshiro128++ needs 4×32-bit unsigned integer state; a plain `number` (IEEE 754 double) loses precision above 2^53, silently corrupting deterministic replay for large seeds. Deferred to Story 3.1 when the PRNG is implemented — change type to `Uint32Array` or encode as four separate fields.

**D14 — `@colyseus/redis-presence` in production `dependencies`** (`apps/simulation-server/package.json`)
This package attempts a Redis connection on import. In Phase 1 local mode, no Redis is available. Should be optional (environment-gated) or moved to `devDependencies`. Deferred to Story 1.2.

---

## Deferred from: code review of dev-1-mobile-controller-network-binding (2026-06-30)

**D18 — Hostname fallback wrong for multi-machine setups** (`apps/mobile-controller/src/session/mobile-session.ts`)
`window.location.hostname` is the correct fallback when Vite and the sim server share the same dev machine. If they run on different machines, the fallback silently points to the wrong host. By design — `VITE_SIM_URL` is the override for non-standard topologies. Not a regression from the old behavior.

**D19 — `LobbyScreen.tsx` has its own `SIM_URL` constant** (`apps/host-client/src/screens/LobbyScreen.tsx`)
Separate `const SIM_URL` in the host client used for the `/local-ip` HTTP fetch. Intentional — host client always runs on the same machine as the sim server, so `localhost` is correct there. Undocumented duplication; a future rename could miss it.

**D20 — `SIM_URL` module-level constant goes stale if phone roams mid-session** (`apps/mobile-controller/src/session/mobile-session.ts`)
Evaluated once at import time. If a phone changes network mid-session the stored URL becomes unreachable. Inherent limitation; the reconnect token is also invalidated at that point, so the failure mode is not worse than the existing reconnect path.

---

## Deferred from: code review of 1-2-simulation-server-session-lifecycle-and-30hz-tick-loop (2026-06-22)

**D18 — onLeave re-entrant during 30s grace window** (`GameRoom.ts:onLeave`)
Two concurrent `allowReconnection` coroutines can run for the same player if they disconnect, partially reconnect, and drop again during the grace window. Second coroutine's broadcast and player-removal race with the first. Needs a `pendingReconnect: Set<string>` guard. Story 1.6 reconnect hardening.

**D19 — onDispose fires while allowReconnection promise is suspended** (`GameRoom.ts:onDispose`)
`onDispose` clears the timer but does not cancel in-flight `allowReconnection` promises. When grace expires, the catch block calls `this.broadcast()` and mutates `this.gameState` on a disposed room — no-op at best, throws at worst. Add a `disposed` flag checked before any broadcast/state write in the catch. Story 1.6.

**D20 — onJoin broadcasts full snapshot to all clients** (`GameRoom.ts:onJoin`)
Spec-compliant per AC2 ("broadcast to all clients") but asymmetric with the reconnect path (unicast). At 8 players, the 7th and 8th joins each broadcast a full state snapshot to all peers — quadratic cost during lobby fill. Revisit in Story 1.5 when the lobby join flow is built out.

**D21 — Math.random() for runSeed produces signed int32 range** (`GameRoom.ts:onCreate`)
`(Math.random() * 0xFFFF_FFFF) | 0` coerces to signed int32 — range is [-2^31, 2^31-1], not [0, 2^32-1]. If xoshiro128++ downstream code ANDs with `0xFFFF_FFFF` it will disagree for negative values. Story 3.1 replaces this with a proper `crypto.getRandomValues` seed.

**D22 — Redis presence failure is silent at startup** (`apps/simulation-server/src/index.ts`)
`RedisPresence` connects lazily; the server starts successfully even if Redis is unreachable. First room operation that uses presence will fail silently. Add a startup health check (e.g., `ping`) or at minimum a warning log. Operational hardening out of Phase 1 scope.

**D23 — Snapshot passes live mutable gameState reference to serialize()** (`GameRoom.ts:tick`)
`{ type: 'snapshot', state: this.gameState }` passes the live reference. `serialize` is `JSON.stringify` (synchronous) so no race exists today. If `broadcast` ever becomes async or buffered, the next tick mutates `gameState` before serialization completes. Shallow-copy the snapshot before passing to `serialize`. Phase 5 concern.

**D24 — All players default to SessionColor.RED and PlayerClass.STONEHIDE** (`GameRoom.ts:createPlayer`)
All players in a session get identical color and class defaults. Host HUD will show duplicate RED STONEHIDE slots. Color and class should be assigned from a pool (indexed SessionColor values) and taken from the join request. Epic 2 class selection story.

**D25 — setInterval at 33.33ms (non-integer) — tick drift** (`GameRoom.ts:onCreate`)
`1000 / TICK_RATE_HZ = 33.333...` ms; Node.js coerces to 33ms, losing ~0.333ms per tick. Over 30 seconds that is ~10ms cumulative drift from wall clock. Use `process.hrtime.bigint()` self-correcting loop for Phase 5 reconciliation accuracy.

**D26 — hostId never set in SessionState** (`GameRoom.ts:createEmptyGameState`)
`hostId` is initialized to empty string and never updated. The first joiner should be recorded as host. Currently no client can identify the host for kick/transfer logic. Story 1.3 (host client bootstrap) is the natural place to set this.

**D27 — No InputEventMsg round-trip contract test** (`tests/contract/net-protocol.test.ts`)
The mobile→server wire contract (InputEventMsg) has no round-trip test. AC9 minimum is met (SnapshotMsg tested). Add in Story 1.5 when input processing is wired.

**D28 — inputQueue has no per-client depth cap** (`GameRoom.ts:onMessage`)
A flooding client can push thousands of InputEventMsg entries between 33ms ticks. Currently the queue is drained immediately each tick (no processing), so the risk is heap exhaustion in the 33ms window. Add a per-client drop policy (e.g., last-write-wins, depth=1) when input processing is wired in Story 1.5.

**D29 — EventNames routing not covered by contract tests** (`tests/contract/net-protocol.test.ts`)
Contract tests verify serialize/deserialize codec but not EventNames dispatch keys. A rename of `EventNames.INPUT` or `EventNames.SNAPSHOT` would silently break `onMessage` registration and broadcast calls without failing any test. Add routing tests when net-protocol contract coverage is expanded.

**D30 — Source files created with executable bit 100755** (`logger.ts`, `GameRoom.ts`)
Both new TypeScript source files have the executable bit set (WSL filesystem umask behavior). No runtime impact. Should be 100644. Fix with `chmod 644` if it causes CI issues.

---

## Deferred from: code review of 1-3-host-app-main-menu-and-lobby-screen (2026-06-22)

**D31 — Host `onLeave` not tracked; hostId not cleared on disconnect** (`apps/simulation-server/src/rooms/GameRoom.ts`)
`onLeave` checks `if (!player) return` — the host is never in `gameState.players`, so host disconnects are silently ignored. A second client can claim `hostId` mid-session. Story 1.6 reconnect scope.

**D32 — `applyDelta` stub drops `player:left` deltas — ghost slots persist up to 5s** (`packages/net-protocol`)
Server sends `player:left` delta on consented leave; host client applies the stub no-op, player remains in UI until next periodic snapshot (SNAPSHOT_INTERVAL_S = 5s). Documented known limitation per story Dev Notes; real applyDelta in Phase 2 delta story.

**D33 — Double-serialization risk: Colyseus may re-encode string payload** (`apps/host-client/src/session/host-session.ts`)
Server calls `serialize(snapshot)` then `client.send(event, serializedString)`. If Colyseus treats the second arg as an arbitrary value and JSON-encodes it again, client receives a JSON-string-of-a-JSON-string. Confirmed working in smoke test; revisit if serialization breaks after Colyseus version bumps.

**D34 — Snapshot broadcast storm on rapid multi-player joins** (`apps/simulation-server/src/rooms/GameRoom.ts`)
N concurrent joins each trigger a full broadcast to all N clients (O(N²) snapshot messages). Pre-existing from Story 1.2 (D20). Optimize when lobby is fully built in Story 1.5.

**D35 — `onError` after lobby transition has no visible error surface in lobby UI** (`apps/host-client/src/App.tsx`)
`setError` only renders in `MainMenuScreen`. If server drops after screen transitions to lobby, host has no visual indicator. Story 1.6 reconnect/error recovery scope.

**D36 — App unmount doesn't call `session.disconnect()`** (`apps/host-client/src/App.tsx`)
No cleanup effect on `session`. In practice App never unmounts (SPA); StrictMode double-mount in dev could create an orphaned room. Low risk; add cleanup if StrictMode double-invoke causes issues during development.

**D37 — `PlayerSlot` renders truncated session ID instead of display name** (`apps/host-client/src/components/PlayerSlot.tsx`)
AC 3 says "display name" but `PlayerState` has no `displayName` field. Current impl uses `player.id.slice(0, 8)`. Deferred until Protocol Architect adds `displayName: string` to `PlayerState` (Story 1.4 or dedicated Protocol story).

**D38 — `sendStartGame` uses raw string `'host:start'` instead of `EventNames` enum** (`apps/host-client/src/session/host-session.ts`)
Project rule requires `EventNames` for all message types, but `EventNames` has no `HOST_START` entry. Adding it requires Protocol Architect approval (`packages/net-protocol/**`). Deferred to Protocol Architect; companion ticket for Story 1.4 or net-protocol cleanup story.

## Deferred from: code review of 1-4-mobile-app-guest-join-flow (2026-06-23)

**D1 — isHost flag unauthenticated / host slot overwriteable** [GameRoom.ts:onJoin]
Any client can send `{isHost:true}` to claim host privileges; a second such client silently overwrites `hostId`. Pre-existing Story 1.3 gap — address in security hardening pass before Phase 2.

**D2 — No onLeave handling for host client** [GameRoom.ts:onLeave]
When the host disconnects, `hostId` remains stale and the room becomes unrecoverable. Pre-existing Story 1.3 gap — address in Story 1.6 reconnect flow.

**D3 — Serialization errors silently discarded in mobile-session.ts** [mobile-session.ts]
Malformed SNAPSHOT or DELTA messages are caught and ignored with no telemetry or error callback. Wire to telemetry/error surface in QA telemetry story.

**D4 — room.leave() does not remove onMessage/onError listeners** [mobile-session.ts]
Stale message handlers from a disconnected session persist in memory; will cause state contamination when reconnect flow (Story 1.6) is implemented.

**D5 — window.location.search re-evaluated on every render** [SessionCodeEntryScreen.tsx]
`urlCode` is computed at top of function body rather than in a useMemo/useRef. Harmless in practice since `useState(urlCode)` only uses the initial value; refactor opportunity.

**D6 — isSuccess dead state if parent never transitions** [SessionCodeEntryScreen.tsx]
If the parent's navigation call after `joinSession` is ever removed or deferred, the user is permanently stuck on a green Join button with no retry path. Latent refactor risk.

**D7 — Missed initial snapshot race on sub-ms RTT** [mobile-session.ts]
Server broadcasts snapshot synchronously in `onJoin`; client registers `onMessage` handlers after `await joinById` resolves. In practice Colyseus SDK buffers messages, but verify under local loopback conditions before Phase 2.

**D8 — StrictMode double-invocation on OrientationPromptScreen** [OrientationPromptScreen.tsx]
`onDismiss` fires twice in dev when device is already in landscape (StrictMode remounts the effect). Currently idempotent (`setScreen` called twice is fine); address if side effects are added to dismiss path.

**D9 — displayName XSS surface at server boundary** [GameRoom.ts:onJoin / PlayerSlot.tsx]
`playerName` is stored raw in GameState and broadcast. Safe in React JSX text nodes, but adding sanitization (length cap + strip control chars) at the server boundary before any non-React rendering is used.

**D10 — displayName field added without schema migration note** [shared-types/src/player.ts]
`displayName: string` is required with no optional marker. No persisted/replayed state exists in Phase 1 so this is safe now; document migration strategy before Phase 3 replay work.

**D11 — @colyseus/sdk patch range ^0.17.43 couples error behavior to patch releases** [mobile-controller/package.json]
`joinById` rejection vs. `onError` semantics can differ across 0.17.x patches. Pin the version when planning 0.18 migration.

**D12 — simulateOnJoin duplicates production onJoin logic** [game-room-host-join.test.ts]
Tests re-implement rather than call the real `GameRoom.onJoin`, so production divergence won't break them. Pre-existing Story 1.3 test architecture — refactor when integration test harness is available.

**D13 — NFR2 (10-second lobby appearance) has no timeout detection** [AC5]
No mechanism detects or recovers when a player slot doesn't appear within 10 seconds. Address in QA/telemetry story with latency measurement.

---

## Story 1.4 — Round 2 Review Deferred Findings

**D14 — Host role unauthenticated; any client can overwrite hostId** [GameRoom.ts:onJoin]
No guard on `this.gameState.session.hostId !== ''` before assigning a new hostId. A malicious or mis-configured client sending `{ isHost: true }` after the host joins overwrites the privileged seat. Address in server auth hardening (Phase 5 scope).

**D15 — iOS Safari BFCache thaw leaves join screen permanently loading** [SessionCodeEntryScreen.tsx]
When the page is frozen to BFCache mid-`joinById()` and later thawed, the promise is dead but `isSubmittingRef.current` stays `true`. No `pageshow`/`pagehide` handler resets the state. Address in connectivity/reconnect story or iOS-specific platform testing pass.

**D16 — App unmounts during in-flight joinSession leaves orphaned WebSocket** [App.tsx]
If `App` unmounts while `joinSession()` is awaiting, the cleanup effect captures `session=null` (noop), then the resolved session is `setSession(s)`-called on the dead component. `s.disconnect()` is never called. Player slot lingers until server 30s grace expires. Address with a `mountedRef` guard in Story 1.6 or platform hardening.

**D17 — No `room.onLeave` handler; server-initiated disconnects are invisible to UI** [mobile-session.ts]
After join, if the server forces a disconnect (`client.leave()`, room disposal, game end), `room.onLeave` fires but no callback is wired. User is stranded on ControllerScreen with a dead session. Address in Story 1.6 disconnect/reconnect flow.

**D18 — StrictMode fires `onDismiss()` twice when phone already in landscape on mount** [OrientationPromptScreen.tsx]
Dev-only. React 18 StrictMode re-runs effects after cleanup; the immediate-dismiss guard `if (mq.matches) { onDismiss(); return; }` doesn't prevent the second call. `setScreen('controller')` is idempotent so no user-visible impact. Document or add a ref guard if double-invocation causes issues in future animation work.

**D19 — `room.leave()` callable multiple times; Colyseus SDK accumulates dead handlers** [mobile-session.ts]
`room.leave()` pushes a new `onLeave` handler to the EventEmitter array each call. Not deduplicated or cleared. Becomes a concern in Phase 5 reconnect teardown where `leave()` may be called as part of reconnect handshake. Wrap with a called-once guard when reconnect is implemented.

**D20 — Short sessionId (< 6 chars) would not behave as documented in displayName fallback** [GameRoom.ts]
`client.sessionId.slice(-6)` on a string shorter than 6 chars returns the full string (no error). Colyseus currently always generates 9-char IDs via nanoid. Guard is not needed now but should be verified when Phase 5 auth providers are wired in.

---

## Deferred from: code review of 1-5-hub-world-bootstrap-and-player-presence (2026-06-23)

**D21 — slotIndex collision after player disconnects — color/spawn reuse** [apps/simulation-server/src/rooms/GameRoom.ts:100]
`slotIndex = this.gameState.players.length` is computed after every disconnect shrinks the array. A new joiner inherits a slot index already used by an existing player, colliding on `SESSION_COLORS` and `SPAWN_POSITIONS`. Story 1.6 must use a slot-reservation map instead of array length.

**D22 — isDown/isSpirit flags not checked before applying movement** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
Only `isFrozen` is tested in the movement loop. `isDown` and `isSpirit` players should also be immobile. Not meaningful in Story 1.5 scope (no combat); address in Story 3.x with the full player FSM.

**D23 — sendInput closure captures stale room reference post-reconnect** [apps/mobile-controller/src/session/mobile-session.ts:sendInput]
`sendInput: (msg) => room.send(...)` closes over the `room` object at join time. After reconnect, a new `room` object exists but `sendInput` still references the old one. Needs the same `sessionRef` pattern used in `ControllerScreen`. Address in Story 1.6 reconnect flow.

**D24 — Stop event silently dropped when session is null on touchend** [apps/mobile-controller/src/screens/ControllerScreen.tsx:stopJoystick]
If `sessionRef.current` is null when touch ends, the zero-vector stop message is never sent. The character keeps moving at last known velocity on the server until the next snapshot overwrites state. Story 1.6 reconnect scope.

**D25 — applyDelta creates new state object for unknown playerId** [packages/net-protocol/src/apply-delta.ts]
`player:moved` with an unrecognized `playerId` returns a new `{ ...state, players }` even though nothing changed. Any equality-based memoization sees a new reference and triggers a re-render. Add an early-return guard `if (!state.players.some(p => p.id === evt.playerId)) return state`. Low priority optimization.

**D26 — useEffect touch listener re-registration if sendJoystick/stopJoystick identity changes** [apps/mobile-controller/src/screens/ControllerScreen.tsx:133]
Both callbacks are stable (`useCallback` with `[]` deps) today, so the effect runs once. If a future developer adds a dep to either callback, listeners are torn down and re-added mid-touch. Currently safe; add a comment warning against adding deps.

---

## Deferred from: code review of 1-6-disconnect-grace-period-and-reconnect-flow (2026-06-24)

**D27 — `nextSlotIndex` unbounded — spawn falls back to center after slot 7** [apps/simulation-server/src/rooms/GameRoom.ts:110]
`nextSlotIndex` increments monotonically and is never reclaimed after grace expiry. `SESSION_COLORS` wraps via `%` (correct), but `SPAWN_POSITIONS` uses `?? fallback` to center-stage for indices ≥ 8. In a revolving-door session (joins, grace expires, new joins), cumulative joiners beyond slot 7 all spawn at the center. Bounded by room lifetime and `MAX_PLAYERS` concurrent constraint. Revisit with a free-slot recycling map when Phase 2 combat introduces meaningful spawn positioning.

**D28 — Mobile client applies `player:disconnected` delta to its own `gameState`, freezing itself** [packages/net-protocol/src/apply-delta.ts]
Server broadcasts `player:disconnected` to all clients including the disconnecting player's new connection. Mobile `handleDelta` → `applyDelta` sets `isFrozen: true` on the local state for the player's own ID. No UX impact in Phase 1 (controller screen doesn't render `isFrozen`), but will cause incorrect controller state in Phase 2 when the controller reflects player status. Filter out self-targeted disconnect/reconnect deltas at the mobile layer, or document the invariant clearly.

**D29 — "Rejoin as New Player" navigates to session-entry without pre-filling the room code** [apps/mobile-controller/src/App.tsx:79]
AC4 specifies "navigate to session-entry with room code pre-filled" as the primary behavior. The implementation takes the minimum fallback (bare navigation). `reconnectRoomId` is already in `App` state and can be passed to `SessionCodeEntryScreen` as an initial value. Defer to UX polish pass.

**D30 — Network indicator dot same color for `idle` and `connecting` states** [apps/mobile-controller/src/screens/ReconnectScreen.tsx:57]
Both idle ("Connection lost") and connecting ("Reconnecting…") show `var(--accent-warm)`. Only error gets `var(--corruption-blood)`. A pulsing animation or distinct color (e.g., `var(--accent-cool)`) for the connecting state would give clearer feedback. Defer to UX polish pass.

## Deferred from: code review of 1-7-epic-1-deferred-hardening (2026-06-24)

**D-1.7-A — initialCode useState seeding is mount-time only** [apps/mobile-controller/src/screens/SessionCodeEntryScreen.tsx:28]
`useState(initialCode ?? urlCode)` reads the prop only on first mount. If SessionCodeEntryScreen ever stays mounted while `initialCode` changes (e.g., an in-place error-retry-with-prefill flow), the field won't update. Current nav graph forces remounts on screen transitions so this is latent. Recommended hardening: add `key={sessionEntryInitialCode ?? 'manual'}` to force remount, or sync via `useEffect([initialCode])`.

**D-1.7-B — sessionEntryInitialCode could leak to future session-entry renders** [apps/mobile-controller/src/App.tsx:22]
`sessionEntryInitialCode` is only cleared in `handleGuestContinue` (auth-choice → session-entry). If a future story adds a back-to-menu or logout path reachable after first navigation, the stale reconnectRoomId-derived code silently pre-fills the field with a dead room id. Recommended hardening: clear `sessionEntryInitialCode` in `handleJoin` on success.

---

## Deferred from: code review of 2-1-hub-world-poi-layout-and-interact-button (2026-06-24)

**D-2.1-A — Missing poi-exited delta when player transitions directly between overlapping POIs** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
When `player.nearPoiId` transitions from POI-A to POI-B in the same tick (i.e., both are non-null and different), only a `poi-entered` delta for POI-B is broadcast — no `poi-exited` for POI-A. On the client, `applyDelta` overwrites `nearPoiId` with the new POI, which is correct end-state, but a strict delta stream would include the exit first. Not triggered today because `INTERACTIVE_HUB_POIS` has 2 entries placed far apart ("POIs don't overlap" is a stated design invariant). Revisit if overlapping POI zones are ever introduced in later epics.

---

## Deferred from: code review of 2-2-class-selection-flow-card-browse-and-selection (2026-06-24)

**D-2.2-A — stopJoystick not called on ControllerScreen unmount** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
The joystick `useEffect` cleanup removes touch listeners but does not call `stopJoystick()` to send a zero-vector stop message. If the screen unmounts while joystick is held (e.g., during disconnect), the sim server holds the last non-zero input vector until its own timeout. Pre-existing gap from Story 1.5; address in Story 1.6 follow-up or when ControllerScreen lifetime management is revisited.

**D-2.2-B — Object.values(CLASS_DEFINITIONS) display order is implicit insertion-order** [packages/shared-types/src/class-definitions.ts]
Card row order depends on V8 object insertion order (STONEHIDE → SPIRITCALLER → SOULDRINKER → STORMCALLER). V8 guarantees this for string keys, but the ordering is a hidden invariant. Consider an explicit `const CLASS_ORDER: PlayerClass[]` in a future polish pass to make ordering intentional and reviewable.

**D-2.2-C — WebkitOverflowScrolling:'touch' deprecated** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
`-webkit-overflow-scrolling: touch` is a no-op on iOS 13+. Harmless; verify scroll momentum behavior on minimum supported iOS version before removing.

**D-2.2-D — scrollSnapType + alignItems:center may misfire on panel-open resize** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
When the ability panel opens and the card area height changes mid-drag, `scrollSnapType: 'x mandatory'` may snap to an incorrect center point. Browser-specific; verify on target device range during QA.

**D-2.2-E — Ability panel missing aria-hidden/inert when translated off-screen** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
The panel div is always in the DOM (translated 100% off-screen when closed); assistive technology may reach the panel container when it is not visible. A11y out of scope for Phase 2; address in accessibility pass before launch.

## Deferred from: code review of 2-4-training-dummy-poi (2026-06-24)

**D-2.4-A — Reconnect clears client cooldowns but server retains cooldownMap entries** [apps/mobile-controller/src/App.tsx:116]
On reconnect, `setCooldowns([null,null,null,null])` resets all client-side cooldowns, but the server's `cooldownMap` retains live expiry timestamps. If a player reconnects mid-cooldown the client shows all abilities as ready; the server silently drops fire attempts until expiry. Acknowledged in story Dev Notes §Existing Code as acceptable for Story 2.4 (hub-only training dummy). Address in Story 3.x when cooldowns persist into dungeon runs.

**D-2.4-B — RELEASE ability can fire in React render gap after trainingDummyActive cleared** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
When the player leaves the training dummy, `setTrainingDummyActive(false)` dispatches but effect cleanup runs after the next render. An in-flight RELEASE thumb-lift occurring in that window fires `onAbilityFire`. Sub-frame window (~0–16ms); server validates nearPoiId and may accept or reject depending on tick timing. No user-visible corruption.

**D-2.4-C — flashUntil alpha animation only progresses on gameState updates** [apps/host-client/src/screens/HubWorldScreen.tsx:~77]
The class-confirmation flash (600ms alpha pulse) is driven by `renderFrame`, which only runs when `gameState` changes. With no player movement the flash freezes between renders. Story 2.3 scope visible in this diff; fix in a dedicated host animation pass (add `requestAnimationFrame` loop or polling effect).

**D-2.4-D — Same-tick movement+ability can silently drop ability input** [apps/simulation-server/src/rooms/GameRoom.ts:~216]
If a player is at the edge of the training dummy's proximity radius, a joystick input in the same tick as an ability input can move them outside the radius before the ability handler's `nearPoiId` check, silently dropping the ability. Negligible in casual couch gameplay; address when POI interaction precision matters (Story 3.x dungeon combat).

**D-2.4-E — Non-integer abilityIndex bypasses bounds check** [apps/simulation-server/src/rooms/GameRoom.ts:~290]
The `abilityIndex < 0 || abilityIndex > 3` check allows floats like `1.5`. `playerCooldowns[1.5]` writes a non-integer property that the expiry loop never iterates, leaking the entry. Typed mobile client prevents this in practice; add `Number.isInteger(abilityIndex)` guard in Story 3.x when ability inputs are expanded.

## Deferred from: code review of 2-5-server-persistent-joystick-vector (2026-06-24)

**D-2.5-A — Host client INPUT can populate `lastKnownJoystick` permanently** [apps/simulation-server/src/rooms/GameRoom.ts:onLeave:162]
The `onLeave` early-return guards on `gameState.players` membership, so the host's entry is never deleted. In practice the host client never sends INPUT events; becomes a correctness issue if that constraint is ever relaxed.

**D-2.5-B — Joystick object stored by reference, not shallow-copied** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
`this.lastKnownJoystick.set(clientId, msg.event.joystick)` stores the original reference. Safe with the current JSON-string deserialization path; theoretical concern with zero-copy msgpack decoders.

**D-2.5-C — AC6 test exercises a replica of tick() logic, not real GameRoom.tick()** [apps/simulation-server/tests/game-room-host-join.test.ts]
`simulateMovementTick` is a hand-rolled mirror of the tick logic — production changes to `GameRoom.ts` won't break the test unless the helper is also updated. Matches the pre-existing `simulateOnJoin` test architecture. Revisit if a proper integration test harness becomes available.

**D-2.5-D — Reconnect sessionId Colyseus assumption unverified** [apps/simulation-server/src/rooms/GameRoom.ts:onLeave]
`allowReconnection` is assumed to preserve the same `sessionId` (Colyseus contract), but this is never tested in the suite. An edge case where Colyseus assigns a new sessionId on reconnect would leave a stale `lastKnownJoystick` entry.

**D-2.5-E — Deadband threshold 0.05 hardcoded in both GameRoom.ts and test helper** [apps/simulation-server/src/rooms/GameRoom.ts:tick(), tests/game-room-host-join.test.ts]
Pre-existing magic number with no named constant. Changing it in one place without updating the other causes test/production divergence. Extract to a named constant when the movement system is moved to game-rules in Story 3.x.

---

## Deferred from: code review of 2-3-class-confirmation-and-hub-controller-transition (2026-06-24)

**D-2.3-A — React Strict Mode double-mount permanently loses class-confirmation flash** [apps/host-client/src/screens/HubWorldScreen.tsx:117-181]
In dev builds, Strict Mode mounts, unmounts, and remounts HubWorldScreen. If a `player:class-updated` delta arrives during the async PixiJS second-init window (while `pixiAppRef.current` is null), `renderFrame` is skipped. The new `PlayerEntry` is then created with `knownClass: player.class` (the confirmed class), so the flash is permanently lost for that delta. Dev-only; production does not use double-mount. Address before the first QA session that uses StrictMode-enabled host builds.

**D-2.3-B — No rate-limiting on CLASS_SELECT messages** [apps/simulation-server/src/rooms/GameRoom.ts:80-105]
Every valid `CLASS_SELECT` message triggers a `this.broadcast(EventNames.DELTA, delta)` to all clients. A malicious or buggy mobile client can spam the message, causing all connected clients to re-render `PlayerChip` and trigger flash animations repeatedly. Add a per-client rate limit (e.g., max 1 per second) in a future hardening story.

**D-2.3-C — applyDelta missing exhaustiveness guard** [packages/net-protocol/src/apply-delta.ts:59]
The `default: return state` in `applyDelta` silently no-ops for any delta type not explicitly handled (e.g., `player:downed`, `player:revived`, `enemy:moved`). TypeScript does not enforce switch exhaustiveness here — a `never` assertion on the default branch would catch missing cases at compile time. Add the guard when implementing Story 3.x delta types.

**D-2.3-D — RELEASE ability fires twice when lift occurs inside cell bounds** [apps/mobile-controller/src/screens/ControllerScreen.tsx:548-583]
For RELEASE-type abilities, both the element-level `onTouchEnd` handler and the document-level `onDocumentTouchEnd` handler fire when the lift occurs inside the cell's bounding rect. Both call `onAbilityFire`, resulting in two `sendInput` calls to the server for a single lift. The server processes both in the same tick; since the cooldown is written on the first and the second reads the same pre-write expiry, the ability fires twice with one cooldown entry. Occurs in interactive skill cell mode (training dummy). Address in Story 3.x when ability hit registration accuracy matters in dungeon combat.

**D-2.3-E — player:class-updated delta silently dropped if received before join snapshot** [packages/net-protocol/src/apply-delta.ts:53]
If a `player:class-updated` delta arrives at a client before the join-triggered snapshot has been processed (network reordering or rapid message delivery), `applyDelta` returns the unchanged state because the player does not yet exist in `state.players`. The class change is lost until the next periodic snapshot (every `SNAPSHOT_INTERVAL_S` seconds) restores the correct state. Acceptable for hub-mode class display; revisit if class state is load-bearing in Story 3.x combat.

---

## Deferred from: code review of 3-1-xoshiro128-prng-and-planckjs-physics-world (2026-06-25)

**D-3.1-A — `onLeave` catch block runs after room disposal** [apps/simulation-server/src/rooms/GameRoom.ts:onLeave]
Pre-existing architecture from Stories 1.2 and 1.6 (logged as D19). The `destroyBody` call in Story 3.1 follows the same cleanup pattern as existing mutations. Planck world is never destroyed in `onDispose` so the call is safe. Full fix requires a `disposed` flag; address in Phase 5 server hardening.

**D-3.1-B — O(n) player scan in POI contact flush loops** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
`gameState.players.find(p => p.id === playerId)` runs linearly inside the POI begin/end contact flush loops. Acceptable for ≤8 players with at most 2 active POI sensors. Replace with a `Map<string, PlayerState>` lookup if player cap grows.

**D-3.1-C — No boundary walls; `linearDamping:0` with zero gravity** [apps/simulation-server/src/physics/world.ts]
Dynamic bodies receive no clamping to the virtual world rect. A planck impulse from a player-player or player-enemy collision can send players off-map with no recovery. Bounds clamping is explicitly non-goal for Story 3.1 (deferred to 3.x per non-goals section).

**D-3.1-D — Player-player contact callbacks fire without filter bits** [apps/simulation-server/src/physics/world.ts]
Player and enemy fixtures have no `filterCategory`/`filterMask`, so planck fires `begin-contact`/`end-contact` for every player-player and player-enemy pair. `extractPoiBeginContact` returns null for these correctly, keeping pending arrays clean. O(n²) contact overhead will compound when enemies are added. Set filterCategory/filterMask on player and POI fixtures in Story 3.x.

**D-3.1-E — `nextSlotIndex` never recycled — overflow spawn at center** [apps/simulation-server/src/rooms/GameRoom.ts]
Pre-existing (already logged as D27 from Story 1.6 code review). Monotonically increasing slot index; SPAWN_POSITIONS falls back to center for indices ≥ 8. Bounded by MAX_PLAYERS concurrent limit within a session; revisit with a free-slot recycling map in Phase 2 spawn positioning work.

**D-3.1-F — `planck` dependency in `packages/game-rules/package.json`** [packages/game-rules/package.json:15]
`"planck": "1.5.0"` is present as a runtime dependency in game-rules even though no game-rules source imports it (ESLint restriction enforces this). Pre-planned entry from project setup; story Dev Notes explicitly defer removal to a cleanup task. Remove in a separate dependency hygiene story.

---

## Deferred from: code review of 3-2-enemy-ai-base-fsm-and-layered-difficulty-behaviors (2026-06-25)

**D-3.2-A — Layer ordering is implicit with no validation** [packages/game-rules/src/systems/ai/fsm.ts]
The [ChargeLayer, StompLayer] ordering for Hard difficulty is established by convention but not enforced. A caller passing [StompLayer, ChargeLayer] would produce different behavior at 80-100px range. Resolve in Story 3.3 when enemy spawn assigns layers — add a constant or factory function for each difficulty tier.

**D-3.2-B — enemy:stomped apply-delta is a no-op; no host state updated** [packages/net-protocol/src/apply-delta.ts]
`case 'enemy:stomped': return state` — the AoE slow effect on players is deferred to Story 3.4 combat system. The event round-trips correctly but clients apply no state change. Resolve when combat system is implemented.

**D-3.2-C — getEnemyCount has no guard for negative or zero playerCount** [packages/game-rules/src/balance.ts]
`Math.ceil(-1 * 1.5) = -2`. Currently only called from Story 3.3+ spawn code where playerCount >= 1. Add a guard (or assert) at the Story 3.3 call site.

**D-3.2-D — ChargeLayer "charge" is fast-walking for one tick, not a committed dash** [packages/game-rules/src/systems/ai/layers/charge.ts]
CHARGE_SPEED=400px/s at 30hz ≈ 13.3px per tick (vs CHASE_SPEED=80px/s ≈ 2.7px). The charge behavior is ~5× faster movement for a single tick with no windup or commitment. Review and tune in Story 3.4 playtesting.

**D-3.2-E — BehaviorLayer cooldowns are ephemeral instance state, not serialized** [packages/game-rules/src/systems/ai/fsm.ts + apps/simulation-server/src/rooms/GameRoom.ts]
`currentCooldown` lives on the ChargeLayer/StompLayer class instance in `enemyLayers` Map. Server restart resets all layer cooldowns to 0 (immediate charge/stomp). Resolve in Phase 5 (reconnect/persistence) by adding cooldown state to EnemyState.

**D-3.2-F — StompLayer firing while fsmState=ATTACK pauses attackCooldownTicks** [packages/game-rules/src/systems/ai/fsm.ts]
When StompLayer fires, tickAttack is skipped that tick, so attackCooldownTicks doesn't decrement. The two timers (attack cooldown, stomp cooldown) are independent. This is architecturally intentional but may produce surprising attack-cooldown freezes mid-stomp in playtesting. Review in Story 3.3 when enemies are actually spawned.

---

## Deferred from: code review of 3-3-4-alpha-class-implementations-abilities-and-input-types (2026-06-28)

**D-3.3-A — AUTO ability fires with direction (0,0) when no prior drag** [packages/game-rules/src/systems/abilities.ts / apps/mobile-controller/src/screens/ControllerScreen.tsx]
AUTO abilities pass through `ctx.directionX/Y` unchanged. On the mobile client, `lastDirX/lastDirY` initialize to `0,0` and only update once a touch moves past the 6px deadzone. If the player taps an AUTO cell without dragging, the direction sent is `(0,0)`, which `dispatchAbility` accepts and broadcasts as `AbilityFiredDelta(dirX=0, dirY=0)`. No crash or user-visible issue in Story 3.3 (no damage yet), but in Story 3.4 when directional AoE is applied, the ability will always fire "nowhere" on an untouched cell. Design decision needed: AUTO cells should likely default to the player's last movement direction. Address before Story 3.4 combat resolution.

**D-3.3-B — RELEASE ability silently drops if `isInteractive` flips false while cell is held** [apps/mobile-controller/src/screens/ControllerScreen.tsx]
The `SkillCell` `useEffect` cleanup (which runs when `isInteractive` changes) clears `activeTouchRef.current` without firing RELEASE. If a player holds a RELEASE cell while the session phase transitions (e.g., dungeon ends, AC6/run-complete), the ability is silently discarded. Pre-existing pattern (D-2.4-B covered the training-dummy variant). New manifestation: dungeon-phase `inDungeon` flag can change server-side during an active hold. Low frequency in current story scope; address in Story 3.7 (clear objective / level completion) when phase transitions from dungeon are intentional.

**D-3.3-C — DungeonScreen PixiJS canvas orphan on mid-init exception** [apps/host-client/src/screens/DungeonScreen.tsx]
If `app.canvas` is appended to the DOM but `pixiAppRef.current = app` is not yet reached when a synchronous exception fires (e.g., `resizeTo`, ticker setup), the cleanup function finds `pixiAppRef.current === null` and cannot destroy the app or remove the canvas. Very low probability in production WebGL environments. Address if test environments report phantom canvas elements, or before Phase 5 stress testing.

---

## Deferred from: code review of 3-8-login-flow-update (2026-06-29)

**D-3.8-A — useEffect `/local-ip` fetch has no retry or user-visible failure feedback** [apps/host-client/src/screens/LobbyScreen.tsx:17]
`.catch(() => {})` silently swallows errors; `mobileHost` stays `null` and the QR encodes `localhost` for the session with no indication to the user. Extremely low probability in practice (WS connection on same port 2567 guarantees the HTTP server is up when LobbyScreen renders), so not blocking for Phase 3. Add a visible warning or retry if fetch failure rate becomes observable.

**D-3.8-B — `SIM_HTTP` regex silently fails for bare-hostname `VITE_SIM_URL`** [apps/host-client/src/screens/LobbyScreen.tsx:5]
`SIM_URL.replace(/^ws(s?):\/\//, 'http$1://')` is a no-op if `VITE_SIM_URL` is set to a hostname without a `ws://` prefix — the fetch URL becomes malformed. Misconfiguration case only; the default `ws://localhost:2567` transforms correctly. Add validation or a comment when the env var documentation is formalized.

**D-3.8-C — `getLocalIp()` returns `'localhost'` silently on IPv6-only or dual-stack hosts** [apps/simulation-server/src/index.ts:12]
Hard-filters `iface.family === 'IPv4'`; on an IPv6-only LAN the fallback kicks in with no log. Rare for Phase 3 local couch play. Add a `logger.warn` in the fallback path and revisit in Phase 5 cloud deployment where network topology is more varied.

---

## Deferred from: code review of 3-4-combat-resolution-hitboxes-damage-and-spirit-essence-collection (2026-06-29)

**D-3.4-A — Direction vector not normalized before `isInHitZone`** [apps/simulation-server/src/rooms/GameRoom.ts]
`isInHitZone` uses `dirX * hitRangePx` to project the hit circle center. If the player's joystick direction has sub-unit magnitude (e.g., a light touch), the effective range is proportionally shorter. Currently masked by alpha balance values being rough placeholders. Normalize the direction before calling `isInHitZone`, or normalize inside the function, when balance tuning begins in earnest.

**D-3.4-B — React state batching may swallow `enemy:killed` transient delta** [apps/host-client/src/App.tsx, apps/host-client/src/session/host-session.ts]
If `enemy:killed` and `essence:dropped` are delivered in the same WebSocket event loop task and `setLatestTransientDelta` is called twice synchronously, React 18 batches the updates and only the last value (essence:dropped) survives. The kill-fade effect on `DungeonScreen` is silently dropped. In practice, separate WebSocket frames arrive as separate event queue tasks, making this very unlikely. Fix with a callback-per-event-type or a delta queue if kill fades become visually important.

**D-3.4-C — Kill fade raceable against periodic snapshot reconciliation** [apps/host-client/src/screens/DungeonScreen.tsx]
A periodic snapshot `applyDelta` removes the enemy from `state.enemies`; `renderFrame` then hits the `!enemy` branch and destroys the Graphics immediately, bypassing the kill fade. The kill delta is broadcast in the same tick as the snapshot but may be ordered after it on the client. In practice the snapshot interval is 2 seconds and the kill delta fires in real time, making the race window extremely narrow. Add a `isRemovedServer` flag or check `deadUntil` before hard-removing in the snapshot reconciliation path if fade fidelity matters.

**D-3.4-D — Health bar has no backing track** [apps/host-client/src/screens/DungeonScreen.tsx]
At low hp, the health bar renders a tiny red sliver with no visual reference for the bar's full extent. Add a dark-grey backing rect (`rect(-15, -32, 30, 4)`) beneath the red fill for readability on the couch screen. Visual polish — defer to the UX polish pass.

**D-3.4-E — Missing zero-damage boundary test for `applyDamage`** [tests/unit/combat.test.ts]
`applyDamage(enemy, 0, dropId)` returns `ok: true` with hp unchanged (guard is `damage < 0`, not `<= 0`). The AC7 criterion "clamps hp to 0" is covered by the overkill test, but the exact-zero-input case is unspecified and untested. Add a test if the spec ever clarifies whether `damage === 0` should be a validation error.

---

## Deferred from: code review of 3-5-player-health-revive-timer-and-downed-state (2026-06-29)

**D-3.5-A — Same-tick chain-revive is order-dependent** [apps/simulation-server/src/rooms/GameRoom.ts:683]
In the proximity revive loop, players are mutated in-place. A player revived earlier in the iteration can act as reviver for subsequent downed players in the same tick. Behavior depends on array order. Deferred: need to see the revive feature fuller in order to decide — accept as designed or disallow via a `revivedThisTick` set.

**D-3.5-B — `reviveTimerExpiresAt = 0` sentinel meaning undocumented** [packages/shared-types/src/player.ts]
The field uses `0` as a sentinel for "not downed / not active". This is safe in practice (JS `Date.now()` always returns a positive value), but nothing on the field definition documents this invariant. Any future code that compares `=== 0` vs `> 0` inconsistently could introduce a subtle bug. Add a comment `// 0 = not downed` to the field definition in a cleanup pass.

---

## Deferred from code review of 3-6-spirit-form-downed-player-contribution-and-run-failure (2026-06-29)

**D-3.6-A — `--text-muted` CSS token undefined; sub-note using `--text-secondary`** [packages/ui-kit/src/tokens.css]
AC7 specified `var(--text-muted)` for the post-run overlay sub-note but the token doesn't exist in tokens.css. Implementation uses `--text-secondary` as the nearest alternative. Deferred: not sure about --text-muted use case, might be useful later. Define `--text-muted` as a distinct dimmer text color when the design system needs it.

**D-3.6-B — Spirit ability fires on same tick as run failure** [apps/simulation-server/src/rooms/GameRoom.ts:621]
Spirit dispatch runs before the run-failure check in `tick()`. An existing-spirit player with a queued input can fire their spirit ability in the same tick that the last player transitions from downed to spirit and triggers the run-failure broadcast. The spirit ability flash is immediately covered by the post-run overlay. Cosmetically harmless tick-ordering artifact — reordering adds complexity for zero gameplay impact.

**D-3.6-B — `partialEssence` field in `RunFailedDelta` unused in `apply-delta.ts`** [packages/net-protocol/src/apply-delta.ts]
`apply-delta` sets `phase='post-run'` for `run:failed` but ignores `partialEssence`. The host overlay recomputes essence independently from `gameState.players`, which is consistent. Field is an architectural placeholder for the Epic 4 post-run summary screen where per-player breakdowns will need this value.

**D-3.6-C — Slots 0–2 spurious `COOLDOWN_UPDATE { remainingMs: 0 }` for spirit players** [apps/simulation-server/src/rooms/GameRoom.ts]
When a spirit player's class ability cooldown expires, the regular expiry loop sends `COOLDOWN_UPDATE` for slots 0–2 to the mobile. Spirit players cannot use those slots, so the messages clear irrelevant UI state. Harmless but slightly wasteful. Can be eliminated by skipping the expiry notification when `player.isSpirit` in the cooldown expiry loop.

---

## Deferred from: code review of 4-1-deterministic-seed-system-and-floor-layout-generator (2026-06-30)

**D-4.1-A — Second HOST_START from `post-run` accumulates stale enemies** [apps/simulation-server/src/rooms/GameRoom.ts:114]
Phase guard only blocks re-entry when phase is `dungeon`; firing from `post-run` pushes new enemies onto the existing (non-cleared) array. Floor layout regenerates correctly (same deterministic overwrite). The enemy accumulation bug pre-dates Story 4.1. Fix: add `|| phase === 'post-run'` to the guard, or clear `gameState.enemies` / reset `floorLayout` before re-spawning. Address in Story 4.2 (dungeon entrance vote) which owns the run restart flow.

**D-4.1-B — `floorLayout` not reset to null on phase transition to `post-run`** [apps/simulation-server/src/rooms/GameRoom.ts:792]
AC5 specifies `floorLayout === null` in lobby/hub phases. Satisfied by `createEmptyGameState`, but no reset happens on dungeon→post-run transition. No return-to-hub path exists yet so this is latent. Story 4.2 should reset `floorLayout` to null when transitioning back to hub or initializing a new run.

**D-4.1-C — `BOSS_FLOOR_LAYOUT` has `isExit: false` on its only room** [packages/game-rules/src/generation/room-pool.ts]
If Story 4.3 uses `room.isExit` to detect advancement, the boss room will never satisfy the predicate. Either set `isExit: true` on the boss room, or the advancement trigger must be "boss dead" rather than "exit room". Intentional placeholder — Story 4.3 decides.

**D-4.1-D — `Corridor` directionality not documented (directed vs. undirected)** [packages/shared-types/src/floor-layout.ts]
Generator always produces a linear chain with `{ fromRoomId, toRoomId }` pairs. No contract says whether traversal is bidirectional. Story 4.3 host render work must document or encode the assumption.

**D-4.1-E — Room y-position has no clamp to virtual 1080px space** [packages/game-rules/src/generation/floor-layout.ts]
`y` range is [440, 640) with current constants. Safe with max heightPx=350. If a future template has `heightPx > 880`, top/bottom edges clip outside the 1080px virtual space. Add a clamp when template pool is expanded.

---

## Deferred from: code review of 3-7-clear-objective-and-level-completion (2026-06-29)

**D-3.7-A — `runOutcome` never resets between sessions** [apps/host-client/src/App.tsx, apps/mobile-controller/src/App.tsx]
`runOutcome` is set on `run:complete` or `run:failed` delta receipt but never cleared. If the app stays mounted across a session transition (e.g. E4 return-to-hub), `runOutcome` will carry stale state from the previous run. Fix: reset `runOutcome` to `null` on `phase` transitioning back to `hub` or `lobby`. Deferred to E4 when return-to-hub is implemented.

**D-3.7-B — Consecutive `level:complete`→`run:complete` delta overwrites `latestTransientDelta`** [apps/host-client/src/session/host-session.ts]
Both deltas are routed to `latestTransientDelta` in `App.tsx`. React 18 should process them as separate renders (separate WS message handlers), but if they arrive in the same microtask batch the second overwrites the first and the canvas flash might be skipped. Colyseus delivers room messages in order; revisit if E4 introduces higher-frequency delta bursts where batching becomes visible.

**D-3.7-C — Server keeps dead enemies (`isAlive=false`), client removes them via `filter`** [packages/net-protocol/src/apply-delta.ts line 106]
`applyDelta('enemy:killed')` uses `.filter()`, so killed enemies are absent from `state.enemies` on the client. The server's `gameState.enemies` retains them with `isAlive=false`. Any future client-side level-clear predicate using `enemies.every(e => !e.isAlive)` would fail (vacuously passes if all killed, fails the `length > 0` guard). Document and address in E4 if client-side clear logic is needed.

**D-3.7-D — Revive timer display stale during post-run transition** [apps/host-client/src/screens/DungeonScreen.tsx]
On level clear with a downed player, `reviveTimerExpiresAt` is reset server-side before `run:complete` is broadcast, but the client's timer display reads from snapshot state which may lag by up to `SNAPSHOT_INTERVAL_S`. Cosmetic: the post-run overlay covers the HUD immediately. Address in E4 when per-level timer resets get explicit `player:downed` re-broadcasts.

**D-3.7-E — `enemies.length > 0` guard silently blocks clear on empty level** [apps/simulation-server/src/rooms/GameRoom.ts]
The level-clear predicate guards on `enemies.length > 0` to avoid a vacuous clear on dungeon start. If a future `getEnemyCount` configuration returns 0 (e.g. a boss-only room with no grunt spawns), the clear condition can never fire. Add a fallback or log warning if `enemies.length === 0` and phase is still `dungeon` after N ticks.

---

## Deferred from: code review of 4-2-dungeon-entrance-vote-and-run-initialisation (2026-07-01)

**D-4.2-A — HOST_START silently cancels active vote and overrides difficulty to EASY** [apps/simulation-server/src/rooms/GameRoom.ts:115]
No `runProposal !== null` guard in HOST_START. In practice HubWorldScreen replaces the Start Dungeon button with the vote indicator, making this unreachable via normal UI. Dev-tool fallback; acceptable for current phase.

**D-4.2-B — HOST_START accepts post-run phase** [apps/simulation-server/src/rooms/GameRoom.ts:117]
HOST_START only guards `phase === 'dungeon'`, not `post-run`. HubWorldScreen is not rendered in post-run (App.tsx:69), so unreachable via normal UI. Noted in D-4.1-A from Story 4.1 review.

**D-4.2-C — Late joiner added to active voters mid-vote with no timeout** [apps/simulation-server/src/rooms/GameRoom.ts:165]
A player joining after a proposal is raised is correctly added to `activePlayers` and sees the VotePopup via snapshot. No vote timeout is in scope per story non-goals. Address in a UX polish story if the open-ended wait becomes a problem in practice.

---

## Deferred from: code review of 4-3-3-level-run-structure-and-level-transitions (2026-07-01)

**D-4.3-A — HOST_START re-entry from post-run skips hub/class-selection flow** [apps/simulation-server/src/rooms/GameRoom.ts:~115]
Guard only blocks re-entry when `phase === 'dungeon'`. From `post-run`, `startDungeon()` fires, `loadLevel(1)` correctly clears enemies and positions players, but host and mobile clients are never signalled to return to hub — they transition directly from the post-run overlay into a new dungeon snapshot with stale class selections. Pre-existing gap; `loadLevel`'s enemy-clearing fix (Story 4.3) removes the accumulation risk noted in D-4.1-A, but the client flow issue remains. Address in the return-to-hub story (post-E4).

**D-4.3-B — Boss victory check `=== 4` narrower than `loadLevel` guard `>= 4`** [apps/simulation-server/src/rooms/GameRoom.ts:969]
`loadLevel` branches on `index >= 4` to create the victory trigger; the tick-level run:complete check guards on `levelIndex === 4`. If `loadLevel(5+)` were ever called (currently unreachable: level 4 has no enemies so level-clear never fires there), the victory trigger body would exist but the `=== 4` check would never fire, permanently stalling the run. No impact today; align to `>= 4` in a future cleanup pass.

**D-4.3-C — O(n²) indexOf in player spawn loop** [apps/simulation-server/src/rooms/GameRoom.ts:482]
`this.gameState.players.indexOf(player)` inside a `for...of` over the same array. MAX_PLAYERS=8 so 64 comparisons max — negligible. Replace with an index-based `for` loop if the player cap grows.

---

## Deferred from: code review of 4-4-survive-the-waves-objective (2026-07-01)

**D-4.4-A — Broadcast storm if loadLevel throws mid-tick** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
Wave completion tick calls `loadLevel(nextIndex)` without a try/catch. If `loadLevel` throws (e.g., invalid index, planck error), the tick exits mid-broadcast, leaving room state inconsistent. Pre-existing pattern from Clear objective — the same unguarded call was there before Story 4.4.

**D-4.4-B — Run-failure races wave-complete in same tick** [apps/simulation-server/src/rooms/GameRoom.ts:tick()]
If the last alive player dies in the same tick that the last wave enemy dies, both the run-failure block and the wave-complete block can fire (order: run-fail → wave-complete, due to tick ordering). Intentional per AC5 ("run failure takes precedence"); the wave-complete branch is guarded by `allEnemiesDead && wavePauseUntil===0 && waveIndex>0` which doesn't check if run already failed. No user-visible issue; document in tick ordering comment if clarity is needed.

**D-4.4-C — Tick block evaluation order is an undocumented load-bearing invariant** [apps/simulation-server/src/rooms/GameRoom.ts:~1040]
`allEnemiesDead` is computed once before the survive-waves block but after the run-failure block. Block ordering determines correctness (run-fail before wave-clear). Not obvious from reading the code in isolation. Add a short ordering comment if a future story adds a third tick block in this region.

**D-4.4-D — Wave timing non-deterministic under replay** [apps/simulation-server/src/rooms/GameRoom.ts:wavePauseUntil]
`wavePauseUntil` uses `Date.now()` (wall clock), not tick count. Replay scenarios will produce different wave-pause durations depending on replay playback speed. Same systemic pre-existing issue as other Date.now() tick comparisons in the codebase. Address in Phase 5 deterministic replay work.

**D-4.4-E — RNG seed fragile for waveNum ≥ 16 or future OFFSET_ENEMY_SPAWN bit changes** [apps/simulation-server/src/rooms/GameRoom.ts:478]
Seed packing `OFFSET_ENEMY_SPAWN | (levelIndex << 8) | (waveNum << 4)` assumes `waveNum` fits in 4 bits (≤15). With `totalWaves=3` this is safe. If WAVE_COUNTS is raised above 15 or OFFSET_ENEMY_SPAWN grows into bits 4-5, seeds collide silently. Not a current concern; document the constraint in balance.ts if WAVE_COUNTS grows.

---

## Deferred from: code review of 4-5-post-run-summary-screen (2026-07-01)

**D-4.5-A — runSeed not reset in resetToHub — same floor layout every run per session** [apps/simulation-server/src/rooms/GameRoom.ts:resetToHub]
`runSeed` is only randomized in `onCreate`. Repeating runs in the same room replay identical floor layouts. Not a 4.5 concern (seed management is pre-existing design). Randomize `runSeed` in `resetToHub` when dungeon variety becomes important.

**D-4.5-B — runOutcome ?? 'complete' fallback shows victory on null outcome (host reconnect)** [apps/host-client/src/App.tsx]
If the host reconnects mid-post-run, `runOutcome` is `null` (snapshot doesn't carry it) and defaults to `'complete'`. Visual only — hub transition still correct. Intentional per Dev Notes; `GameState.session` would need a `runOutcome` field to fix cleanly. Address in Phase 5 session state hardening.

**D-4.5-C — Stale dungeon fields in hub snapshot: levelObjective, waveIndex, totalWaves, difficulty** [apps/simulation-server/src/rooms/GameRoom.ts:resetToHub]
`session.levelObjective/waveIndex/totalWaves/difficulty` are not cleared in `resetToHub`. Hub snapshot carries last-run values. HubWorldScreen doesn't render these so no visible regression now. Clear them in `resetToHub` before hub screens start reading session objective fields.

**D-4.5-D — Player physics bodies retain linear velocity after hub teleport** [apps/simulation-server/src/rooms/GameRoom.ts:resetToHub]
`body.setPosition(hubSpawn)` without `body.setLinearVelocity(Vec2(0,0))`. Sub-tick drift before next state broadcast. Add velocity reset alongside position reset.

---

## Deferred from: code review of 4-6-end-to-end-run-e2e-test-and-latency-baseline (2026-07-02)

**W1 — measure.ts uses raw string literals instead of EventNames**
`tools/latency-baseline/measure.ts:24,32` — `player.send('class:select', ...)` and `player.onMessage('delta', ...)` use hardcoded strings. Standalone tool by design (no monorepo dep); if event names change in net-protocol the tool silently stops collecting valid latency samples.

**W2 — L1/L3 enemy counts (5 and 8) not asserted**
`tests/e2e/full-run.test.ts:88,101` — AC1 says "5 enemies die" (L1) and "8 enemies die" (L3) but the test only checks `levelIndex` on completion. Requires reading `gameState.enemies.length` from a snapshot at enemy spawn time.

---

## Deferred from code review of 4-8-forced-class-selection-on-join (2026-07-02)

**W3 — Reconnect during class-select-forced → permanent soft-lock (deferred by user)**
`App.tsx:161-175, GameRoom.ts:723` — A player who disconnects before picking a class reconnects via `handleReconnect` straight to `'controller'`. The null-class velocity gate (Task 4) freezes their body; the null-class circle guard (Task 3) hides them on host. The class-select POI is 560px from spawn and unreachable while frozen. No UI recovery path. Story spec explicitly deferred the reconnect edge case; user chose to keep it deferred. Fix: check `player.class === null` in reconnect path and route to `'class-select-forced'` instead of `'controller'`.

**W4 — Optimistic class:select with no server ack**
`App.tsx:203-206` — `sendClassSelect` + `setScreen('orientation-prompt')` fires without waiting for server confirmation. A dropped message leaves `player.class === null` while the mobile believes class is set. Combined with the null-class velocity gate (GameRoom.ts:723), this would produce a soft-lock. Local WebSocket message loss is vanishingly rare; pre-existing fire-and-forget pattern throughout the codebase. Needs a `class:confirmed` delta and a loading state if reliability requirements increase.

**W4 — Unit test mirrors tick logic instead of exercising GameRoom**
`tests/unit/null-class-gate.test.ts` — `tickVelocity` re-implements the null-class condition locally rather than calling the actual GameRoom tick path. Regressions in `toMeters`/`SPEED`/`TICK_RATE_HZ` would not be caught by this test. Accepted approach per story spec ("pure function test"). Consider a lightweight GameRoom integration test if tick regressions become a pattern.

**W5 — Stale consented-leave callback race on immediate re-join**
`App.tsx:198-201` — After tapping Back (consented disconnect), if the user immediately re-joins a new room, `persistSession` for the new room can run before `handleDisconnect(4000)` fires `clearPersistedSession` for the old room. The old callback would then erase the new token. Practical window is <100ms — not reachable by human interaction. Pre-existing pattern.

---

## Deferred from: code review of 5-1-spirit-bond-shared-types-and-protocol-contracts (2026-07-02)

**D-5.1-A — `bondColor` (wire) vs `color` (state) naming split** [`packages/net-protocol/src/apply-delta.ts:135`]
`BondAssignedDelta.bondColor` maps to `BondState.color`; `apply-delta.ts` manually bridges them. TypeScript catches any accidental mismatch. The asymmetry is consistent with how `bondType→type` works in the same delta-to-state mapping — prefixed wire fields, unprefixed state fields. Intentional convention; revisit if the pattern causes confusion in story 5.4 broadcast construction.

**D-5.1-B — `bondDescription`/`bondMechanic` unconstrained `string` in `BondNotificationMsg`** [`packages/net-protocol/src/messages/server-to-mobile.ts`]
No union type, schema validation, or lookup table constrains these fields. Valid values per bond type will be defined in story 5.4 (level-completion integration). Add a per-BondType lookup or narrow union when story 5.4 populates these strings, or define them in `game-rules` so they are derivable from `BondType`.

**D-5.1-C — `BondAssignedDelta` not individually exported from net-protocol index** [`packages/net-protocol/src/index.ts`]
Only `DeltaEventMsg` (the union) is exported. Switch-narrowing in host-client code works without a named import, and `satisfies DeltaEventMsg` in tests enforces the correct shape. Pre-existing pattern — no other delta types are individually exported either. If consumers frequently need to annotate explicit `BondAssignedDelta` variables, add it to the index alongside `DeltaEventMsg` in a net-protocol cleanup pass.

**D-5.1-D — Mobile lacks `bondDescription`/`bondMechanic` after reconnect** [`packages/net-protocol/src/messages/server-to-mobile.ts`, story 5.6]
Snapshot carries `activeBonds: BondState[]` (playerA, playerB, type, color only). The unicast `BondNotificationMsg` is not re-sent on reconnect. A reconnecting mobile client can display who they're bonded with and the color, but not the human-readable description or mechanic. Story 5.6 (mobile bond card) should re-derive description/mechanic from `bondType` on the client (lookup table in `game-rules` or `shared-types`), or the server should re-unicast `BondNotificationMsg` on reconnect.

**D-5.1-E — `SimEvents['bond:assigned']` missing `bondColor` — story 5.4 handoff hazard** [`packages/shared-types/src/session.ts:25`]
The internal sim-server event bus type `SimEvents['bond:assigned']` has `{ playerA, playerB, bondType }` — no `bondColor`. When story 5.4 wires up bond-assigned broadcasting in `GameRoom.ts`, it cannot forward the `SimEvents` payload directly to `BondAssignedDelta` — it must independently compute and append `bondColor`. This is by design (color is a rendering concern added at broadcast time), but story 5.4 must be aware of this gap to avoid a silent `undefined` for `bondColor` on the wire.

---

## Deferred from: code review of 5-2-bond-assignment-logic-and-deterministic-pair-selection (2026-07-03)

**D-5.2-A — `selectBondPair` has no internal guard for 1-player input** [`bonds.ts:19-24`]
Function is exported for tests but has no guard on `players.length >= 2`. The `!` non-null assertion suppresses TypeScript's check; a 1-player call would throw at runtime on `players[adjustedB]!.id`. Pre-existing by design: all call sites route through `assignBond` which guards length. Consider a JSDoc precondition comment if the export surface grows.

**D-5.2-B — Same pair can bond multiple times in `activeBonds`** [`bonds.ts:39`]
With 2 players and 3 `assignBond` calls, all 3 entries share the same pair. No dedup guard exists. This is intentional per story non-goals ("Bond cooldown / dedup across runs"). Story 5.3 (per-tick bond effects) must account for this when applying buffs/drains to avoid stacking.

**D-5.2-C — `selectBondPair` index math fragile if `rng()` ever returns ≥ 1.0** [`bonds.ts:20-21`]
`Math.floor(rng() * N)` is safe only while `rng()` is strictly `[0,1)`. The xoshiro128 implementation satisfies this but there's no runtime assertion. If the RNG is ever swapped for one that can return `1.0`, `players[N]!.id` would throw. Pre-existing RNG contract assumption.

**D-5.2-D — N=8 max players and `rng()=0.0` boundary not tested** [`bonds.test.ts`]
Tests cover N=2 and N=3. N=8 (session maxPlayers) exercises `adjustedB` reaching index 7. `rng()=0.0` pins the exact `idxA=0, idxB=0 → adjustedB=1` path. Both are nice-to-have regression guards against future shift-up refactors.

---

## Deferred from: code review of 5-3-per-tick-bond-effects-proximity-and-fate-bond-types (2026-07-03)

**D-5.3-A — No server-side duplicate-bond guard in `assignBond`** [`game-rules/src/systems/bonds.ts:39`]
`assignBond` pushes unconditionally; calling it twice for the same pair results in two identical entries in `activeBonds`, causing double drain and double buff. The client-side `applyDelta` dedup prevents this showing in the mirror state, but the server runs the drain loop twice per tick. Story 5.4, which is the only caller of `assignBond`, must guard against re-assigning an already-bonded pair — or add a server-side dedup check in `assignBond` itself before pushing.

**D-5.3-B — Downed/spirit players receive physics movement and Fate speed buff** [`GameRoom.ts:770`]
The movement loop only guards on `isFrozen` and `class === null`, not `isDown` or `isSpirit`. Downed players can still move their physics body, triggering bond sensor enter/exit contacts and resetting the proximity drain timer for their pair. Pre-existing issue (logged in D-1.5 scope as D22); new consequence with story 5.3 bond drain. Fix: add `|| player.isDown || player.isSpirit` to the movement freeze guard.

**D-5.3-C — `getFateBondWipeTargets` does not filter `isFrozen` partners** [`game-rules/src/systems/bonds.ts:99`]
The cascade correctly skips `isDown` and `isSpirit` partners, but not `isFrozen` (disconnected-and-in-grace) partners. `applyPlayerDamage` currently rejects frozen players (`ok: false`), which prevents the cascade from including them — but this guard is implicit. If `applyPlayerDamage` is ever relaxed or the function is called from a different context, the frozen check would be missing. Document the invariant or add an explicit `isFrozen` filter to `getFateBondWipeTargets`.
