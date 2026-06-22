---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics']
inputDocuments:
  - '_bmad-output/planning-artifacts/gdds/gdd-party-delve-2026-06-13/gdd.md'
  - '_bmad-output/game-architecture.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md'
---

# party-delve - Epic Breakdown

## Overview

This document provides the complete epic and story breakdown for Party Delve, decomposing the requirements from the GDD, UX Design, and Architecture documents into implementable stories.

---

## Requirements Inventory

### Functional Requirements

FR1: The game must support 3–8 simultaneous players on a shared host screen with mobile phones as the only controllers.
FR2: Players must be able to join a session by scanning a QR code or entering a session code; join time must be ≤10 seconds from scan/entry to player visible in the hub.
FR3: Guest players must have full access to all classes and base abilities without registration.
FR4: Registered players must have persistent progression across runs: Spirit Essence balance, mastery counters, unlocked skins/enhancements, and achievement progress.
FR5: The hub village must be a persistent free-roam space with class selection POI, training dummy POI, skin/cosmetics station POI, and dungeon entrance POI.
FR6: Each run must consist of 3 procedurally generated dungeon levels followed by 1 handcrafted boss level; target session length ~30 minutes.
FR7: Dungeon floor layouts must be procedurally generated per run from a shared deterministic seed; room interiors are selected from a handcrafted per-biome room pool.
FR8: All procedural decisions (floor layout, room selection, enemy spawns, Spirit Bond assignments) must be derived from a single shared run seed.
FR9: Level objectives in v1.0 must support two types: Clear (defeat all enemies in area) and Survive the Waves (hold out for N waves).
FR10: The dungeon entrance must support a group vote: one player proposes biome + difficulty; all phones receive an accept/decline popup; the run loads on unanimous accept.
FR11: The game must support 10 playable classes with radically asymmetric mechanics; v1 alpha targets 4 classes (Stonehide, Spiritcaller, Souldrinker, Stormcaller).
FR12: Each class must have exactly 4 abilities arranged in a fixed 2×2 grid on the mobile controller; layout is fixed per class, no remapping in v1.0.
FR13: Ability input must support three types: Joystick-AutoFire (fires continuously while held, aimed via drag), Joystick-Release (fires on thumb-lift after direction drag), and Tap (instant cast, no direction).
FR14: The Spirit Bond system must assign one new bond to a random player pair at the end of each dungeon level; bonds accumulate (1 bond entering L2, 2 entering L3, 3 active during boss).
FR15: Each Spirit Bond must consist of a positive buff and a price/consequence that requires coordination between the bonded pair.
FR16: The host screen must render a colored in-canvas particle tether between each bonded player pair, persistent for the remainder of the run.
FR17: The death/revive system must use per-player escalating revive windows within a run: 60s → 40s → 20s → 10s → 5s → 2s for consecutive downs (timer resets per run, not per level).
FR18: A downed player whose revive timer expires must enter spirit form; they retain movement and a single class-specific spirit-form ability.
FR19: A run ends in failure only when all players enter spirit form simultaneously; partial Spirit Essence rewards apply to the run.
FR20: Alive players must be able to revive a downed teammate by reaching their position within the revive window.
FR21: Difficulty tiers (Easy/Normal/Hard) must change enemy behaviors via a layered FSM (base FSM + stacked behavior layers per tier) — not only health/damage values.
FR22: Enemy count must scale with player count, not difficulty tier.
FR23: Spirit Essence must be the single in-run currency, dropped by enemies and collected automatically or by player proximity.
FR24: Post-run rewards must include Spirit Essence and mastery progress for registered players; boss defeat must trigger a reward reveal animation (loot chest / spirit manifestation visual).
FR25: Registered players must be able to spend Spirit Essence at hub POIs on skins and enhancements.
FR26: Mastery counters must track per-ability usage for registered players; milestones must unlock ability variants (alternate sound, visual, and slight mechanical improvement).
FR27: A disconnecting player must be given a 30-second grace period; their character must freeze in place (not enter spirit form) and their slot must be held during this window.
FR28: A player who reconnects within the grace period must return to their exact slot and game state with no re-auth or class re-selection.
FR29: The host post-run summary screen must display: outcome headline, team Spirit Essence earned, and per-player breakdown (name, class, times downed).
FR30: The post-run summary must persist on the host screen until all players tap "Return to Camp" on their phones.
FR31: The host lobby must display a QR code and session code; player slots must populate in real-time as players join.
FR32: The host must be able to kick a player from the lobby using a hold-to-confirm action.
FR33: The host must be able to start the game when the group is ready.
FR34: The game must ship with 1 biome (Grassland) for v1 alpha and 2 biomes (Grassland + Ancient Forest) for v1.0.
FR35: Each biome must have a distinct corrupted enemy pool, unique corrupted boss, biome-specific achievement set, and distinct visual identity.
FR36: The boss room must be handcrafted per biome and synthesize mechanics introduced in the preceding three dungeon levels.
FR37: The host client must show a Main Menu with a "Create Session" button on app launch.
FR38: The simulation server must be the sole authoritative game state mutator, running a 30hz tick loop; host and mobile clients are pure clients (render and input only).

---

### NonFunctional Requirements

NFR1: Input latency must be ≤100ms p95 from mobile controller input event to visible response on host screen.
NFR2: Session join time must be ≤10 seconds from QR scan or session code entry to player visible in hub.
NFR3: Host frame rate must be 60 FPS stable during 8-player combat on target hardware.
NFR4: Crash rate must be 0 crashes per completed run.
NFR5: All mobile controller touch targets must be minimum 44×44px.
NFR6: The mobile controller must support simultaneous multi-touch (minimum 2 concurrent touch points; 3 recommended) — tracked by Touch.identifier, not event.targetTouches[0].
NFR7: The simulation PRNG must be deterministic — identical seed must produce identical run layout across independent instances.
NFR8: The simulation tick loop must complete within 33ms per tick; no heap allocations in hot paths; no logging above debug level inside the tick.
NFR9: Host screen text must be legible at couch distance (2–4 meters); minimum readable font equivalent to 24px at 1080p.
NFR10: The simulation server must recover from individual tick failures without ending the session (try-catch per tick; log and skip on error).
NFR11: Guest and registered players must be able to compete in the same run without structural gameplay disadvantage.
NFR12: The mobile controller must function as a PWA, enabling fast reload after browser sleep or tab backgrounding on iOS and Android.
NFR13: The cloud infrastructure must not sit on the critical gameplay path during local sessions.
NFR14: All color token usage on text and interactive elements must meet WCAG AA contrast (4.5:1 for body text; 3:1 for UI components); host screen text must target 7:1+ for couch-distance readability.
NFR15: All WebSocket messages must pass through net-protocol serialize/deserialize wrappers — never raw JSON.stringify/JSON.parse in app code.
NFR16: Colyseus @Schema state sync must not be used; all game state must flow through explicit typed event contracts in net-protocol.
NFR17: TypeScript strict mode must be enabled in all packages; no any without explicit suppression comment.

---

### Additional Requirements

AR1: Clean slate policy — all ad-hoc src/ contents in apps/* and packages/* must be deleted before Phase 2 implementation begins; config files (package.json, tsconfig.json, vite.config.ts, vitest.config.ts, index.html) are retained.
AR2: The monorepo must use npm (not pnpm); cross-workspace commands via `npm run <script> --workspace=apps/<name>`.
AR3: The shared-types package must own all TypeScript interfaces, enums, and cross-package constants; it must have zero runtime logic.
AR4: The net-protocol package must own all wire message type definitions, serialize/deserialize wrappers, and the applyDelta pure reducer; it must have zero game rules.
AR5: The game-rules package must contain pure functions only; no I/O, no Colyseus imports, no planck.js imports.
AR6: The simulation server orchestrates game-rules + planck.js + Colyseus; it is the sole owner of GameState mutation.
AR7: ESLint no-restricted-imports must block any import of game-rules in host-client or mobile-controller; violations are a merge-gate failure.
AR8: No Math.random() in game logic; all randomness in packages/game-rules and apps/simulation-server must use the xoshiro128++ PRNG with one factory per generation system.
AR9: The planck.js physics world must step only inside the sim server tick loop; never from host or mobile.
AR10: PixiJS Assets.backgroundLoad() must be used for biome bundles during hub free-roam; all biome assets must be ready before the dungeon entrance vote can complete.
AR11: Infrastructure: PostgreSQL for durable player data; Redis for session cache + Colyseus presence adapter; Docker Compose provides local dev instances.
AR12: Three test categories required: unit tests (game-rules + sim-server pure functions), contract tests (net-protocol round-trips), e2e tests (join/run/reconnect full flows).
AR13: No database mocks in integration tests; tests must connect to real local PostgreSQL and Redis instances.
AR14: Spirit Bond proximity detection must use planck.js sensors (isSensor: true); no manual distance polling in the tick loop.
AR15: All game-rules functions must return Result<T, E> discriminated union; no throw from game-rules code.
AR16: Internal sim communication must use a typed SimEvents EventEmitter with noun:verb event names; no raw string event names on a bare EventEmitter.
AR17: Context7 MCP server must be configured for live documentation lookup during implementation (`npx -y @upstash/context7-mcp`).
AR18: Backend HTTP framework is Hono v4.12.26 (hono + @hono/node-server); auth routes: POST /auth/guest, /auth/login, /auth/register; player routes: GET/PATCH /player/:id.
AR19: Backend platform is the only app that may make direct PostgreSQL calls; sim server and clients must call backend-platform endpoints for persistent data.

---

### UX Design Requirements

UX-DR1: Implement the two-layer design system (Raw Earth base + Spirit Chant accent) as CSS custom properties shared between both apps; no raw hex values in component CSS — only token references.
UX-DR2: Define and implement all 14 color tokens as CSS custom properties: bg-base (#0f0e10), bg-surface (#181620), bg-subtle (#22202e), border (#36334a), text-primary (#d8d0e8), text-secondary (#a89ec0), accent-spirit (#6ea8d8), accent-warm (#c07d35), accent-corruption (#7d2dff), accent-purify (#90d8f0), interactive (#6ea8d8), interactive-hover (#88c0ee), corruption-acid (#39ff14), corruption-blood (#c0392b).
UX-DR3: Implement the typography system: Uncial Antiqua (Google Fonts, 400 weight) for all display/heading use; Lora (Google Fonts, 400/700/italic) for all body and UI use; apply the 7-step type scale (xs 11px → xxl 56px); Uncial Antiqua must never be used below 20px (md scale).
UX-DR4: Implement the 8px grid spacing system; all padding, margin, gap, and fixed sizes must be multiples of 8px; 4px half-unit permitted only for fine internal padding in compact elements.
UX-DR5: Implement all 10 design system components with the specified variants: player-chip (alive/spirit-form), skill-cell (idle/active-joystick/on-cooldown/disabled), interact-button (interact/continue), bond-card (standard/dismiss-ready), class-card (default/selected), ability-chip (joystick-autofire/joystick-release/tap), post-run-card (victory/failure), revive-timer (urgent/critical/expired), session-code-field (empty/prefilled/error), join-button (default/loading/success).
UX-DR6: Host screen layout: game canvas fills edge to edge; a single 48px top strip (no border-radius at screen edges) contains player chips, level/biome label (top-right), and objective label (top-center); no persistent overlay beyond this strip during combat.
UX-DR7: Phone layout: portrait for Auth Choice and Session Code Entry screens; landscape for all gameplay screens; left ~40% of landscape is floating movement joystick zone; right ~60% is fixed 2×2 skill grid; 6px HP strip at very top of phone during gameplay.
UX-DR8: Skill cell cooldown must use a conic-gradient overlay that fills clockwise across the majority of the cell face (not a circular ring); centered countdown value in text-primary; ability icon/name revealed progressively beneath the gradient.
UX-DR9: Joystick floating model: the joystick ring spawns at the exact touch position (not a fixed anchor); applies to both the movement joystick (left zone) and joystick-type skill cell inputs (right zone); fullrange analog with deadzone near spawn origin.
UX-DR10: Skill cell boundary rule for joystick-type inputs: when thumb drifts outside the cell boundary, the ability continues using the last valid direction; the joystick ring clamps visually to the cell edge; the hold releases on thumb-lift anywhere on screen.
UX-DR11: Spirit Chant glow (accent-spirit box-shadow / drop-shadow) must appear ONLY on elements in a spiritually active state: selected class card border+tint, active joystick ring, bond overlay text, visible interact/continue button; never decorative or on idle elements.
UX-DR12: Bond assignment host overlay: Uncial Antiqua at xl (40px) minimum, accent-spirit text-shadow glow (0 0 40px rgba(110,168,216,0.7)), no panel or background, text floats over the live canvas, fades after ~3 seconds; the bond particle tether appears in-canvas and persists.
UX-DR13: Revive timer: ephemeral bottom-center host overlay (appears only while a player is downed); 40px Lora 700 countdown value; accent-warm color + amber halo when >10s; corruption-blood color when ≤10s; corruption-purple container border throughout; disappears on revive or timer expiry.
UX-DR14: Post-run summary: must support victory tone (e.g., "Purified. The campfire noticed.") and failure tone (e.g., "Tonight, the forest held its ground.") using the same screen template; team Spirit Essence in accent-warm; persists until all players Return to Camp.
UX-DR15: Orientation transition: after Session Code Entry (portrait), display a "Rotate your phone to landscape to play" prompt with rotation animation; auto-dismiss on landscape detection; persist with manual dismiss option if rotation lock is active.
UX-DR16: Purification pulse: accent-purify sweep radiates from boss position across the full canvas; corrupted environmental sprites flip to clean versions simultaneously; no modal, banner, or HUD overlay — the canvas transformation is the "boss defeated" signal.
UX-DR17: Spirit form in-canvas: downed players appear as luminous session-colored figures in-canvas; player-chip shows spirit-form state (name dimmed, pips empty, accent-spirit glow rim, ghost icon); spirit-form phone controller shifts to Spirit Chant theme (session-color glow, 3 cells locked at 80% mask, 1 spirit-form ability cell active with session-color glow border).
UX-DR18: Reconnect state: phone replaces controller with session code display + "Rejoin Session" CTA; host shows disconnected chip (dashed border, dimmed name); character freezes in place on canvas; no gameplay pause.
UX-DR19: Host screen must have no safe-area concerns (full-bleed canvas is correct); phone layout must apply env(safe-area-inset-*) CSS environment variables to protect touch zones from system UI on iOS/Android.
UX-DR20: All interactive touch targets on the phone must meet 44×44px minimum hit area; all interactive elements must use border-radius between 6px (rounded-md) and 8px (rounded-lg); full-pill radius is explicitly forbidden.

---

### FR Coverage Map

| FR | Epic | Description |
|---|---|---|
| FR1 | E1 | 3–8 player shared screen + phone controllers |
| FR2 | E1 | QR join; ≤10s session join time |
| FR3 | E1 (guest), E7 (complete) | Guest access without registration |
| FR4 | E7 | Registered persistent progression |
| FR5 | E2 | Hub village with all POIs |
| FR6 | E4 | 3 dungeon levels + boss structure |
| FR7 | E4 | Procedural floor layout + handcrafted room pool |
| FR8 | E4 | Single shared deterministic seed |
| FR9 | E3 (Clear), E4 (Survive Waves) | Level objective types |
| FR10 | E4 | Group dungeon entrance vote |
| FR11 | E3 (4 classes), E8 (all 10) | Class roster |
| FR12 | E3 | 4-ability fixed 2×2 grid |
| FR13 | E3 | 3 input types (AutoFire / Release / Tap) |
| FR14 | E5 | Spirit Bond accumulation |
| FR15 | E5 | Bond buff + price structure |
| FR16 | E5 | In-canvas particle tethers |
| FR17 | E3 | Escalating revive timer windows |
| FR18 | E3 | Spirit form on timer expiry |
| FR19 | E3 (failure), E4 (run ends) | All-in-spirit-form run failure |
| FR20 | E3 | Teammate revive by proximity |
| FR21 | E3 (layered FSM), E6 (boss tiers) | Behavior-tiered difficulty |
| FR22 | E3 | Enemy count scales with player count |
| FR23 | E3 (collection), E7 (persistence) | Spirit Essence currency |
| FR24 | E6 (reward reveal), E7 (persistence) | Post-run rewards |
| FR25 | E7 | Hub shop (registered players) |
| FR26 | E7 | Mastery counters + ability variants |
| FR27 | E1 | 30s disconnect grace period |
| FR28 | E1 | Reconnect restores full slot/state |
| FR29 | E4, E10 | Post-run summary display |
| FR30 | E4 | Summary persists until all Return to Camp |
| FR31 | E1 | Lobby QR + session code + real-time slots |
| FR32 | E1 | Host kick (hold-to-confirm) |
| FR33 | E1 | Host starts the game |
| FR34 | E4 (Grassland), E9 (+ Forest) | Biome count |
| FR35 | E6 (Grassland), E9 (Forest) | Per-biome enemy/boss/achievements |
| FR36 | E6 | Handcrafted boss room synthesizes prior mechanics |
| FR37 | E1 | Main menu with Create Session |
| FR38 | E1 | Authoritative sim server; pure rendering clients |

---

## Epic List

### Epic 1: Foundation Platform
Players can create a session on the host screen and join from their phones via QR code or session code. They appear in an empty hub world. Disconnect/reconnect within grace period works.
**FRs covered:** FR1, FR2, FR3 (guest join), FR27, FR28, FR31, FR32, FR33, FR37, FR38

### Epic 2: Hub World & Class Selection
Players explore the tribe village hub, interact with POIs (class selection, training dummy), browse and select a class, review its abilities, and confirm their choice. The host screen shows all characters in the hub.
**FRs covered:** FR5, FR11 (4 alpha classes defined), FR12, FR13

### Epic 3: Core Combat — 4 Alpha Classes
Stonehide, Spiritcaller, Souldrinker, and Stormcaller are fully playable in a dungeon combat encounter with real enemies. Players use abilities, go down, get revived by teammates, and enter spirit form when the revive timer expires. The "Clear" objective type is operational.
**FRs covered:** FR9 (Clear), FR11 (4 classes playable), FR12, FR13, FR17, FR18, FR19 (failure condition), FR20, FR21 (difficulty behaviors), FR22, FR23 (collection)

### Epic 4: Procedural Dungeon & Full Run Structure
Players vote to start a run at the dungeon entrance. Three procedurally generated dungeon levels (Clear + Survive the Waves objectives) run sequentially with escalating difficulty. A placeholder victory state ends the run. Post-run summary displays on host. Procedural seed system is deterministic.
**FRs covered:** FR6, FR7, FR8, FR9 (Survive Waves added), FR10, FR19 (run ends on full wipe), FR29, FR30, FR34 (Grassland single biome)

### Epic 5: Spirit Bond System
After each dungeon level, a Spirit Bond is assigned to a random player pair. Bond buffs and prices apply per-tick. Colored particle tethers connect bonded pairs on the host canvas. Three bonds are active simultaneously by the boss fight. Bonded players see a full-screen bond card on their phone; others see a Continue prompt.
**FRs covered:** FR14, FR15, FR16

### Epic 6: Grassland Boss Encounter
The Grassland biome boss is fully playable with behavior-tiered AI (Easy/Normal/Hard difficulty layers), synthesizing mechanics from the preceding three levels. Boss defeat triggers the purification pulse, reward reveal animation, and transitions to the post-run summary.
**FRs covered:** FR21 (boss tiers), FR24 (reward reveal), FR35 (Grassland boss + achievements), FR36

### Epic 7: Progression & Persistent Meta
Registered player accounts work end-to-end: Spirit Essence accumulates across runs, mastery counters track per-ability usage, and the hub shop lets registered players spend on skins and enhancements. Guest and registered players compete in the same run without structural disadvantage.
**FRs covered:** FR3 (fully complete with registration), FR4, FR23 (persistence), FR24 (Spirit Essence persists), FR25, FR26

### Epic 8: Full Class Roster
The remaining 6 classes (Sunwarden, Wildshaper, Songweaver, Trailhunter, Shadowstalker, Windwalker) are fully implemented and playable, completing the roster of 10 radically asymmetric classes.
**FRs covered:** FR11 (all 10 classes complete)

### Epic 9: Ancient Forest Biome
The second biome is fully playable — distinct corrupted enemy pool, unique boss, biome-specific achievement set, and a visual identity distinct from Grassland. Players can select the biome at the dungeon entrance.
**FRs covered:** FR34 (2 biomes complete), FR35 (Ancient Forest complete)

### Epic 10: Polish, Performance & Telemetry
All performance targets are verified by measurement. Telemetry instruments key flows (session start/end, player down/revived, Spirit Bond assignments, run completion). Difficulty curve is playtested and tuned. All NFRs are verified against real metrics.
**FRs covered:** FR29 (success metrics complete)
**NFRs verified:** NFR1–NFR17 (all measured, not just targeted)

---

## Epic 1: Foundation Platform

Players can create a session on the host screen and join from their phones via QR code or session code. They appear in an empty hub world. Disconnect/reconnect within grace period works.

### Story 1.1: Monorepo Architecture Clean Slate & Package Scaffold

As a developer on the project,
I want the monorepo cleaned up and scaffolded per the architecture document with design system tokens in place,
So that every agent role can begin implementing their modules against the correct structure without conflicts.

**Acceptance Criteria:**

**Given** ad-hoc Phase 1 `src/` contents exist across apps and packages
**When** the clean slate is executed
**Then** all `apps/*/src/` contents, all `packages/*/src/` contents, `tests/e2e/`, `tests/unit/`, `tests/contract/` contents, and `.gitkeep` stubs are deleted
**And** all `package.json`, `tsconfig.json`, `vite.config.ts`, `vitest.config.ts`, and `index.html` files are retained unchanged

**Given** a clean repository
**When** `packages/shared-types/src/` is scaffolded
**Then** it contains: `constants.ts` (TICK_RATE_HZ=30, MAX_PLAYERS=8, SNAPSHOT_INTERVAL_S=5, RECONNECT_GRACE_S=30), `player.ts`, `enemy.ts`, `bond.ts`, `session.ts`, `input.ts`, `join.ts`, `game-state.ts`, `index.ts`
**And** the package contains zero runtime logic — interfaces, enums, and constants only

**Given** shared-types is in place
**When** `packages/net-protocol/src/` is scaffolded
**Then** it contains: `serialize.ts` (JSON-backed `serialize<T>()` / `deserialize<T>()` wrappers), `envelope.ts`, `event-names.ts`, `messages/server-to-host.ts`, `messages/server-to-mobile.ts`, `messages/mobile-to-server.ts`, `index.ts`
**And** a contract test placeholder exists at `tests/contract/net-protocol.test.ts`
**And** the package contains zero game rules

**Given** all packages are in place
**When** the design system is bootstrapped
**Then** all 14 color tokens are defined as CSS custom properties in a shared token file referenced by both host-client and mobile-controller
**And** Uncial Antiqua (Google Fonts, 400) and Lora (Google Fonts, 400/700/italic) are imported and available in both apps
**And** TypeScript strict mode is confirmed enabled (`"strict": true`) in every `tsconfig.json`
**And** ESLint `no-restricted-imports` is configured to error on any import of `packages/game-rules` from `apps/host-client` or `apps/mobile-controller`

---

### Story 1.2: Simulation Server — Session Lifecycle & 30hz Tick Loop

As a host player,
I want to create a game session backed by an authoritative simulation server,
So that the server reliably manages session state and player connections.

**Acceptance Criteria:**

**Given** the simulation server is running
**When** the host client creates a `GameRoom`
**Then** `GameRoom.onCreate` initializes an empty `GameState`, seeds the xoshiro128++ PRNG, and starts a 30hz tick loop (setInterval at 1000/TICK_RATE_HZ ms)
**And** the Colyseus Redis presence adapter is configured for the room
**And** no `@Schema` decorator or Colyseus state sync is used anywhere in the room

**Given** a room exists and a client sends a join message
**When** `onJoin` fires
**Then** a player slot is added to `GameState`
**And** a `SnapshotMsg` (full current state) is serialized via `net-protocol`'s `serialize()` and broadcast to all clients

**Given** a connected player's network drops
**When** `onLeave(consented=false)` fires
**Then** the player slot is held in `GameState` (not removed), the character is flagged frozen, and a `RECONNECT_GRACE_S`-second grace timer starts

**Given** a player intentionally leaves
**When** `onLeave(consented=true)` fires
**Then** the player slot is removed immediately and a `player:left` delta event is broadcast

**Given** a mobile client sends an input
**When** `onMessage` fires
**Then** the message is deserialized via `deserialize<InputEventMsg>()` and routed to the sim input queue for next-tick processing — no `GameState` mutation inside `onMessage`

**Given** the tick loop is running
**When** any tick throws an uncaught error
**Then** the error is caught by the tick-level try-catch, logged at `error` level with `{ sessionId, err }`, and the loop continues without crashing the session

---

### Story 1.3: Host App — Main Menu & Lobby Screen

As a host player,
I want to open the game, create a session, and see a QR code and session code on the lobby screen,
So that my group can scan in without any technical setup.

**Acceptance Criteria:**

**Given** the host-client loads in a browser
**When** the Main Menu screen renders
**Then** the Party Delve title is displayed in Uncial Antiqua at xxl (56px)
**And** a single "Create Session" button is visible in Lora 700 at md size on an `interactive`-colored button with 6–8px border-radius

**Given** the host clicks "Create Session"
**When** the Colyseus room is created and the session code is assigned
**Then** the Lobby screen appears with the QR code centered and large
**And** the session code is displayed below the QR in Lora 700 at xl size (40px), readable at couch distance
**And** an empty player slot list is rendered below the code

**Given** the lobby is visible
**When** players join the session
**Then** each new player's display name and a class-TBD indicator appear in a slot in real-time without any host action
**And** each slot has an X (kick) control that requires a 1.5-second hold to fire (hold-to-confirm; a progress ring fills during the hold)

**Given** the host is ready to begin
**When** the host clicks "Start Game"
**Then** a start signal is sent to the simulation server and the host transitions from Lobby to Hub World

**Given** the lobby screen is viewed from 2–4 meters
**When** the QR code and session code are displayed
**Then** both are legible without the host approaching the screen (QR code minimum 200×200px rendered; session code in text-primary at 7:1+ contrast)

---

### Story 1.4: Mobile App — Guest Join Flow

As a guest player,
I want to scan the QR code (or enter the session code manually), enter my name, and join the session within 10 seconds,
So that I can start playing without creating an account.

**Acceptance Criteria:**

**Given** a player scans the QR code with their phone camera
**When** the game URL opens in the mobile browser
**Then** the Auth Choice screen appears in portrait orientation with three options: "Continue as Guest," "Sign In," "Sign Up"
**And** each option meets the 44×44px minimum touch target requirement

**Given** the player taps "Continue as Guest"
**When** the Session Code Entry screen renders
**Then** the `session-code-field` is pre-populated from the URL params session code
**And** a required display name input field (empty, no default fallback) is rendered below the code field
**And** the `join-button` (52px min height, `interactive` fill, Lora 700 label, 8px border-radius) is the primary CTA

**Given** the player fills in a display name and taps Join
**When** the join request is sent
**Then** the `join-button` enters its loading state (three-dot pulse animation, non-interactive)
**And** the player's slot appears on the host lobby screen within 10 seconds of tapping (NFR2)

**Given** a successful join
**When** the server confirms the player is in the room
**Then** the join button flashes `accent-purify` briefly (success state), then the orientation prompt appears: "Rotate your phone to landscape to play" with a rotation icon animation
**And** the prompt auto-dismisses when the device detects landscape orientation
**And** a manual dismiss option persists if the device has rotation lock enabled

**Given** an invalid or expired session code
**When** the join request fails
**Then** the `session-code-field` switches to its error state (corruption-blood border, error message in sm Lora below)
**And** the join button returns to its default interactive state

**Given** a player navigates directly without a QR code
**When** the Session Code Entry screen appears
**Then** the code field is empty and the player may type the session code manually

---

### Story 1.5: Hub World Bootstrap & Player Presence

As a player,
I want to see my character appear in the hub world on the shared host screen after the host starts the game,
So that everyone in the room knows the session is live and we are all connected.

**Acceptance Criteria:**

**Given** the host has clicked "Start Game" and the simulation server has broadcast the initial snapshot
**When** the host-client receives the `SnapshotMsg`
**Then** the PixiJS canvas fills the host screen edge-to-edge with the empty hub world
**And** a 48px top strip overlays the canvas top edge (flush, zero border-radius on screen edges) containing one `player-chip` per connected player
**And** each `player-chip` shows the player's display name in Lora 700 at base (16px) and a class-TBD indicator in Lora 400 at sm, all on a bg-surface chip with 6px border-radius

**Given** a player moves the left joystick on their phone
**When** the `InputEventMsg` (joystick vector) arrives at the simulation server
**Then** the character position updates in `GameState` on the next tick
**And** a `player:moved` delta event is serialized and broadcast to the host
**And** the host applies the delta via `applyDelta(mirrorState, evt)` and calls `renderFrame(mirrorState)`
**And** the character moves visibly on the host canvas within 100ms of the input (NFR1)

**Given** the PixiJS renderer is running
**When** a full `SnapshotMsg` arrives from the server
**Then** `mirrorState` is fully overwritten by the snapshot state (no drift accumulation)

**Given** any file in `apps/host-client` or `apps/mobile-controller` is linted
**When** it contains an import of `packages/game-rules`
**Then** ESLint reports an error and the CI pipeline fails (AR7 enforcement)

**Given** the hub is rendering on the host screen
**When** viewed at 2–4 meters couch distance
**Then** player names in the top strip are readable (text-primary on bg-surface achieving 7:1+ contrast)

---

### Story 1.6: Disconnect Grace Period & Reconnect Flow

As a player,
I want to reconnect to my session within 30 seconds of losing connection without losing my slot or re-authenticating,
So that a brief network interruption does not end my game.

**Acceptance Criteria:**

**Given** a player is in the hub world
**When** their WebSocket connection drops (network failure, browser sleep, or tab close)
**Then** the sim server's `onLeave(consented=false)` fires
**And** the player's slot is held in `GameState` — the character freezes in place on the host canvas (not removed)
**And** the host `player-chip` for that player shows a dashed border and name dimmed to text-secondary
**And** a 30-second grace timer (RECONNECT_GRACE_S) starts; no gameplay pause occurs

**Given** the player's phone resumes and has auth data in session storage
**When** the Reconnect screen renders on the phone
**Then** it shows the session code (large, centered), a "Rejoin Session" CTA button (primary, full-width, ≥44px), and a network status indicator
**And** no re-authentication or name re-entry is required

**Given** the player taps "Rejoin Session" within the grace period
**When** the reconnect succeeds
**Then** the Colyseus room receives the reconnect event, restores the player slot, and sends a full `SnapshotMsg` to the rejoined client
**And** the phone controller view resumes at the hub controller layout
**And** the host `player-chip` returns to its normal alive state (solid border, full name brightness)

**Given** the grace timer expires before reconnect
**When** RECONNECT_GRACE_S elapses
**Then** the player slot is released from `GameState` and a `player:left` delta is broadcast
**And** the `player-chip` is removed from the host top strip
**And** if the player later taps "Rejoin Session" after expiry, they re-join as a fresh new player (new slot assigned)

---

## Epic 2: Hub World & Class Selection

Players explore the tribe village hub, interact with POIs (class selection, training dummy), browse and select a class, review its abilities, and confirm their choice. The host screen shows all characters active in the hub.

### Story 2.1: Hub World — POI Layout & Interact Button

As a player,
I want to walk my character around the hub village and see a contextual "Interact" button appear when I approach a point of interest,
So that I know where the meaningful locations are and can engage with them.

**Acceptance Criteria:**

**Given** a player is in the hub world
**When** the hub canvas renders
**Then** at least three POI zones are visible on the host canvas: class selection, training dummy, and dungeon entrance (dungeon entrance is visible but non-interactive until Epic 4)
**And** in-canvas icons or visual markers distinguish each POI from the environment

**Given** a player's character moves near a POI (class selection or training dummy)
**When** the sim server detects the character is within interaction range (planck.js sensor zone)
**Then** a `poi:entered` delta event is sent to that player's mobile client
**And** a chat-bubble icon appears above the character's head on the host canvas (in-canvas render, not HTML overlay)

**Given** the player's mobile client receives the `poi:entered` event
**When** the `interact-button` slides in from the top edge of the phone screen
**Then** the button slides from `translateY(-100%)` to `translateY(0)` in ~200ms ease-out
**And** the button label reads "Interact" in Lora 700 at md size
**And** the button has an `accent-spirit` border (2px) and spirit glow shadow, with minimum 44px height

**Given** the player's character moves out of the POI range
**When** the sim server sends a `poi:exited` delta event
**Then** the `interact-button` slides back off the top edge at the same motion speed
**And** the chat-bubble icon disappears from the host canvas

---

### Story 2.2: Class Selection Flow — Card Browse & Selection

As a player,
I want to browse the class roster on my phone and tap a class card to see its abilities,
So that I can choose the right class for my playstyle before entering the dungeon.

**Acceptance Criteria:**

**Given** the player taps "Interact" near the class selection POI
**When** the class selection flow opens on the phone
**Then** the phone displays a horizontally scrollable row of `class-card` components in portrait orientation
**And** approximately 2–3 cards are visible at once; cards are ~200px wide and ~180px tall
**And** each card shows: class name in Uncial Antiqua at md (20px), role label in Lora 700 at sm (text-secondary), and one flavour line in Lora 400 italic at sm (text-secondary)
**And** the 4 alpha classes are present: Stonehide, Spiritcaller, Souldrinker, Stormcaller

**Given** the class selection scroll is visible
**When** a player taps a class card
**Then** the tapped card transitions to its selected state: `accent-spirit` border (2px) replaces the default `border` stroke, background shifts to `bg-subtle`
**And** only one card can be selected at a time; tapping a second card deselects the first

**Given** a class card is selected
**When** the ability briefing panel auto-opens from the bottom of the screen
**Then** the panel slides up in ~200ms and shows 4 `ability-chip` components (one per ability), a brief role summary in Lora 400 at sm (text-secondary), and a "Pick Selected Class" confirm button at the bottom
**And** each `ability-chip` shows the ability name in Lora 700 at sm and an input type badge (AUTO / RELEASE / TAP) in Lora 400 at xs (text-secondary)
**And** the "Pick Selected Class" confirm button is the only confirmation CTA — there is no "Select" button on the card itself

---

### Story 2.3: Class Confirmation & Hub Controller Transition

As a player,
I want to confirm my class selection and have my phone switch to the landscape hub controller with my class abilities loaded,
So that I can move freely in the hub world with my chosen class identity.

**Acceptance Criteria:**

**Given** a class is selected and the ability briefing panel is open
**When** the player taps "Pick Selected Class"
**Then** the simulation server receives a class selection message and updates `GameState` with the player's chosen class
**And** the host `player-chip` updates to show the chosen class name (Lora 400, sm, text-secondary) in place of the class-TBD indicator
**And** an in-canvas animation on the host shows the character's class update (walk-out / walk-in or costume swap effect)

**Given** the class is confirmed
**When** the phone transitions back from the class selection flow
**Then** the phone returns to landscape hub controller layout
**And** the right zone displays 4 `skill-cell` components, each showing the class's ability name in Lora 400 italic at base and the correct input type badge (AUTO / RELEASE / TAP) in Lora 400 at xs
**And** skill cells are non-interactive in the hub (abilities are inactive outside dungeon combat)

**Given** the hub controller is active in landscape
**When** the left joystick zone is touched
**Then** the joystick ring spawns at the exact touch position (floating model — not a fixed anchor)
**And** the character moves in the hub world within 100ms of input (NFR1)

**Given** the host screen updates after a class is confirmed
**When** viewed at couch distance
**Then** the updated player-chip with the class name is legible in the top strip at 2–4 meters

---

### Story 2.4: Training Dummy POI

As a player,
I want to interact with the training dummy in the hub and fire my abilities at it,
So that I can learn what my class feels like before entering a dungeon.

**Acceptance Criteria:**

**Given** a player with a confirmed class approaches the training dummy POI
**When** the `interact-button` slides in and the player taps "Interact"
**Then** the training dummy becomes targetable on the host canvas (visual indicator appears on the dummy)
**And** the player's skill cells on the phone become active (responsive to input)

**Given** the skill cells are active at the training dummy
**When** the player activates a Joystick-AutoFire ability (touches and drags the skill cell)
**Then** a joystick ring spawns at the exact touch position within the cell
**And** the ability fires continuously in the aimed direction while the touch is held
**And** if the thumb drifts outside the cell boundary, the ability continues using the last valid direction; the ring clamps visually to the cell edge

**Given** the player activates a Joystick-Release ability
**When** the player touches and drags the cell then lifts their thumb
**Then** the ability fires in the drag direction on thumb-lift (not while held)

**Given** the player activates a Tap ability
**When** the player taps the skill cell
**Then** the ability fires instantly; no joystick ring appears; a brief tap feedback animation confirms the input

**Given** an ability fires and enters cooldown
**When** the cooldown begins
**Then** a conic-gradient overlay fills clockwise across the majority of the skill cell face
**And** a countdown value in text-primary appears centered on the cell
**And** the cell is non-interactive while on cooldown

**Given** the player moves away from the training dummy
**When** the `interact-button` disappears (character exits POI range)
**Then** skill cells return to their idle state (non-interactive in hub)

---

## Epic 3: Core Combat — 4 Alpha Classes

Stonehide, Spiritcaller, Souldrinker, and Stormcaller are fully playable in a dungeon combat encounter with real enemies. Players use abilities, go down, get revived by teammates, and enter spirit form when the revive timer expires. The "Clear" objective type is operational.

### Story 3.1: xoshiro128++ PRNG & planck.js Physics World

As a simulation engineer,
I want a deterministic PRNG and a planck.js physics world running inside the sim server tick loop,
So that all physics-driven gameplay is reproducible from the same seed and never leaks outside the server.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/prng/xoshiro128.ts` is implemented
**When** `createRng(seed)` is called twice with the same seed
**Then** both instances produce identical number sequences (verified by unit test `tests/unit/xoshiro128.test.ts`)
**And** `Math.random()` is not called anywhere in `packages/game-rules` or `apps/simulation-server` (enforced via ESLint `no-restricted-globals`)

**Given** the sim server tick loop is running
**When** `packages/game-rules/src/physics/world.ts` initializes a planck.js World
**Then** the physics world steps exactly once per tick (inside the tick loop only — never from host or mobile)
**And** player and enemy bodies use `createPlayerBody()` / `createEnemyBody()` factory functions (no `new` on planck shapes in game systems)
**And** no planck.js import exists in `apps/host-client` or `apps/mobile-controller`

**Given** the physics world is stepping
**When** two bodies overlap a sensor zone
**Then** the sensor contact is detected via planck.js contact listeners (`isSensor: true` bodies), not by manual distance calculation in the tick

---

### Story 3.2: Enemy AI — Base FSM & Layered Difficulty Behaviors

As a player,
I want enemies to move toward me and attack, with harder difficulties adding new and more dangerous behaviors,
So that the game feels progressively more challenging without just becoming a stat wall.

**Acceptance Criteria:**

**Given** an enemy entity exists in `GameState`
**When** the sim tick calls `tickEnemy(enemy, ctx, layers)`
**Then** on Easy: the enemy runs only the base FSM (`Idle → Chase → Attack → Idle`)
**And** on Normal: a `ChargeLayer` is prepended — when `shouldActivate` returns true, the enemy executes a telegraphed charge; the base FSM runs as fallback if no layer activates
**And** on Hard: both `ChargeLayer` and `StompLayer` are prepended — StompLayer adds an AoE slow on activation
**And** adding a Hard-tier behavior never modifies `fsm.ts` or lower-tier layers

**Given** an enemy AI function in `packages/game-rules`
**When** it produces a game error (invalid state, out-of-bounds)
**Then** it returns `{ ok: false, error: GameError }` — it does not throw
**And** the tick loop's caller handles the error branch explicitly

**Given** enemy count is determined at level start
**When** player count varies from 3 to 8
**Then** enemy count scales proportionally with player count (balance values from `game-rules/balance.ts`)
**And** difficulty tier does not affect enemy count — only behavior layers

**Given** unit tests for the enemy FSM
**When** `tests/unit/fsm.test.ts` runs
**Then** all state transitions (Idle→Chase, Chase→Attack, Attack→Idle) are verified for each difficulty tier
**And** each behavior layer is independently testable with no Colyseus or planck.js imports

---

### Story 3.3: 4 Alpha Class Implementations — Abilities & Input Types

As a player,
I want to play as Stonehide, Spiritcaller, Souldrinker, or Stormcaller with fully functional abilities,
So that each class feels mechanically distinct and fulfills its role in a run.

**Acceptance Criteria:**

**Given** a player has confirmed a class and enters a dungeon level
**When** the simulation server initializes the player entity
**Then** the player entity has 4 abilities loaded from the class definition, each with its input type (AutoFire / Release / Tap), cooldown duration (from `balance.ts`), and damage/effect values (from `balance.ts`)
**And** every class has at least one ability with a cooldown ≤3 seconds (Pillar 1 floor)

**Given** a player sends an `InputEventMsg` with a joystick vector and ability slot index
**When** the sim processes the input in `game-rules/src/systems/movement.ts` and the ability dispatch
**Then** the correct ability fires with direction derived from the input vector (for AutoFire and Release types)
**And** the ability enters cooldown immediately after firing; a `cooldown:started` delta is sent to the mobile client
**And** the host receives an ability effect delta event and renders the effect in-canvas

**Given** the mobile client receives a `cooldown:started` event for a skill cell
**When** the cooldown is active
**Then** the conic-gradient overlay fills clockwise across the majority of the cell face from 0% to 100% as the cooldown elapses
**And** a countdown value in text-primary is centered on the cell
**And** the cell rejects touch input while on cooldown

**Given** the player holds a Joystick-AutoFire skill cell and drags simultaneously with the left joystick
**When** both touches are active at the same time
**Then** both touches are tracked independently by `Touch.identifier` (not `event.targetTouches[0]`)
**And** movement and ability aim operate independently without one cancelling the other (multi-touch requirement, NFR6)

---

### Story 3.4: Combat Resolution — Hitboxes, Damage & Spirit Essence Collection

As a player,
I want my abilities to hit enemies and deal damage, and for defeated enemies to drop Spirit Essence I can collect,
So that fighting enemies feels impactful and rewarding.

**Acceptance Criteria:**

**Given** an ability projectile or AoE is active in the physics world
**When** it overlaps an enemy body (planck.js collision detection in `game-rules/src/systems/combat.ts`)
**Then** damage is applied to the enemy's health in `GameState` via a `Result`-returning function (no throw)
**And** an `enemy:damaged` delta event is broadcast to the host for visual feedback
**And** if the enemy's health reaches zero, an `enemy:killed` delta is broadcast and the enemy is removed from `GameState`

**Given** an enemy is killed
**When** the `enemy:killed` event is processed
**Then** Spirit Essence is dropped at the enemy's last position in `GameState`
**And** Spirit Essence is automatically collected by any player whose character is within collection radius (planck.js sensor), or on proximity within the same tick
**And** a `essence:collected` delta event is broadcast including the collecting player's ID and amount

**Given** the host receives `enemy:damaged`, `enemy:killed`, and `essence:collected` deltas
**When** `applyDelta` processes each
**Then** enemy health bars update in-canvas, defeated enemies are removed from the entity layer, and Spirit Essence pickup visual plays
**And** the host performs no damage calculation — it only renders what the deltas specify

---

### Story 3.5: Player Health, Revive Timer & Downed State

As a player,
I want to be downed when my health reaches zero and have my teammates race to revive me before my timer runs out,
So that being downed creates urgent, social pressure without immediately ending my contribution to the run.

**Acceptance Criteria:**

**Given** a player's health reaches zero from enemy damage
**When** the `player:downed` sim event fires
**Then** the revive timer is set in `GameState` to the player's current window (60s first down, 40s second, 20s, 10s, 5s, 2s — escalating per run, not per level; values from `balance.ts`)
**And** a `player:downed` delta is broadcast to all clients

**Given** the host receives the `player:downed` delta
**When** the `revive-timer` component appears at bottom-center of the host canvas overlay
**Then** it shows the player's name in Lora 700 at sm and the countdown value in Lora 700 at xl (40px)
**And** timer text and progress bar are `accent-warm` when >10s remaining
**And** at ≤10s remaining, timer text and progress bar transition to `corruption-blood`; the amber halo behind the component intensifies
**And** the container border remains `accent-corruption` throughout (border accent only — not an urgency signal)

**Given** the downed player's phone
**When** the `player:downed` delta is received
**Then** the phone controller transitions to the spirit-form theme: background shifts to a luminous session-color glow over bg-base; 3 of 4 skill cells are locked with an 80% bg-base mask; the 4th cell shows the class-specific spirit-form ability with session-color glow border
**And** the left joystick zone remains fully functional — the downed player can still move

**Given** a teammate's character reaches the downed player's position within the revive window
**When** the revive interaction completes (proximity sensor trigger in sim)
**Then** `player:revived` delta is broadcast; the revive timer disappears from the host overlay; the revived player's `player-chip` returns to alive state
**And** the downed player's phone controller immediately returns to the standard combat theme

**Given** the revive timer reaches zero
**When** the timer expires
**Then** the player enters spirit form in `GameState`: `player-chip` dims (name to text-secondary, pips empty, accent-spirit glow rim, ghost icon in pip row); the revive timer component disappears; spirit form VFX begins in-canvas

---

### Story 3.6: Spirit Form — Downed Player Contribution & Run Failure

As a downed player in spirit form,
I want to keep moving and use my spirit ability to support my teammates,
So that entering spirit form feels like a reduced state, not elimination.

**Acceptance Criteria:**

**Given** a player is in spirit form
**When** the `GameState` reflects spirit form status
**Then** the player's in-canvas character renders as a luminous session-colored figure (sprite distinct from alive state)
**And** the `player-chip` in the host top strip shows: name dimmed to text-secondary, health pips empty, ghost icon in pip row, accent-spirit glow rim at full opacity

**Given** a spirit-form player uses the left joystick zone
**When** the `InputEventMsg` is received by the server
**Then** the spirit-form character moves in the dungeon (same movement system, spirit-form flag set in `GameState`)

**Given** a spirit-form player taps the active (4th) skill cell
**When** the spirit-form ability `InputEventMsg` is received
**Then** the class-specific spirit ability fires (defined per class in `balance.ts`); any supporting effects are applied via delta events
**And** the spirit-form ability has its own cooldown tracked separately from the class's combat abilities

**Given** multiple players are in spirit form simultaneously
**When** the host canvas renders
**Then** all spirit-form characters appear as luminous figures surrounding the remaining alive characters (The Vigil visual)
**And** no special HUD overlay is added — the in-canvas presence communicates the state

**Given** all players enter spirit form simultaneously
**When** the last alive player's health drops to zero
**Then** the simulation server broadcasts `run:failed`
**And** the run ends immediately; a partial Spirit Essence reward is calculated (placeholder value)
**And** all clients transition to a placeholder post-run failure state (full flow in Epic 4)

---

### Story 3.7: Clear Objective & Level Completion

As a group of players,
I want to fight through all enemies in the level to complete the "Clear" objective and advance,
So that the dungeon run has a clear moment of victory and forward progression.

**Acceptance Criteria:**

**Given** a dungeon level is loaded with a "Clear" objective
**When** the host screen renders
**Then** the objective label in the top strip reads "Clear" in Lora 700 at sm

**Given** the Clear objective is active
**When** all enemies in the level are killed (`enemy:killed` events have depleted the enemy pool)
**Then** the simulation server broadcasts `level:complete` with the level index
**And** the host canvas acknowledges the clear (brief ambient change or in-canvas prompt)

**Given** `level:complete` is received
**When** the level transition occurs
**Then** Spirit Essence collected during the level is tallied to each player's run total in `GameState`
**And** the revive timer for any currently downed player resets to the next escalating window value at the start of the next level (down-count carries over; only the window resets)
**And** for this epic, the transition leads to a placeholder "Run Complete" screen (full run flow in Epic 4)

**Given** unit and contract tests
**When** the test suite runs
**Then** `tests/contract/net-protocol.test.ts` verifies serialize→deserialize round-trips for all new message types introduced in E3
**And** `tests/unit/fsm.test.ts` passes all difficulty-tier transition tests

---

## Epic 4: Procedural Dungeon & Full Run Structure

Players vote to start a run at the dungeon entrance. Three procedurally generated dungeon levels (Clear + Survive the Waves) run sequentially with escalating difficulty. A placeholder victory state ends the run. Post-run summary displays on host. Procedural seed system is deterministic.

### Story 4.1: Deterministic Seed System & Floor Layout Generator

As a player,
I want every run to have a unique procedurally generated layout that all players share identically,
So that the dungeon feels fresh each session while remaining perfectly synchronized across all devices.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/prng/xoshiro128.ts` exists (from Story 3.1)
**When** the sim server's `GameRoom.onCreate` generates a run seed
**Then** independent RNG streams are derived for each generation system: `createRng(seed ^ 0x01)` for floor layout, `createRng(seed ^ 0x02)` for room pool selection, `createRng(seed ^ 0x03)` for enemy spawns, `createRng(seed ^ 0x04)` for Spirit Bond assignments
**And** the seed is broadcast to all clients in the opening `SnapshotMsg`

**Given** the floor layout generator runs with the same seed on two independent instances
**When** `tests/unit/generation.test.ts` runs
**Then** both instances produce identical floor layouts (same room count, same connection graph, same exit position)
**And** the test passes with zero randomness from `Math.random()`

**Given** the floor layout is generated
**When** a level loads
**Then** the floor plan specifies room positions, corridor connections, and exit placement
**And** room interiors are selected from the handcrafted Grassland room pool (minimum 3 distinct room templates for alpha)
**And** the boss room (level 4 slot) is always a fixed handcrafted room (placeholder in this epic — real boss in Epic 6)

---

### Story 4.2: Dungeon Entrance Vote & Run Initialisation

As a group of players,
I want to gather at the dungeon entrance, propose a run, and have everyone accept before we dive in,
So that the whole group is ready and consenting before the run begins.

**Acceptance Criteria:**

**Given** a player's character approaches the dungeon entrance POI in the hub
**When** the sim server detects the proximity (planck.js sensor)
**Then** the `interact-button` slides in on that player's phone with label "Interact"

**Given** the player taps "Interact" at the dungeon entrance
**When** the dungeon entrance UI opens on the phone
**Then** the player sees a biome selector (Grassland only in this epic) and a difficulty selector (Easy / Normal / Hard)
**And** a "Propose Run" CTA is present; tapping it broadcasts a `run:proposed` message with the chosen biome and difficulty

**Given** a `run:proposed` message is received by the simulation server
**When** the server broadcasts the proposal to all connected clients
**Then** all phones display an accept/decline popup with the proposed biome and difficulty
**And** the host screen shows a "Run proposed — waiting for votes" indicator

**Given** all connected players have tapped Accept
**When** the simulation server receives unanimous acceptance
**Then** `run:starting` is broadcast to all clients
**And** the host transitions from the Hub World screen to the Dungeon Run (HUD) screen
**And** all phones transition from hub controller to in-run controller

**Given** any player taps Decline
**When** the vote fails
**Then** the proposal is cancelled; all popups dismiss; the proposing player can re-propose

---

### Story 4.3: 3-Level Run Structure & Level Transitions

As a player,
I want to progress through three dungeon levels with the dungeon getting harder each level,
So that each run has a sense of escalating stakes and forward momentum.

**Acceptance Criteria:**

**Given** a run has started
**When** Level 1 loads
**Then** the level index and biome name are displayed in the host top strip (Lora 700, sm, text-primary)
**And** the level is populated with enemies from the Grassland pool appropriate to "early room" tier (fewer enemies, simpler composition)
**And** PixiJS `Assets.backgroundLoad()` is called during Level 1 for any biome assets needed in later levels — no mid-combat asset hitches

**Given** Level 1's objective is completed
**When** `level:complete` fires for index 0
**Then** Spirit Essence is tallied; revive windows advance for any previously downed players
**And** Level 2 loads with "mid-tier" room pool (increased enemy count and variety scaled by player count)
**And** the top strip updates to show "Level 2"

**Given** Level 2 is completed
**When** `level:complete` fires for index 1
**Then** Level 3 loads with "late-tier" room pool (highest pre-boss enemy density)

**Given** Level 3 is completed
**When** `level:complete` fires for index 2
**Then** the placeholder Level 4 (boss slot) loads — a static empty room with a "Victory" trigger zone at the far end
**And** when the team reaches the trigger zone, `run:complete` is broadcast and the post-run summary renders

---

### Story 4.4: Survive the Waves Objective

As a player,
I want some levels to challenge me to hold out against waves of enemies rather than hunt them all down,
So that each level feels tactically different and requires different positioning.

**Acceptance Criteria:**

**Given** a level is generated with a "Survive the Waves" objective
**When** the level loads
**Then** the objective label in the host top strip reads "Survive: N Waves" where N is the wave count for this level tier (from `balance.ts`)

**Given** the Survive objective is active
**When** Wave 1 spawns
**Then** a defined set of enemies enters from spawn points at the room edges
**And** a wave progress indicator is visible on the host screen (e.g., "Wave 1 / 3")

**Given** all enemies in the current wave are killed
**When** the wave is cleared
**Then** a brief pause occurs before the next wave spawns (duration from `balance.ts`)
**And** the wave counter increments; enemy count and composition scale upward for the next wave

**Given** all waves are cleared
**When** the final wave's last enemy is killed
**Then** `level:complete` fires and the level transition proceeds identically to the Clear objective flow

**Given** the run failure condition
**When** all players enter spirit form during a Survive the Waves level
**Then** `run:failed` fires regardless of objective type and partial Spirit Essence rewards apply

---

### Story 4.5: Post-Run Summary Screen

As a player,
I want to see a clear summary of our run's outcome on the host screen with each player's performance,
So that we can celebrate victory or reflect on defeat before deciding whether to run again.

**Acceptance Criteria:**

**Given** `run:complete` or `run:failed` is received by the host client
**When** the Post-Run Summary screen renders
**Then** a victory tone headline (e.g., "Purified. The campfire noticed.") renders in Uncial Antiqua at xl (40px) for a successful run
**And** a failure tone headline (e.g., "Tonight, the forest held its ground.") renders for a failed run
**And** the team's total Spirit Essence earned displays in Lora 700 in `accent-warm`

**Given** the summary is showing
**When** per-player rows render
**Then** one `post-run-card` row appears per player: player name (Lora 700, base, text-primary), class name (Lora 400, sm, text-secondary), times downed count ("Downed ×N"), Spirit Essence earned (Lora 700, base, accent-warm)
**And** failure state rows dim player name and class to text-secondary and show partial Spirit Essence

**Given** a player taps "Return to Camp" on their phone
**When** that player's readiness is recorded
**Then** the host summary screen persists — it does not auto-transition

**Given** all active players have tapped "Return to Camp"
**When** the last readiness confirmation is received
**Then** the host transitions back to the Hub World screen and all phones return to hub controller layout

---

### Story 4.6: End-to-End Run E2E Test & Latency Baseline

As a development team,
I want an automated end-to-end test covering the full run happy path and a latency measurement confirming we are inside the 100ms budget,
So that we can detect regressions as the codebase grows and have data to validate our architecture's performance.

**Acceptance Criteria:**

**Given** `tests/e2e/full-run.test.ts` is implemented
**When** it runs against a local simulation server with 3 simulated players
**Then** it exercises: session creation → 3 players join → host starts game → Level 1 Clear → Level 2 Survive Waves → Level 3 Clear → placeholder Level 4 victory → post-run summary → all players Return to Camp → hub returns
**And** the test passes end-to-end without manual intervention

**Given** `tools/latency-baseline/` measurement scripts exist
**When** run against a local LAN setup (host + 1 mobile)
**Then** the measured p95 input latency (mobile joystick input → host screen delta received) is logged
**And** if p95 exceeds 100ms, the script outputs a warning (not a failure — data collection only at this stage)

**Given** `tests/e2e/reconnect.test.ts`
**When** it runs
**Then** it verifies: player drops → grace timer starts → player rejoins within 30s → slot restored → snapshot received

