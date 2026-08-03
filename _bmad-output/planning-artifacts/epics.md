---
stepsCompleted: ['step-01-validate-prerequisites', 'step-02-design-epics', 'step-03-create-stories', 'step-04-final-validation', 'step-03-epic-6-stories', 'step-03-epic-3-extension-ability-mechanics']
inputDocuments:
  - '_bmad-output/planning-artifacts/gdds/gdd-party-delve-2026-06-13/gdd.md'
  - '_bmad-output/game-architecture.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md'
  - '_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md'
  - '_bmad-output/brainstorming/brainstorming-session-2026-07-08-131737.md'
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
| FR3 | E1 (guest), E8 (complete) | Guest access without registration |
| FR4 | E8 | Registered persistent progression |
| FR5 | E2 | Hub village with all POIs |
| FR6 | E4 | 3 dungeon levels + boss structure |
| FR7 | E4 | Procedural floor layout + handcrafted room pool |
| FR8 | E4 | Single shared deterministic seed |
| FR9 | E3 (Clear), E4 (Survive Waves) | Level objective types |
| FR10 | E4 | Group dungeon entrance vote |
| FR11 | E3 (4 classes), E9 (all 10) | Class roster |
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
| FR23 | E3 (collection), E8 (persistence) | Spirit Essence currency |
| FR24 | E6 (reward reveal), E8 (persistence) | Post-run rewards |
| FR25 | E8 | Hub shop (registered players) |
| FR26 | E8 | Mastery counters + ability variants |
| FR27 | E1 | 30s disconnect grace period |
| FR28 | E1 | Reconnect restores full slot/state |
| FR29 | E4, E11 | Post-run summary display |
| FR30 | E4 | Summary persists until all Return to Camp |
| FR31 | E1 | Lobby QR + session code + real-time slots |
| FR32 | E1 | Host kick (hold-to-confirm) |
| FR33 | E1 | Host starts the game |
| FR34 | E4 (Grassland), E10 (+ Forest) | Biome count |
| FR35 | E6 (Grassland), E10 (Forest) | Per-biome enemy/boss/achievements |
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

### Epic 7: Ability & Environmental VFX Prototyping
Every shipped ability (16 across the 4 alpha classes) and the Grassland boss's attacks get a distinct, shape/particle-based visual identity — replacing today's undifferentiated flat-color circles — before any final pixel art is integrated. Status effects, projectiles, zones, boss charge telegraphs, and existing environmental effects (purification pulse, bond tethers) are brought to a consistent prototype-quality bar.
**FRs covered:** none new — visual-groundwork epic, scoped from direct user observation of the shipped combat systems (Epics 3, 3 Extension, 6). See `sprint-change-proposal-2026-07-21.md`. Precedes final art production per the GDD's Art Direction section (PixelLab MCP, no references yet).

### Epic 8: Progression & Persistent Meta
Registered player accounts work end-to-end: Spirit Essence accumulates across runs, mastery counters track per-ability usage, and the hub shop lets registered players spend on skins and enhancements. Guest and registered players compete in the same run without structural disadvantage.
**FRs covered:** FR3 (fully complete with registration), FR4, FR23 (persistence), FR24 (Spirit Essence persists), FR25, FR26

### Epic 9: Full Class Roster
The remaining 6 classes (Sunwarden, Wildshaper, Songweaver, Trailhunter, Shadowstalker, Windwalker) are fully implemented and playable, completing the roster of 10 radically asymmetric classes.
**FRs covered:** FR11 (all 10 classes complete)

### Epic 10: Ancient Forest Biome
The second biome is fully playable — distinct corrupted enemy pool, unique boss, biome-specific achievement set, and a visual identity distinct from Grassland. Players can select the biome at the dungeon entrance.
**FRs covered:** FR34 (2 biomes complete), FR35 (Ancient Forest complete)

### Epic 11: Polish, Performance & Telemetry
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

### Story 2.8: Hub Ability Use Outside Training-Dummy POI

As a player,
I want to use my abilities anywhere in the hub, not only near the training dummy,
So that the trainer POI can be repurposed for something else without blocking normal ability use.

**Acceptance Criteria:**

**Given** a player with a confirmed class is anywhere in the hub (not in a dungeon)
**When** they activate a skill cell
**Then** the ability fires exactly as it would in a dungeon — the `nearPoiId === 'training-dummy'` requirement is removed from the hub ability-processing guard
**And** this supersedes Story 2.4's original scoping of ability use to the training-dummy POI specifically

**Given** the training-dummy POI itself
**When** this story ships
**Then** the POI's zone, interact button, and targetable-dummy visuals are unchanged — only the ability-use gate is removed; repurposing the POI is out of scope for this story

---

### Epic 2 Correction: Hub POI Cleanup & Class-Pick Button Fit

Scoped from the 2026-08-03 correct-course review of the user's own `TODO.md` notes — not new PRD/GDD FRs. Story 2.8 already made the training-dummy POI redundant (abilities work everywhere in the hub) but explicitly deferred removing the POI itself; Story 2.10 closes that. Story 2.11 fixes a pre-existing overflow bug in Story 2.2's ability-briefing panel, found during the same review.

### Story 2.10: Remove Training-Dummy POI

As a player,
I want the hub to no longer have a training-dummy POI with no purpose,
So that the hub isn't cluttered with an interactive zone that does nothing Story 2.8 didn't already make possible everywhere.

**Acceptance Criteria:**

**Given** `HUB_POIS` (`packages/shared-types/src/poi.ts:19`) currently includes a `training-dummy` entry
**When** this story ships
**Then** the `training-dummy` entry and the now-unused `PoiType.TRAINING_DUMMY` value are removed
**And** no sim-server code change is needed — `GameRoom.ts`'s POI sensor loop (`GameRoom.ts:379`) iterates `INTERACTIVE_HUB_POIS` generically, so removing the entry from the shared array removes the sensor with it

**Given** `HubWorldScreen.tsx`'s POI rendering (dummy graphics fill at `:107-110`, the `TRAINING_DUMMY`-conditional color/label at `:148`/`:158`)
**When** this story ships
**Then** this dummy-specific render code is removed along with the POI

**Given** the hub now has 2 POIs (class-select, dungeon-entrance)
**When** a player walks the hub
**Then** no interact prompt, chat bubble, or targetable visual ever appears for a training-dummy POI, and no other code path still references `PoiType.TRAINING_DUMMY` or the string `'training-dummy'`

**Non-goals:** no replacement POI or repurposing of the freed hub space — out of scope for this story.

---

### Story 2.11: Class-Pick Button Fit

As a player picking a class on my phone,
I want the "Pick Selected Class" button's label to fully fit inside the button,
So that I can read the full confirm action instead of it clipping at the wrapper's edge.

**Acceptance Criteria:**

**Given** the ability-briefing panel's confirm button (`ControllerScreen.tsx:456-497`), a fixed `flex: '0 0 20%'` column whose label `<span>` has no wrap styling
**When** this story ships
**Then** the label wraps per-word (`whiteSpace: 'normal'`, `wordBreak: 'break-word'`) instead of clipping, and the button/wrapper flexes to fit a two-line label without vertical overflow
**And** the button's touch target remains at least 44×44px (already satisfied by the existing `minHeight: 48`)

**Given** this is a CSS-only fix
**When** this story ships
**Then** no other class-selection behavior (card browse, selection state, `onPickClass` handler) changes

**Non-goals:** no copy change (label stays "Pick Selected Class" — wrapping resolves the fit, not a shortened label).

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

### Epic 3 Extension: Ability Mechanics Rework

Scoped from the 2026-07-08 brainstorming session (`_bmad-output/brainstorming/brainstorming-session-2026-07-08-131737.md`), not from new PRD FRs. Of the 16 abilities across the 4 alpha classes, 7 were placeholder no-ops (Iron Skin, Ancestor's Voice, Spirit Nova, Soul Mend, Warding Cry, Dark Pact, Storm Eye), Spirit Nova was mislabeled, and Blood Draw had no lifesteal despite its flavor. Stories 3.11–3.15 build the 5 shared engine capabilities the reworked kit depends on (input taxonomy, status effects, projectiles/zones, displacement, self-cost/mixed-faction targeting); Stories 3.16–3.20 apply them per class. Sequenced so no story depends on a later one.

### Story 3.11: Ability Input Taxonomy Expansion & Type Corrections

As a simulation engineer,
I want the `AbilityInputType` taxonomy extended to cover Aim+Cast alongside the existing three types, and the real input-type mismatches corrected,
So that every ability's server-side dispatch matches its actual intended activation feel before any ability rework begins.

**Acceptance Criteria:**

**Given** `packages/shared-types/src/input.ts` defines `AbilityInputType`
**When** the type is extended
**Then** it becomes `'AUTO' | 'RELEASE' | 'TAP' | 'AIM_CAST'` — the existing three values are kept as-is (they already map to Aim+Hold/Channel, Aim+Release, and Instant/Tap respectively) and only `AIM_CAST` is added, since no ability in the final spec uses a non-aimed Cast/Charge type
**And** no rename of `AUTO`/`RELEASE`/`TAP` occurs, to avoid unnecessary churn across `game-rules`, `simulation-server`, and `mobile-controller`

**Given** `packages/shared-types/src/class-definitions.ts` `CLASS_DEFINITIONS`
**When** the input types are cross-checked against the brainstorming session's Final Ability Spec Sheet table
**Then** exactly 6 corrections are applied: Tremor Stomp `RELEASE`→`TAP`, Stone Wall `TAP`→`RELEASE`, Soul Mend `RELEASE`→`AIM_CAST`, Dark Pact `TAP`→`RELEASE`, Void Pulse `TAP`→`RELEASE`, Storm Eye `AUTO`→`RELEASE`
**And** Avalanche's `AUTO` and Ancestor's Voice's `AUTO` are left unchanged — the session's "Stone Wall/Avalanche swap" note does not match the final spec table, which only changes Stone Wall and Tremor Stomp

**Given** `packages/game-rules/src/systems/abilities.ts` `dispatchAbility`
**When** resolving `directionX`/`directionY` for an ability
**Then** only `TAP` abilities zero the direction; `AUTO`, `RELEASE`, and `AIM_CAST` all pass through the caller-supplied direction
**And** `AIM_CAST` is accepted by `dispatchAbility` without a runtime error, even though the channel/cancel behavior itself is implemented in Story 3.18

**Given** unit tests
**When** `tests/unit/abilities.test.ts` runs
**Then** a table-driven test asserts all 16 abilities' `inputType` in `CLASS_DEFINITIONS` matches the corrected spec, and `dispatchAbility`'s direction-zeroing behavior is verified for all 4 input types

---

### Story 3.12: Status-Effect Engine (Buffs/Debuffs with Duration)

As a simulation engineer,
I want a reusable status-effect system for timed buffs and debuffs on players and enemies,
So that Iron Skin, Tremor Stomp's slow, Dark Pact's buff, Warding Cry's shield, and Storm Eye's tick all share one mechanism instead of bespoke per-ability flags.

**Acceptance Criteria:**

**Given** `packages/shared-types/src/player.ts` `PlayerState` and `packages/shared-types/src/enemy.ts` `EnemyState`
**When** the status-effect engine lands
**Then** both gain a `statusEffects: StatusEffect[]` field, where `StatusEffect = { type: 'damageReduction' | 'slow' | 'damageBuff' | 'shield'; magnitude: number; expiresAtMs: number }`
**And** the existing single-purpose `stompedUntil` field on `PlayerState` is removed in favor of a `'slow'` status effect, so there is one mechanism, not two

**Given** `packages/game-rules/src/systems/status-effects.ts` (new)
**When** `applyStatusEffect(target, effect, nowMs)` is called
**Then** it returns `Result<{ target: PlayerState | EnemyState }, StatusEffectError>` with the effect appended, replacing any existing effect of the same type rather than stacking duplicates
**And** `tickStatusEffects(target, nowMs)` returns the target with all effects whose `expiresAtMs <= nowMs` removed — pure, no I/O, no throw

**Given** a damage or movement calculation reads an entity's status effects
**When** a `'damageReduction'` effect is present
**Then** incoming damage in `combat.ts`/`player-health.ts` is multiplied by `(1 - magnitude)` before being applied
**And** when a `'slow'` effect is present, movement speed is multiplied by `(1 - magnitude)` in the movement system, replacing the StompLayer's direct `stompedUntil` check from Story 3.2

**Given** the sim tick loop
**When** a status effect is applied or expires
**Then** a `status:applied` / `status:expired` delta event is broadcast with target id, effect type, and expiry, and the host renders a generic status badge/aura (per-ability-specific art is out of scope)

**Given** unit tests
**When** `tests/unit/status-effects.test.ts` runs
**Then** apply/replace/tick/expire and the damage-reduction/slow multiplier math are each covered, with no Colyseus or planck.js imports

---

### Story 3.13: Projectile Physics & Zone/Field Entities

As a simulation engineer,
I want projectile bodies that travel and collide, and persistent Zone/Field entities that tick and can be chained from a projectile impact,
So that Blood Spike, Void Pulse, and Storm Eye have the delivery mechanisms their specs require instead of instant hitscan.

**Acceptance Criteria:**

**Given** `apps/simulation-server/src/physics/world.ts`
**When** a projectile-type ability fires
**Then** `createProjectileBody()` spawns a dynamic planck.js body with `isSensor: true`, velocity along the input direction, and a max travel distance/lifetime from new `balance.ts` constants (`PROJECTILE_SPEED_PX_S`, `PROJECTILE_MAX_RANGE_PX`)
**And** the projectile is tracked in `GameState` via a new `ProjectileState[]` array (id, ownerId, x, y, class, abilityIndex)

**Given** a projectile's sensor body overlaps an enemy or ally body
**When** the planck.js contact listener fires (same pattern as the existing Spirit Bond proximity sensors in `apps/simulation-server/src/physics/sensors.ts`)
**Then** the projectile resolves its effect via `combat.ts`/`player-health.ts` exactly once, broadcasts `projectile:hit`, and is removed from `GameState`
**And** a projectile that exceeds its max range/lifetime without a hit is removed with a `projectile:expired` delta and no effect applied

**Given** `packages/game-rules/src/systems/zones.ts` (new)
**When** a Zone/Field ability fires — spawned directly (Storm Eye) or chained from a projectile impact (Void Pulse)
**Then** a `ZoneState` entity (id, ownerId, x, y, radius, effectType, tickIntervalMs, expiresAtMs) is added to `GameState`, backed by a stationary planck.js sensor body
**And** every `tickIntervalMs`, all bodies overlapping the zone's sensor have the zone's effect reapplied, broadcast as `zone:tick`
**And** when `nowMs >= expiresAtMs`, the zone and its sensor body are removed with `zone:expired`

**Given** a projectile-impact ability configured to chain into a zone (Void Pulse)
**When** the projectile resolves its hit
**Then** impact damage is applied first, then a `ZoneState` is spawned at the impact position using that ability's zone parameters from `balance.ts` — the chain is declarative per-ability config, not a special-cased branch in the projectile code

**Given** unit tests
**When** `tests/unit/zones.test.ts` and `tests/unit/projectiles.test.ts` run
**Then** zone tick reapplication and expiry, and projectile hit/expire resolution, are covered as pure functions; physics body creation itself is exercised via a sim-server integration test, matching the existing `world.ts` test split

---

### Story 3.14: Displacement/Pull Physics Primitive

As a simulation engineer,
I want a reusable displacement/pull force,
So that Stone Wall's drag and Void Pulse's vacuum zone use one mechanism instead of two bespoke implementations.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/systems/displacement.ts` (new)
**When** `applyDisplacement(target, sourceX, sourceY, strength)` is called
**Then** it returns a velocity vector pointing from the target toward the source, scaled by `strength`, as a pure calculation with no planck.js import
**And** `apps/simulation-server` applies this vector as a one-tick impulse via `body.applyLinearImpulse` (not a direct position mutation), preserving normal collision resolution

**Given** Stone Wall fires (Cone/Line, long reach)
**When** any enemy overlaps the cone's hit zone (`isInHitZone`)
**Then** each hit enemy takes Stone Wall's configured damage and receives a displacement impulse pulling it toward the caster's position at cast time

**Given** Void Pulse's chained zone (Story 3.13)
**When** a unit — ally or enemy — is inside the zone on a tick
**Then** it receives a displacement impulse toward the zone's center on every zone tick, using the same `applyDisplacement` function as Stone Wall

**Given** displacement is applied near arena bounds or other bodies
**When** the impulse would push a unit into a wall or another body
**Then** planck.js's own collision resolution handles it — no bespoke bounds-clamping is added (ponytail: revisit only if playtesting shows a problem)

**Given** unit tests
**When** `tests/unit/displacement.test.ts` runs
**Then** `applyDisplacement`'s direction/magnitude math is verified across several source/target configurations, including target-equals-source (zero-vector guard, no divide-by-zero)

---

### Story 3.15: Self-Cost Resource & Mixed-Faction Target Resolution

As a simulation engineer,
I want a self-cost (HP-as-resource) mechanic and a single-query mixed-faction target resolver,
So that Blood Spike, Crimson Lash, and Dark Pact share one cost mechanism, and Ancestor's Voice/Spirit Nova share one targeting query instead of separate ally/enemy code paths.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/systems/abilities.ts` `dispatchAbility`
**When** an ability has a self-cost defined in a new `ABILITY_SELF_COST_HP` table in `balance.ts` (0 for abilities without a cost)
**Then** the caster's HP is reduced by `min(selfCostHp, casterHp - 1)` before the ability resolves — a 1-HP safety floor that caps the cost rather than blocking the cast, per the session's Blood Spike ruling
**And** if the caster's HP is already 1, the ability still fires with zero HP actually deducted

**Given** Blood Spike hits an enemy
**When** damage is applied via `combat.ts`
**Then** the caster is healed for 50% of the damage dealt (lifesteal = Damage+Heal fired together, not a new primitive)
**And** on a miss (projectile expires without a hit), the self-cost HP is still lost with no compensating heal

**Given** `packages/game-rules/src/systems/targeting.ts` (new)
**When** a mixed-faction ability (Ancestor's Voice, Spirit Nova) resolves its hit zone
**Then** `resolveMixedFactionTargets(casterFaction, targetsInZone)` returns allies (receive the ability's heal value) and enemies (receive the ability's damage value) from one hit-zone query — no separate ally-query/enemy-query paths
**And** a target's faction is derived from whether it is a `PlayerState` or `EnemyState`, with no new stored "faction" field

**Given** Crimson Lash fires
**When** damage is calculated
**Then** damage scales inversely with the caster's current HP fraction via a new tunable `balance.ts` constant, verified by a test asserting damage increases as caster HP decreases

**Given** unit tests
**When** `tests/unit/self-cost.test.ts` and `tests/unit/targeting.test.ts` run
**Then** the 1-HP floor edge case, lifesteal math, and mixed-faction split are each covered independently of any specific ability

---

### Story 3.16: Stonehide Kit Rework

As a player,
I want Stonehide's full kit — Iron Skin, Avalanche, Tremor Stomp, Stone Wall — implemented per the final spec,
So that Stonehide plays as a gather/mitigate/control/sustain tank instead of shipping two placeholder abilities.

**Acceptance Criteria:**

**Given** Iron Skin fires (`TAP`, Self)
**When** the ability resolves
**Then** a `'damageReduction'` status effect (magnitude and duration from new `balance.ts` constants) is applied to the caster via `applyStatusEffect` (Story 3.12), replacing the current damage=0 no-op

**Given** Tremor Stomp fires (`TAP` after Story 3.11's correction, self-centered Proximity/Radius)
**When** it resolves
**Then** all enemies within `ABILITY_HIT_RADIUS_PX` of the caster take AoE damage and receive a `'slow'` status effect (magnitude/duration from `balance.ts`)

**Given** Stone Wall fires (`RELEASE` after Story 3.11's correction, Cone/Line, long reach)
**When** it resolves
**Then** every enemy in the cone takes Stone Wall's configured damage and is pulled toward the caster via `applyDisplacement` (Story 3.14)

**Given** Avalanche (basic attack) fires (`AUTO`, Cone/Line)
**When** it resolves
**Then** it deals its existing configured damage unchanged — Avalanche was already correct; this story only confirms no regression via existing test coverage

**Given** `tests/unit/abilities.test.ts`
**When** Stonehide's full kit is exercised
**Then** Iron Skin's damage reduction, Tremor Stomp's damage+slow, and Stone Wall's damage+pull each have a dedicated test case

---

### Story 3.17: Spiritcaller Kit Rework (Ancestor's Voice, Spirit Nova, Warding Cry)

As a player,
I want Ancestor's Voice, Spirit Nova, and Warding Cry implemented per the final spec,
So that Spiritcaller's sustain/burst/defend kit works as intended (Soul Mend's revive interaction is covered separately in Story 3.18).

**Acceptance Criteria:**

**Given** Ancestor's Voice fires (`AUTO`, Cone/Line, mid-range)
**When** it resolves
**Then** `resolveMixedFactionTargets` (Story 3.15) splits targets in the cone into allies (healed) and enemies (damaged) from one query, replacing the current heal-only placeholder

**Given** Spirit Nova fires (`TAP`, Expanding Radius)
**When** it resolves
**Then** a new `resolveExpandingRadius` helper in `packages/game-rules/src/systems/targeting.ts` grows a hit-zone radius from 0 to its max over a short duration, ticking on the sim's cadence, applying mixed-faction heal/damage to everyone it sweeps over — fixing the current mislabel (code deals damage only; spec is mixed-faction)

**Given** Warding Cry fires (`TAP`, self-centered Proximity/Radius)
**When** it resolves
**Then** all allies within `ABILITY_HIT_RADIUS_PX` of the caster receive a `'shield'` status effect (temporary flat damage absorption, Story 3.12), replacing the current damage=0 no-op

**Given** Soul Mend
**When** this story is scoped
**Then** Soul Mend is explicitly out of scope — it is fully covered by Story 3.18

**Given** `tests/unit/abilities.test.ts` and `tests/unit/targeting.test.ts`
**When** Spiritcaller's reworked kit is exercised
**Then** Ancestor's Voice and Spirit Nova's mixed-faction resolution, and Warding Cry's shield application, are each covered

---

### Story 3.18: Soul Mend — Ranged Spirit-Targeting Revive

As a Spiritcaller,
I want to channel Soul Mend at a downed ally's spirit from range to revive them directly,
So that I can save a teammate without walking to their body, at the cost of a longer, interruptible cast.

**Acceptance Criteria:**

**Given** a player triggers Soul Mend (`AIM_CAST`)
**When** they hold the input aimed at a downed ally's spirit-form position
**Then** the sim server starts a 2–3s channel (duration from a new `balance.ts` constant), tracked per-player in `GameState` via `channelingAbility: { abilityIndex, targetPlayerId, startedAt, durationMs } | null`, and a `cast:started` delta is broadcast

**Given** a channel is in progress
**When** the caster releases input early, moves out of range, or the target dies or is revived by someone else before completion
**Then** the channel is cancelled server-side, `channelingAbility` is cleared, and `cast:cancelled` is broadcast — no ability effect is applied and Soul Mend does not enter cooldown on a cancelled cast

**Given** the target must be a downed ally's spirit specifically
**When** the sim validates the Soul Mend target
**Then** it rejects targets not currently in `isDown` state (reuses `PlayerState.isDown`; no new spirit-targeting field), using the same range-limit rule as every other ability (no map-wide exception, per the session's ruling)

**Given** the channel completes without interruption
**When** `nowMs >= startedAt + durationMs`
**Then** the target is revived directly — same state transition as the existing proximity-based revive in `player-health.ts` (`isDown: false`, `reviveTimerExpiresAt: 0`, HP set to `REVIVE_HP`) — bypassing the normal walk-to-body proximity-sensor revive flow entirely, and Soul Mend enters its normal cooldown

**Given** unit and integration tests
**When** `tests/unit/soul-mend.test.ts` runs
**Then** channel-start, cancel-on-each-interrupt-cause, target validation, and completion-revive are covered as pure `game-rules` logic, with a sim-server integration test verifying the channel timer ticks correctly across multiple ticks

---

### Story 3.19: Souldrinker Kit Rework (Blood Spike, Crimson Lash, Dark Pact, Void Pulse)

As a player,
I want Souldrinker's full kit — Blood Spike, Crimson Lash, Dark Pact, Void Pulse — implemented per the final spec,
So that Souldrinker plays as a coherent risk/reward blood-magic class instead of a flat-damage drain with no lifesteal.

**Acceptance Criteria:**

**Given** Blood Draw is renamed Blood Spike (`AUTO`, unchanged, Projectile delivery)
**When** it fires
**Then** it spawns a projectile (Story 3.13) with the self-cost + 50%-lifesteal-on-hit behavior from Story 3.15, replacing the current instant-hitscan drain with no lifesteal
**And** the display name updates from "Blood Draw" to "Blood Spike" in `CLASS_DEFINITIONS` and the mobile skill-cell label

**Given** Crimson Lash fires (`RELEASE`, unchanged, Cone/Line)
**When** it resolves
**Then** damage scales inversely with the caster's current HP per Story 3.15's formula, hitting every enemy in the cone

**Given** Dark Pact fires (`RELEASE` after Story 3.11's correction, targets a living ally)
**When** it resolves
**Then** it drains 10% of the target ally's current HP to the caster (applied to both players in the same tick via `player-health.ts`) and grants the caster a `'damageBuff'` status effect (+25% damage, temporary, Story 3.12) — no down-safety floor, so this can push the target into a down state (intentional risk per the session's ruling)

**Given** Void Pulse fires (`RELEASE` after Story 3.11's correction, Projectile → chained Zone/Field)
**When** the projectile impacts
**Then** it deals its configured damage and spawns a pull zone (Story 3.13's chaining + Story 3.14's displacement) affecting both allies and enemies

**Given** `tests/unit/abilities.test.ts`
**When** Souldrinker's full reworked kit is exercised
**Then** Blood Spike's self-cost/lifesteal/projectile behavior, Crimson Lash's inverse-HP scaling, Dark Pact's drain-transfer, and Void Pulse's impact+pull each have a dedicated test case

---

### Story 3.20: Stormcaller — Storm Eye Rework

As a Stormcaller,
I want Storm Eye to place a persistent damage zone with periodic lightning strikes,
So that my ultimate creates lasting area pressure instead of doing nothing.

**Acceptance Criteria:**

**Given** Storm Eye fires (`RELEASE` after Story 3.11's correction, placement)
**When** it resolves
**Then** a `ZoneState` (Story 3.13) is placed at the aimed position with a steady damage tick for its configured duration, replacing the current damage=0 no-op

**Given** the Storm Eye zone is active
**When** each periodic strike interval elapses (a separate, longer interval than the steady tick, from a new `balance.ts` constant)
**Then** a bonus lightning-bolt strike deals extra damage to one random target currently inside the zone, selected via the sim's xoshiro128++ RNG instance — no `Math.random()` (AR8) — broadcast as its own delta distinct from the steady `zone:tick` event

**Given** Lightning Arc, Tempest Hurl, and Thunder Clap
**When** this story is scoped
**Then** these three abilities are explicitly out of scope — the session confirmed them as already correct, no rework needed

**Given** unit tests
**When** `tests/unit/storm-eye.test.ts` runs
**Then** steady-tick damage and random-strike selection (with a seeded RNG for determinism, per NFR7) are each covered

---

### Epic 3 Correction: Downed Player Body/Spirit Entity Split

Scoped from the 2026-07-14 correct-course review of `TODO.md` — not new PRD/GDD FRs. Today `PlayerState` tracks a single `x`/`y`: frozen in place while `isDown`, then that same position starts moving once `isSpirit` becomes true (Story 3.6). This story splits that into a fixed body position (revive target) and an independently-moving spirit position, split across three ownership areas per CLAUDE.md's cross-context rule. Sequenced 3.21a → 3.21b → 3.21c; 3.21b must explicitly re-verify Story 3.18 (Soul Mend)'s ranged spirit-targeting still resolves correctly once the spirit position diverges from the body position.

### Story 3.21a: Body/Spirit Position Schema & Protocol Contract

As a protocol architect,
I want `PlayerState` and its wire deltas to carry a fixed body position alongside the existing (now spirit-only) position,
So that downstream simulation and rendering work has a stable contract to build on.

**Acceptance Criteria:**

**Given** `packages/shared-types/src/player.ts` `PlayerState`
**When** the schema is extended
**Then** it gains `bodyX: number` and `bodyY: number`, set once when `isDown` first becomes `true` and left unchanged until the player is revived
**And** the existing `x`/`y` fields remain the single source of truth for the player's controllable position (body while down-and-not-yet-spirit, spirit once `isSpirit` is true)

**Given** `packages/net-protocol` delta messages for `player:downed` and `player:revived`
**When** the schema change lands
**Then** `player:downed` includes `bodyX`/`bodyY` in its payload, and both messages have a serialize→deserialize round-trip contract test added to `tests/contract/net-protocol.test.ts`

**Given** this is a contract-change per CLAUDE.md
**When** the change is proposed
**Then** it is reviewed by the Protocol Architect and `docs/adr/**` is updated to record the body/spirit split decision

---

### Story 3.21b: Body/Spirit Movement & Revive-Targeting Logic

As a simulation engineer,
I want the downed body to stay fixed while the spirit moves independently once spirit form begins,
So that teammates revive the body's location, not a moving target, while the downed player can still act via their spirit.

**Acceptance Criteria:**

**Given** a player's health reaches zero
**When** `player:downed` fires
**Then** `bodyX`/`bodyY` are set to the player's current position and velocity is zeroed (unchanged from today's frozen-while-down behavior)

**Given** the revive timer expires and `isSpirit` becomes `true`
**When** the spirit-form player sends movement input
**Then** `x`/`y` move independently of `bodyX`/`bodyY`, which remain fixed at the down location

**Given** a teammate attempts to revive a downed player
**When** the proximity check runs (`GameRoom.ts` revive resolution, currently comparing `teammate.x/y` to `player.x/y`)
**Then** it compares against `bodyX`/`bodyY` instead, regardless of where the spirit has moved

**Given** Story 3.18's Soul Mend ranged revive
**When** a Spiritcaller channels Soul Mend at a downed ally
**Then** it continues to target the spirit's current `x`/`y` (unchanged targeting behavior) — verified with a regression test added to `tests/unit/soul-mend.test.ts` confirming Soul Mend still resolves correctly once body and spirit positions diverge

---

### Story 3.21c: Host Rendering — Distinct Body & Spirit Entities

As a player watching the host screen,
I want to see a downed teammate's body where they fell and their spirit moving separately,
So that the revive objective (reach the body) is visually clear even after the spirit has wandered off.

**Acceptance Criteria:**

**Given** a player is downed
**When** the host canvas renders
**Then** a body sprite renders at `bodyX`/`bodyY` (replacing today's single frozen figure) for the duration of the down state

**Given** the player enters spirit form
**When** the host canvas renders
**Then** a separate luminous spirit figure (Story 3.6's existing visual) renders at `x`/`y`, independently of the body sprite, until the player is revived or the run ends

**Given** the player is revived (proximity or Soul Mend)
**When** `player:revived` is received
**Then** the body sprite is removed and the player's normal alive-state rendering resumes at the body's location

---

### Epic 3 Correction: Cone Hit-Geometry & Stormcaller Delivery Rework

Scoped from the 2026-07-28 correct-course review of the user's own `TODO.md` notes — not new PRD/GDD FRs. Closes a spec/implementation drift: Stories 3.16, 3.17, and 3.19 each documented Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash as `Cone/Line` delivery, but `isInHitZone` has only ever implemented a circle. Also reopens Story 3.20's explicit "Lightning Arc, Tempest Hurl... already correct, no rework needed" scoping note, per the user's direct request. See ADR-0005. Sequenced 3.25 → 3.26 (3.26 reuses 3.25's `isInConeZone` primitive for Lightning Arc's targeting corridor).

### Story 3.25: CONE Hit-Geometry Contract & Stonehide/Spiritcaller/Souldrinker Cone Conversion

As a player,
I want Stone Wall, Avalanche, Ancestor's Voice, and Crimson Lash to hit a true cone in front of me instead of a circle offset along my aim,
So that these abilities match their long-documented "Cone/Line" spec instead of silently behaving as a circle, and reward aiming at a spread of enemies the way a cone reads visually.

**Acceptance Criteria:**

**Given** a new `AbilityHitShape` contract (`packages/shared-types/src/ability-geometry.ts`)
**When** an ability's `ABILITY_HIT_SHAPE` entry is `'cone'`
**Then** its hit-test uses a new pure `isInConeZone` function (`packages/game-rules/src/systems/combat.ts`) — apex at the caster, aimed along the cast direction, length = the ability's existing `ABILITY_HIT_RANGE_PX` entry (reused, not duplicated), half-angle = half of a new `ABILITY_CONE_ANGLE_DEG` entry — instead of `isInHitZone`'s circle-vs-circle test

**Given** Stone Wall (stonehide[0], 50°) and Avalanche (stonehide[3], 40°)
**When** either fires
**Then** it hits every enemy in its cone instead of its old offset circle; Stone Wall's pull-toward-caster displacement is unaffected

**Given** Ancestor's Voice (spiritcaller[0], 70°)
**When** it fires
**Then** its mixed-faction split (allies healed / enemies damaged, `resolveMixedFactionTargets`) resolves over a cone instead of a circle — `gatherPlayersInHitZone` gains an optional cone mode so this is the only caller needing it (Warding Cry's proximity-radius call is unaffected)

**Given** Crimson Lash (souldrinker[1], 45°)
**When** it fires
**Then** its HP-scaled damage (`ABILITY_HP_SCALED_DAMAGE`, unchanged) applies over a cone instead of a circle

**Given** `tests/unit/abilities.test.ts` and a new cone-geometry unit test
**When** the reworked kit and `isInConeZone` are exercised
**Then** cone-boundary edge cases (exactly at the angle edge, exactly at max length, caster's own position) and each ability's cone conversion are covered

**Given** the Contract-change hook (`packages/shared-types` is touched)
**Then** this story requires Protocol Architect review, ADR-0005, and the above contract test before merge

**Non-goals:** VFX for the new cone shape — Stone Wall/Avalanche/Ancestor's Voice/Crimson Lash's VFX still draw their old circle/fan visuals until a follow-up Epic 7 VFX story adds a cone/wedge primitive to `primitives.ts` (tracked as new deferred work, not blocking this story). The per-ability config consolidation raised during this story's design discussion (`D-CC1`, `deferred-work.md`) is explicitly deferred — this story adds `ABILITY_HIT_SHAPE`/`ABILITY_CONE_ANGLE_DEG` as two more flat tables in the existing pattern.

---

### Story 3.26: Stormcaller Rework II — Lightning Arc Chain & Tempest Hurl Projectile

As a Stormcaller,
I want Lightning Arc to strike the first enemy in my aim and chain to nearby enemies, and Tempest Hurl to be a real slow projectile that explodes on impact,
So that both abilities deliver on Pillar 1's reaction-time feel with real chain/AoE payoff, instead of Lightning Arc being a shape-identical sibling of Avalanche and Tempest Hurl faking a projectile look the sim never actually threw.

**Acceptance Criteria:**

**Given** Lightning Arc (stormcaller[0])
**When** it fires
**Then** the sim gathers living enemies (+boss) inside a narrow 30° targeting corridor (`isInConeZone`, reusing Story 3.25's primitive) out to its existing 160px range, and damages only the nearest one — no target in the corridor is a no-op, same rule as every other directional ability

**Given** Lightning Arc's first target is hit
**When** resolution continues
**Then** the sim searches from that enemy's position (not re-aimed) for the nearest not-yet-hit living enemy within `LIGHTNING_ARC_CHAIN_RADIUS_PX` (150px) and damages it at `LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF` (70%) of the previous hit's damage, repeating up to `LIGHTNING_ARC_MAX_BOUNCES` (2) additional bounces, tracked via a `hitIds`-style set so no enemy is hit twice in the same cast

**Given** a new `ability:chain-hit` delta (`{casterId, fromX, fromY, toEnemyId, chainIndex}`, `packages/net-protocol`)
**When** each strike in the chain resolves (including the first)
**Then** it is broadcast once per hit, in order, so the host can draw connected chain-lightning arcs without guessing which same-tick deltas belong to which cast

**Given** Tempest Hurl (stormcaller[1])
**When** it fires
**Then** `ABILITY_DELIVERY.stormcaller[1]` is `'projectile'` (reusing the existing `ProjectileState`/planck-body infrastructure Blood Spike and Void Pulse already use) with a bigger, slower body (`TEMPEST_HURL_PROJECTILE_RADIUS_PX` 28px vs. the 12px default, `TEMPEST_HURL_SPEED_PX_S` 300px/s vs. the shared 600px/s default)

**Given** Tempest Hurl's projectile contacts an enemy
**When** impact resolves
**Then** it deals its configured damage to every living enemy (and the boss) within `TEMPEST_HURL_BLAST_RADIUS_PX` (defined as `TEMPEST_HURL_PROJECTILE_RADIUS_PX * 2`, not a separately-tuned literal) of the impact point, instead of Blood Spike/Void Pulse's single-target resolution

**Given** Storm Eye (stormcaller[3])
**When** a developer looks for its placement-distance tuning value
**Then** a new `STORM_EYE_PLACEMENT_RANGE_PX` alias (`= ABILITY_HIT_RANGE_PX.stormcaller[3]`, not a second value) documents where to tune it, next to the existing `STORM_EYE_ZONE_RADIUS_PX`

**Given** `tests/unit/abilities.test.ts` / a new `tests/unit/lightning-arc.test.ts` and a contract round-trip test for `ability:chain-hit`
**When** the reworked kit is exercised
**Then** first-target selection, chain bounce/falloff/cap, no-double-hit, Tempest Hurl's projectile spawn+blast resolution, and the new delta's serialize/deserialize round-trip are each covered

**Given** the Contract-change hook (`packages/net-protocol` gains `ability:chain-hit`) and Simulation-safety hook (`apps/simulation-server`, `packages/game-rules` both touched)
**Then** this story requires Protocol Architect review, ADR-0005 (shared with 3.25), a compatibility note (additive delta, no existing message shape changes), and full simulation-safety verification (typecheck, unit tests, deterministic tick test, perf sanity) before merge

**Non-goals:** VFX for chain-lightning arcs or the bigger/slower Tempest Hurl ball (follow-up Epic 7 VFX story). Reopens Story 3.20's "already correct, no rework needed" scoping note for Lightning Arc and Tempest Hurl only — Thunder Clap remains untouched and out of scope.

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

---

### Story 4.12: Full HP Restore on Level Transition

As a player,
I want my health restored to full when a new dungeon level loads,
So that a hard-fought level doesn't carry a health penalty into the next one.

**Acceptance Criteria:**

**Given** `loadLevel()` runs at a level transition
**When** it processes each player
**Then** every player's `hp` is reset to `maxHp`, not only players who were `isDown`/`isSpirit` (which already reset to `REVIVE_HP`)
**And** this applies uniformly regardless of how much HP a player had remaining at the end of the previous level

---

### Story 4.13: Vote-Accept Button Submitted State

As a player,
I want to see that my vote was registered when I tap Accept on a dungeon run proposal,
So that I know my input was received while waiting for the rest of the party.

**Acceptance Criteria:**

**Given** the dungeon run proposal popup is showing on a player's phone
**When** the player taps Accept
**Then** the button immediately shows a disabled/pending visual state (e.g. dimmed + "Waiting..." label) — no double-submission is possible while pending
**And** the pending state clears when `gameState.runProposal` resolves (accepted, declined, or expires) or the popup closes

---

### Epic 4 Correction: Abandon-Run Vote

Scoped from the 2026-08-03 correct-course review of the user's own `TODO.md` notes — not new PRD/GDD FRs. No path exists today to voluntarily leave an in-progress run; `session.phase` only returns to `'hub'` via victory or full-party defeat. See ADR-0007. Reuses the existing unanimous-vote shape from this epic's run-start proposal (`run:propose`/`run:vote`), per the user's explicit choice over a single-tap unilateral exit; allowed at any point in the run including during a boss encounter, per the user's explicit choice against phase-gating it. Split by ownership per `CLAUDE.md`'s cross-context rule — 4.15a (contract) sequenced before 4.15b/4.15c, which have no dependency on each other.

### Story 4.15a: Abandon-Run Vote Contract

As a Protocol Architect,
I want a typed contract for proposing and voting to abandon the current run,
So that the sim and both clients agree on the shape of an abandon request before any implementation begins.

**Acceptance Criteria:**

**Given** `packages/net-protocol/src/event-names.ts` and `packages/net-protocol/src/messages/mobile-to-server.ts`
**When** this story ships
**Then** two new mobile→server message types exist: `run:abandon-propose` (no payload) and `run:abandon-vote` (`{ accept: boolean }`), following the existing `run:propose`/`run:vote` naming and shape convention
**And** a new broadcast delta `run:abandoned` exists (`packages/net-protocol`), handled by `apply-delta.ts` to transition `session.phase` to `'hub'`

**Given** `gameState` currently has one proposal slot (`runProposal`)
**When** this story ships
**Then** a second, independent slot (`abandonProposal`) is added to `GameState` (`packages/shared-types`) so an abandon vote in flight can never be confused with or clobber a run-start vote

**Given** the Contract-change hook (`packages/shared-types` and `packages/net-protocol` are both touched)
**Then** this story requires Protocol Architect review, ADR-0007, a compatibility note (additive only, no existing message shape changes), and at least one new contract round-trip test for `run:abandoned` before merge

**Non-goals:** vote resolution logic (Story 4.15b) and UI (Story 4.15c) — this story is the contract only.

---

### Story 4.15b: Abandon-Run Resolution

As a player,
I want my party's unanimous decision to leave a run to actually return everyone to the hub,
So that we aren't stuck in a run nobody wants to keep playing.

**Acceptance Criteria:**

**Given** any player in `session.phase === 'dungeon'` sends `run:abandon-propose`
**When** `GameRoom.ts` receives it
**Then** it sets `gameState.abandonProposal` (mirroring the existing `runProposal` set-on-receipt pattern at `GameRoom.ts:226`), with no phase or boss-state guard blocking the proposal

**Given** an `abandonProposal` is pending
**When** every connected player sends `run:abandon-vote` with `accept: true`
**Then** the sim broadcasts `run:abandoned`, transitions `session.phase` to `'hub'` directly (no reward/post-run screen — this is a bail-out, not a completion), clears dungeon state, and resets player positions to hub spawn

**Given** any player sends `run:abandon-vote` with `accept: false`, or disconnects while the vote is pending
**When** this occurs
**Then** `abandonProposal` clears immediately (mirroring the existing decline-clears-proposal pattern at `GameRoom.ts:239-248`) and no phase transition occurs

**Given** `tests/unit`/`tests/contract`
**When** this story ships
**Then** unanimous-accept, single-decline-cancels, and disconnect-during-vote are each covered, plus the `run:abandoned` round-trip test named in Story 4.15a

**Given** the Simulation-safety hook (`apps/simulation-server` touched)
**Then** this story requires typecheck, unit tests, a deterministic-tick test, and a perf sanity check before merge

---

### Story 4.15c: Leave-Run Button & Vote UI

As a player,
I want a way to propose leaving the run from my phone, and to see and respond to a party member's proposal to leave,
So that I can participate in the decision to bail out of a run.

**Acceptance Criteria:**

**Given** a player is in an active dungeon run
**When** they look at the mobile controller UI
**Then** a "Leave Run" button is reachable at any time during the run (not gated to a POI or menu screen)

**Given** a player taps "Leave Run"
**When** `run:abandon-propose` is sent
**Then** every player (including the proposer) sees an accept/decline prompt, reusing the existing `VotePopup` visual pattern (`ControllerScreen.tsx:587`)

**Given** the vote resolves (unanimous accept, a decline, or a disconnect)
**When** `run:abandoned` broadcasts or `abandonProposal` clears
**Then** the prompt dismisses on every phone accordingly, and on unanimous accept the controller transitions back to its hub layout

**Non-goals:** no host-screen UI change — the phase transition to `'hub'` alone is sufficient signal on the host canvas; a dedicated host banner is not required for this story.

---

## Epic 5: Spirit Bond System

After each dungeon level, a Spirit Bond is assigned to a random player pair. Bond buffs and prices apply per-tick. Colored particle tethers connect bonded pairs on the host canvas. Three bonds are active simultaneously by the boss fight. Bonded players see a full-screen bond card on their phone; others see a Continue prompt.

### Story 5.1: Spirit Bond Shared Types & Protocol Contracts

As a developer on the project,
I want the Spirit Bond data types and wire message contracts defined in shared-types and net-protocol,
So that all agent roles can implement bond logic, host visualization, and mobile UX against agreed-upon interfaces.

**Acceptance Criteria:**

**Given** `packages/shared-types/src/bond.ts` is updated
**When** it is imported
**Then** it exports `BondType` enum with at least `Proximity` and `Fate` variants
**And** `BondState` interface with `{ playerA: string; playerB: string; type: BondType; color: string; }`
**And** `GameState.activeBonds: BondState[]` field is present (initialized to `[]` in `createEmptyGameState`)

**Given** the `SimEvents` interface in `packages/shared-types`
**When** it is reviewed
**Then** `'bond:assigned': { playerA: string; playerB: string; bondType: BondType }` is in the typed event map

**Given** `packages/net-protocol/src/messages/server-to-host.ts`
**When** delta events are reviewed
**Then** `BondAssignedDelta` is in the `DeltaEventMsg` union: `{ type: 'bond:assigned'; playerA: string; playerB: string; bondType: BondType; bondColor: string; }`

**Given** `packages/net-protocol/src/messages/server-to-mobile.ts`
**When** it is reviewed
**Then** `BondNotificationMsg` is exported: `{ type: 'bond:notification'; playerA: string; playerB: string; bondType: BondType; bondColor: string; bondDescription: string; bondMechanic: string; }`

**Given** `tests/contract/net-protocol.test.ts`
**When** bond message round-trip tests run
**Then** `BondAssignedDelta` and `BondNotificationMsg` both survive `serialize → deserialize` with identical values

---

### Story 5.2: Bond Assignment Logic & Deterministic Pair Selection

As a player,
I want the Spirit Bond assignment to feel random each run but be perfectly consistent across all connected devices,
So that every player sees the same bond pair at the same time without server-client desync.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/systems/bonds.ts` is implemented
**When** `assignBond(state: GameState, rng: () => number)` is called at level end
**Then** it selects a player pair using the `createRng(seed ^ 0x04)` PRNG stream
**And** returns `Result<BondAssignedEvt, GameError>` — never throws
**And** pushes the new `BondState` into `state.activeBonds`

**Given** a session with 3 players and 3 bond assignments across 3 levels
**When** all three bond assignments complete
**Then** each bond is a distinct `BondState` entry in `state.activeBonds` (bonds accumulate, not replace)
**And** a player may appear in multiple bonds (required: 3 players × 3 bonds makes repeats inevitable)
**And** `selectBondPair` does not throw or return undefined regardless of `activeBonds.length`

**Given** two independent sim instances seeded identically
**When** `tests/unit/bonds.test.ts` runs `assignBond()` three times in sequence on each
**Then** both produce identical `[playerA, playerB, bondType]` sequences for all three assignments

**Given** `selectBondType(rng)` is called
**When** it returns
**Then** the result is one of the `BondType` variants and each variant must be reachable (no dead code path)

---

### Story 5.3: Per-Tick Bond Effects — Proximity & Fate Bond Types

As a player,
I want Spirit Bonds to actively affect gameplay each tick — making bonded pair coordination matter,
So that bonds feel consequential and create emergent team dynamics.

**Acceptance Criteria:**

**Given** a Proximity Bond is active and the bonded pair are within `BOND_PROXIMITY_RANGE_PX` (from `balance.ts`) of each other
**When** `processBonds(state, world)` runs
**Then** both players deal +20% damage on attacks that tick (buff applied as a multiplier in the damage path)
**And** proximity is detected via a planck.js `isSensor` overlap sensor created by `createBondSensor()` in `physics/sensors.ts` — no manual distance polling in the tick

**Given** the Proximity Bond pair has been in range for ≥ `BOND_DRAIN_THRESHOLD_S` seconds (from `balance.ts`)
**When** `processBonds()` checks in-range duration
**Then** both players' HP decreases by `BOND_DRAIN_HP_PER_TICK` per tick
**And** a `bond:price-active` delta event is emitted for host visualization of the drain state

**Given** a Fate Bond is active
**When** `processBonds()` runs each tick
**Then** both bonded players have +20% movement speed applied (multiplied in the movement system)
**And** if either bonded player transitions to `isDown: true` in that tick, the other is immediately also set to `isDown: true` with their revive timer started

**Given** `processBonds()` is called with zero active bonds
**When** it returns
**Then** the returned events array is empty and no planck.js bodies are created or destroyed

**Given** `tests/unit/bonds.test.ts` Proximity Bond tests
**When** they run
**Then** damage buff toggles correctly with in/out-of-range sensor state changes
**And** drain activates only after the threshold duration, not before
**And** the Fate Bond wipe correctly downs both players when one is downed

---

### Story 5.4: Bond Assignment Integration at Level Completion

As a group of players,
I want a dramatic pause at the end of each dungeon level where the spirits assign a bond,
So that the bond moment feels ceremonial and the group can read and acknowledge before advancing.

**Acceptance Criteria:**

**Given** a dungeon level's objective is completed (`level:complete` fires) for level index 0, 1, or 2
**When** the server processes the completion
**Then** `assignBond()` is called with the current `GameState` and the bond PRNG stream
**And** the resulting `BondAssignedEvt` is broadcast as `BondAssignedDelta` to all clients
**And** a `BondNotificationMsg` is unicast directly to each of the two bonded players' mobile clients (not broadcast to all)
**And** the sim server enters a `bond-moment` pause — it does not auto-advance to the next level

**Given** the `bond-moment` pause is active
**When** any connected player sends a `CONTINUE` message to the server
**Then** the server calls `loadLevel(nextIndex)` and the run resumes

**Given** bonds accumulate across levels
**When** levels 0, 1, and 2 each complete
**Then** `state.activeBonds.length` is 1 after level 0, 2 after level 1, and 3 after level 2
**And** all 3 bonds remain active and `processBonds()` processes all of them each tick during the boss level

**Given** level index 3 (boss placeholder) completes
**When** `level:complete` fires for index 3
**Then** `assignBond()` is NOT called — no bond is assigned at boss completion
**And** the existing run-complete flow proceeds unchanged

**Given** `tests/e2e/full-run.test.ts` is extended
**When** it runs the bond assignment path
**Then** it verifies: level 0 completes → `BondAssignedDelta` received by host → one simulated `CONTINUE` → level 1 loads → `activeBonds.length === 1` in the next snapshot

---

### Story 5.5: Host Bond Visualization — Assignment Overlay & Particle Tethers

As a group watching the host screen,
I want to see a dramatic bond assignment announcement and colored particle tethers connecting bonded players,
So that everyone can immediately see which players are bonded and what's at stake.

**Acceptance Criteria:**

**Given** the host client receives a `BondAssignedDelta`
**When** the overlay renders
**Then** it shows "{playerA} · {playerB} — {bondType} Bond" in Uncial Antiqua at `xl` (40px) minimum
**And** the text has `text-shadow: 0 0 40px rgba(110,168,216,0.7)` (accent-spirit glow, per UX-DR12)
**And** no panel or background frame is drawn — text floats over the live canvas
**And** the overlay fades out after ~3 seconds; the particle tether appears at the same time and persists

**Given** a `BondAssignedDelta` with a `bondColor`
**When** the PixiJS render loop runs each frame
**Then** a particle tether line is drawn between the bonded pair's current on-screen positions using the bond's distinct color
**And** the tether updates position every frame as players move
**And** the tether persists for the remainder of the run (does not fade)

**Given** multiple bonds accumulate (up to 3)
**When** the host canvas renders
**Then** each active bond renders its own distinct-colored tether simultaneously
**And** tethers render below player sprites but above the floor layer

**Given** the player-chip component in the host top strip
**When** a player has one or more active bonds
**Then** a small colored dot appears in the chip for each bond that player participates in
**And** the dot color matches the corresponding tether color

---

### Story 5.6: Mobile Bond Card & Continue UX

As a player during a bond assignment moment,
I want my phone to either show me a detailed bond card (if I'm bonded) or a simple Continue button (if I'm not),
So that bonded players can read their bond terms before we advance to the next level.

**Acceptance Criteria:**

**Given** a player's mobile receives a `BondNotificationMsg` (they are in the newly assigned bond)
**When** the bond moment begins
**Then** the game controller disappears and is replaced by a full-screen `bond-card` component
**And** the card shows: bond name (Uncial Antiqua `lg` 28px text-primary), bond description in direct personal address (Lora 400 italic base text-secondary), and bond mechanic summary (Lora 700 sm text-primary)
**And** the phone frame wraps in the bond's color as a CSS `box-shadow`/`outline` glow
**And** the Continue button appears after a ~1.5s mandatory read delay (transitions to `dismiss-ready` state)

**Given** a player's mobile does NOT receive a `BondNotificationMsg` (they are not bonded)
**When** the bond moment begins
**Then** the controller layout remains visible but all skill cells are inactive (non-interactive)
**And** the `interact-button` in `continue` variant slides in from the top
**And** it is immediately tappable (no mandatory delay)

**Given** any player (bonded or non-bonded) taps Continue
**When** the server receives the `CONTINUE` message
**Then** all phones transition back to the standard in-combat controller layout (or post-run screen if it was level 3)
**And** the bond-card and continue overlay dismiss simultaneously on all phones

**Given** the client-UX hook verification
**When** bond-card renders
**Then** all touch targets meet 44×44px minimum (NFR5)
**And** the bond color frame glow is visible
**And** skill cells on non-bonded phones are visually inactive but layout is unchanged

---

## Epic 6: Grassland Boss Encounter

The Grassland biome boss is fully playable with behavior-tiered AI (Easy/Normal/Hard difficulty layers), synthesizing mechanics from the preceding three levels. Boss defeat triggers the purification pulse, reward reveal animation, and transitions to the post-run summary.

### Story 6.1: Grassland Boss — Shared Types & Protocol Contracts

As a developer on the project,
I want the boss entity types, run reward structures, and wire message contracts defined in shared-types and net-protocol,
So that all agent roles can implement boss logic, host visualization, and reward sequencing against agreed-upon interfaces.

**Acceptance Criteria:**

**Given** `packages/shared-types/src/boss.ts` is created
**When** it is imported
**Then** it exports `BossPhase` enum with variants `Phase1 | Phase2 | Phase3`
**And** `BossState` interface: `{ id: string; entityType: 'grassland-boss'; hp: number; maxHp: number; phase: BossPhase; position: { x: number; y: number }; isDefeated: boolean; }`
**And** `GameState.boss: BossState | null` is added (initialized to `null` in `createEmptyGameState`)

**Given** `packages/shared-types/src/achievements.ts` is created
**When** it is imported
**Then** it exports `GrasslandAchievement` enum with at least: `NoDeath`, `FastBoss`, `AllBondsActive`, `HardCleared`, `VigilHeld`
**And** `AchievementState` interface: `{ achievement: GrasslandAchievement; completed: boolean; }`

**Given** `packages/shared-types/src/run-reward.ts` is created
**When** it is imported
**Then** it exports `PlayerReward`: `{ playerId: string; essence: number; masteryMilestones: string[]; }`
**And** `RunReward`: `{ essenceTotal: number; perPlayer: PlayerReward[]; achievements: GrasslandAchievement[]; }`

**Given** `packages/shared-types/src/constants.ts` is updated
**When** reviewed
**Then** it includes `BOSS_PHASE2_HP_RATIO = 0.6`, `BOSS_PHASE3_HP_RATIO = 0.3`, `PURIFICATION_PULSE_DURATION_MS = 1500`, and `BOSS_REWARD_ESSENCE_BASE = 200`
**And** all boss behavior cooldowns and thresholds live in `packages/game-rules/balance.ts`, not in constants.ts

**Given** the `SimEvents` interface in `packages/shared-types`
**When** it is reviewed
**Then** `'boss:phaseChanged': { bossId: string; newPhase: BossPhase }` is in the typed event map
**And** `'boss:defeated': { bossId: string; reward: RunReward }` is in the typed event map

**Given** `packages/net-protocol/src/messages/server-to-host.ts`
**When** delta events are reviewed
**Then** `BossDamagedDelta`: `{ type: 'boss:damaged'; bossId: string; newHp: number; }` is in the `DeltaEventMsg` union
**And** `BossPhaseChangedDelta`: `{ type: 'boss:phaseChanged'; bossId: string; newPhase: BossPhase; }` is in the union
**And** `BossDefeatedDelta`: `{ type: 'boss:defeated'; bossId: string; reward: RunReward; }` is in the union
**And** `SnapshotMsg` includes `boss: BossState | null`

**Given** `packages/net-protocol/src/messages/server-to-mobile.ts`
**When** it is reviewed
**Then** `RunVictoryMsg` is exported: `{ type: 'run:victory'; essenceEarned: number; }`

**Given** `tests/contract/net-protocol.test.ts`
**When** boss message round-trip tests run
**Then** `BossDamagedDelta`, `BossPhaseChangedDelta`, and `BossDefeatedDelta` all survive `serialize → deserialize` with identical values
**And** `RunVictoryMsg` survives the same round-trip

---

### Story 6.2: Grassland Boss FSM — Phase System & Difficulty-Tiered Behaviors

As a player,
I want the Grassland boss to escalate through multiple distinct phases with harder difficulties adding new attack behaviors,
So that the boss fight feels like the climax of everything we fought through in the three preceding levels.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/entities/grassland-boss.ts` is implemented
**When** `createBossState(runSeed: number): BossState` is called
**Then** it returns a `BossState` with `hp === maxHp` (from `BOSS_GRASSLAND_MAX_HP` in `balance.ts`), `phase: BossPhase.Phase1`, `isDefeated: false`
**And** the function has no Colyseus or planck.js imports

**Given** `tickBoss(boss: BossState, state: GameState, world: World, difficulty: Difficulty): Result<DeltaEvent[], GameError>` is called each tick
**When** `difficulty === Easy`
**Then** Phase 1: boss runs `Idle → Chase → StompAttack → Idle` base FSM only — StompAttack executes a radial AoE around the boss position, telegraphed for one tick before activation (synthesizes the `StompLayer` behavior from Story 3.2 enemy system)
**And** Phase 2 (triggered at `BOSS_PHASE2_HP_RATIO * maxHp`): boss runs the enhanced base FSM with a shorter `StompAttack` cooldown (values from `balance.ts`); no new behaviors added
**And** there is no Phase 3 on Easy — the boss is defeated before `BOSS_PHASE3_HP_RATIO`

**Given** `difficulty === Normal`
**When** Phase 2 is triggered (boss HP ≤ `BOSS_PHASE2_HP_RATIO * maxHp`)
**Then** `BossPhaseChangedEvt` is emitted with `newPhase: BossPhase.Phase2`
**And** a `ChargeBehavior` intercepts the FSM: the boss telegraphs a dash in the direction of the nearest alive player and executes it on the following tick (synthesizes the `ChargeLayer` from Story 3.2 enemy Normal tier)
**And** `StompAttack` continues to run as the fallback when `ChargeBehavior` is on cooldown

**Given** `difficulty === Hard`
**When** boss HP falls below `BOSS_PHASE3_HP_RATIO * maxHp`
**Then** `BossPhaseChangedEvt` is emitted with `newPhase: BossPhase.Phase3`
**And** 2–3 `GrasslandAdd` entities are spawned from the arena edge spawn points (count from `balance.ts`)
**And** `GrasslandAdd` entities run the base FSM only (equivalent to Easy-tier enemy behavior) and are removed from `GameState` when their HP reaches zero
**And** the boss continues running `StompAttack` and `ChargeBehavior` simultaneously in Phase 3

**Given** boss HP reaches zero in any phase or at any difficulty
**When** `isDefeated` is set to `true`
**Then** `BossDefeatedEvt` is emitted containing the computed `RunReward`
**And** `RunReward.essenceTotal` is computed as `BOSS_REWARD_ESSENCE_BASE + (alive player count × BOSS_REWARD_PER_ALIVE_PLAYER)` (values from `balance.ts`)
**And** `RunReward.perPlayer` distributes essence equally across all connected players (guests and registered alike)
**And** the function returns `Result<DeltaEvent[], GameError>` — it never throws

**Given** `tickBoss` is called with zero alive players remaining
**When** it runs
**Then** it returns `{ ok: true, value: [] }` — no crash, no boss movement events

**Given** `tests/unit/grassland-boss.test.ts` runs
**When** all cases execute
**Then** Phase 1 → Phase 2 HP threshold transition is verified for each difficulty tier
**And** Phase 2 → Phase 3 (Hard only) transition is verified
**And** `GrasslandAdd` spawn count and behavior tier are verified
**And** reward calculation for a 4-player run (2 alive, 2 in spirit form) produces the expected per-player essence split
**And** the test file has zero Colyseus or planck.js imports

---

### Story 6.3: Boss Arena — Handcrafted Level, Physics Geometry & Host Rendering

As a group watching the host screen,
I want the boss arena to look and feel distinctly different from the procedural dungeon levels — fully corrupted, vast, and the stage for the run's climax,
So that the boss fight has the visual weight of a final encounter.

**Acceptance Criteria:**

**Given** `apps/simulation-server/src/levels/boss-arena.ts` is implemented
**When** the boss level (index 3) is loaded by the level transition system (Story 4.3)
**Then** it replaces the placeholder Victory trigger zone from Story 4.3 with the full boss arena
**And** arena bounds are registered as planck.js static polygon bodies (rectangular arena with four angled corner walls to prevent player corner-sticking)
**And** four edge spawn points (`{ x, y }` positions at N/S/E/W arena edges) are exported for Phase 3 `GrasslandAdd` spawning
**And** the boss entity is created via `createBossState()` and added to `GameState.boss`
**And** the boss body is registered as a planck.js dynamic body: large circle collider with a planck.js `isSensor` aggro radius around it

**Given** the host client receives a `SnapshotMsg` with `boss` field populated (boss level loaded)
**When** the host renders the arena
**Then** the arena tilemap uses the Grassland biome bundle (already background-loaded during hub free-roam per AR10 and Story 4.3)
**And** all environmental sprites render in their corrupted state: maximum soul-crack glow (`corruption-acid` or `corruption-blood` glow overlays on all surface tiles)
**And** the boss sprite renders at the boss's planck.js body position, centered on the arena

**Given** the host receives a `BossDamagedDelta`
**When** `applyDelta` processes it
**Then** a thin boss HP bar — 6px height, spanning full canvas width, positioned just below the 48px top strip — updates its fill percentage to `newHp / boss.maxHp`
**And** the HP bar uses `accent-corruption` (#7d2dff) as its fill color
**And** damage numbers appear in-canvas above the boss sprite for each `BossDamagedDelta`

**Given** the host receives a `BossPhaseChangedDelta` with `newPhase: BossPhase.Phase2`
**When** the renderer processes it
**Then** the boss sprite transitions to its Phase 2 animation variant (soul-crack glow overlay intensifies)
**And** Howler.js escalates the boss music (the single pre-authored boss track increases in intensity — e.g., an additional percussion layer crossfades in; implementation detail left to audio system)

**Given** the host receives `BossPhaseChangedDelta` with `newPhase: BossPhase.Phase3` (Hard difficulty)
**When** the renderer processes it
**Then** `GrasslandAdd` entities appear at the arena edges via their own `enemy:spawned` delta events (existing enemy rendering handles them)
**And** the boss sprite transitions to its Phase 3 variant (blood-red eye glow added to soul-crack overlay)

**Given** the simulation-safety hook
**When** any change to `apps/simulation-server/src/levels/boss-arena.ts` is made
**Then** a typecheck (`npm run typecheck --workspace=apps/simulation-server`) passes
**And** `tickBoss` unit tests still pass

---

### Story 6.4: Boss Defeat Sequence — Purification Pulse & Reward Reveal

As a group watching the host screen,
I want the boss defeat to be a cinematic moment — the world visually cleansing itself, a reward reveal, and a brief pause before the run summary,
So that the emotional payoff of completing a run lands before the numbers screen appears.

**Acceptance Criteria:**

**Given** `BossDefeatedEvt` is emitted in the sim
**When** `apps/simulation-server` processes it
**Then** `GameState.runPhase` is set to `'post-run'` — the tick loop skips gameplay processing for subsequent ticks
**And** `BossDefeatedDelta` (containing `RunReward`) is broadcast to all host clients
**And** `RunVictoryMsg` (containing `essenceEarned` per player) is unicast to each mobile client
**And** `assignBond()` is NOT called (boss level completion does not trigger bond assignment, per Story 5.4)
**And** after a delay of `PURIFICATION_PULSE_DURATION_MS + REWARD_REVEAL_DURATION_MS` (both from `constants.ts`/`balance.ts`), `run:complete` is broadcast to trigger the post-run summary flow (Story 4.5)

**Given** the host client receives `BossDefeatedDelta`
**When** the purification pulse sequence begins
**Then** gameplay input lock is applied — no further `DeltaEventMsg` processing changes visible game state
**And** the boss HP bar hides immediately (no lingering UI artifact)
**And** a PixiJS Graphics circle with `accent-purify` (#90d8f0) fill radiates outward from the boss's last known position, expanding to cover the full canvas
**And** the pulse alpha fades from 0.6 to 0 as the radius grows, completing in `PURIFICATION_PULSE_DURATION_MS` milliseconds
**And** simultaneously with the pulse start: all corrupted environmental sprites swap to their clean texture variants — cracked golden grass becomes whole, soul-crack overlays disappear, void-eye glows close (no modal or banner overlay — the canvas transformation is the signal, per UX-DR16)
**And** no HUD element (banner, panel, or modal) is added during the purification pulse — the canvas transformation stands alone

**Given** the purification pulse completes
**When** the reward reveal animation begins
**Then** a spirit manifestation visual rises from the center of the purified arena (a brief PixiJS particle burst in `accent-spirit` and `accent-warm`)
**And** the total team Spirit Essence earned renders in Lora 700 at xl (40px) in `accent-warm`, centered on canvas
**And** the Territory Spirit Voice line "The plains are quieter tonight. You did this." renders in Lora 400 italic sm, `text-secondary`, floating over canvas with no background panel (consistent with bond assignment overlay pattern from UX-DR12)
**And** the voice line fades after ~2 seconds
**And** after the reward reveal completes, the host transitions to the Post-Run Summary screen (Story 4.5 victory flow) without requiring any player action

**Given** the mobile client receives `RunVictoryMsg`
**When** the phone transitions
**Then** the combat controller layout is replaced by a "Victory" post-run view showing `essenceEarned` in `accent-warm`
**And** a "Return to Camp" button is the only interactive element (44×44px minimum touch target, NFR5)
**And** the phone remains in landscape orientation throughout

**Given** a player is in spirit form when `BossDefeatedDelta` arrives
**When** the purification sequence plays
**Then** the spirit form visual dissipates — spirit-form players are restored to their normal character sprite on the purified canvas
**And** their `player-chip` returns to alive state in the top strip

**Given** `tests/e2e/full-run.test.ts` is extended
**When** it runs the boss defeat path
**Then** it verifies: Level 3 completes → Bond 3 assigned → player sends CONTINUE → boss level loads → `GameState.boss` is not null → simulated damage reduces boss HP below zero → `BossDefeatedDelta` received by host → `run:complete` received after delay → post-run summary renders

---

### Story 6.5: Grassland Biome Achievements

As a player,
I want to see Grassland-specific achievements recognized and displayed at the end of a run,
So that the game rewards coordination, skill, and exploration of difficulty — not just completion.

**Acceptance Criteria:**

**Given** `packages/game-rules/src/systems/achievements.ts` is implemented
**When** `evaluateGrasslandAchievements(state: GameState, bossDefeatedAt: number): AchievementState[]` is called at boss defeat
**Then** it evaluates all five `GrasslandAchievement` variants:
- `NoDeath`: `true` if no player's `downCount` incremented during this run
- `FastBoss`: `true` if `bossDefeatedAt - state.run.bossLevelStartedAt ≤ BOSS_FAST_CLEAR_MS` (from `balance.ts`)
- `AllBondsActive`: `true` if `state.activeBonds.length === 3` when the boss level started
- `HardCleared`: `true` if `state.run.difficulty === Difficulty.Hard`
- `VigilHeld`: `true` if any player's `isDown` was `true` at any tick during the boss fight AND `run:complete` is reached (victory despite spirit-form players)
**And** completed achievements are included in `RunReward.achievements` (types from Story 6.1)
**And** the function returns `Result<AchievementState[], GameError>` — it never throws

**Given** `GameState.run` tracking fields
**When** the boss level loads (index 3)
**Then** `state.run.bossLevelStartedAt` is set to the current server timestamp (milliseconds)
**And** `state.run.anyPlayerEnteredSpiritFormDuringBoss` is initialized to `false` and set to `true` on the first `player:downed` event during the boss level

**Given** the post-run summary screen on the host (Story 4.5)
**When** `RunReward.achievements` contains at least one completed achievement
**Then** a compact achievement row renders below the per-player cards: each achievement shows its name (Lora 400 sm, text-primary) and a filled checkmark in `accent-spirit`
**And** if `achievements` is empty, the achievement section is hidden with no empty-state message

**Given** the run ends for registered players
**When** `onDispose` fires in the Colyseus room
**Then** completed achievements are persisted via `PATCH /player/:id` to `apps/backend-platform` (same endpoint used for mastery and Spirit Essence — add `achievements` to the patch body)
**And** guest players' achievements display in the post-run summary but are not persisted (no backend call for guests)

**Given** `tests/unit/achievements.test.ts` runs
**When** all cases execute
**Then** each of the five achievement conditions evaluates correctly from a mock `GameState`
**And** `VigilHeld` correctly returns `true` only when a spirit-form player existed AND `run:complete` was reached
**And** `FastBoss` returns `false` when boss defeat time exceeds `BOSS_FAST_CLEAR_MS`
**And** no achievement appears twice in the returned array

---

### Story 6.7: Boss Combat Resolution Wiring

As a player,
I want my attacks to actually damage the Grassland boss,
So that the boss fight is winnable instead of a permanent stalemate.

**Acceptance Criteria:**

**Given** any player attack resolves a hit (melee, ability, or nova AoE hit-zone check in `GameRoom.ts`)
**When** the target is `GameState.boss` rather than an entry in `GameState.enemies`
**Then** the same hit-resolution loops that currently check only `gameState.enemies` also check `gameState.boss`, applying damage via the existing `applyDamage()` (`packages/game-rules/src/systems/combat.ts`)
**And** this applies to every hit-resolution path: melee hit-scan, ability hit, and nova AoE — not just one of them

**Given** the boss takes damage
**When** its HP changes
**Then** a `boss:damaged` delta is broadcast (the message type and host-side `applyDelta` handling already exist and require no protocol change — only the emission was missing)

**Given** `debug:kill-boss` already sets `boss.hp = 0` directly
**When** this story ships
**Then** normal combat damage and the debug command both correctly reduce `boss.hp`, with no double-counting or conflict between the two paths

---

### Story 6.8: Floating Damage Numbers for Regular Enemies

As a player,
I want to see damage numbers when I hit a regular enemy, not just the boss,
So that combat feedback is consistent across all enemy types.

**Acceptance Criteria:**

**Given** the host canvas already renders a damage-flash/number on `boss:damaged` (`DungeonScreen.tsx`)
**When** this story ships
**Then** the same pattern is extended to `enemy:damaged` deltas — a floating damage number appears above the hit enemy's sprite
**And** the existing `enemy:killed` fade-out behavior is unchanged

---

## Epic 7: Ability & Environmental VFX Prototyping

Every shipped ability (16 across the 4 alpha classes) and the Grassland boss's attacks get a distinct, shape/particle-based visual identity — replacing today's undifferentiated flat-color circles — before any final pixel art is integrated. Status effects, projectiles, zones, boss charge telegraphs, and existing environmental effects (purification pulse, bond tethers) are brought to a consistent prototype-quality bar.

Scoped from direct user observation, not new PRD FRs — see `sprint-change-proposal-2026-07-21.md`. Confirmed against the shipped code: every projectile renders as the same hardcoded white circle (`DungeonScreen.tsx:308`), every zone as the same hardcoded purple circle (`:329`), status effects differ only by badge fill color (`:258-288`), and `boss:charged` isn't even in the host's transient-delta whitelist (`host-session.ts:50-63`) — the boss's charge attack has no visual telegraph at all. Sequenced so 7.1 (shared engine) lands first; 7.2–7.8 have no dependency on each other, same pattern as the Epic 3 Extension's engine-first sequencing.

### Story 7.1: VFX Engine Foundations

As a Host Experience Engineer,
I want a small library of reusable, parameterized PixiJS effect primitives,
So that every ability/status/boss-attack VFX story that follows composes from one shared toolkit instead of writing bespoke `Graphics` code per ability.

**Acceptance Criteria:**

**Given** `apps/host-client/src/screens/DungeonScreen.tsx` currently hand-rolls every effect as inline `Graphics` calls
**When** the VFX engine lands (new module, e.g. `apps/host-client/src/vfx/`)
**Then** it exposes at minimum: a particle burst, a trail, a ring/shockwave, a beam, and a tint-pulse primitive — each parameterized by color, size/scale, and duration, with no per-ability logic baked in
**And** each primitive manages its own PixiJS `Graphics`/`ParticleContainer` lifecycle (create-on-trigger, destroy-on-complete), following the existing create-on-first-seen/cleanup-on-missing pattern already used for players/enemies/tethers in `DungeonScreen.tsx`

**Given** the tick-driven render loop in `DungeonScreen.tsx`
**When** a primitive is triggered
**Then** it advances and cleans itself up frame-to-frame without allocating on every frame (reuses the existing per-entity Map-and-mutate pattern, not a new object per tick)

**Given** this story ships
**When** Stories 7.2–7.8 are implemented
**Then** none of them add new bespoke `Graphics`-drawing code for basic shapes — they call into this library with per-ability parameters

---

### Story 7.2: Stonehide Ability VFX

As a player,
I want Stone Wall, Tremor Stomp, Iron Skin, and Avalanche to each look and feel distinct when I use them,
So that I can tell my abilities apart at a glance instead of seeing the same flash/circle for all four.

**Acceptance Criteria:**

**Given** the Story 7.1 primitive library exists
**When** Stone Wall (RELEASE, Cone/Line, pulls enemies), Tremor Stomp (TAP, self-centered AoE, damage+slow), Iron Skin (TAP, self-buff), and Avalanche (AUTO, Cone/Line basic attack) fire
**Then** each renders a visually distinct effect (shape/color/motion combination not shared with any other Stonehide ability) reflecting its mechanical identity — e.g. a pull-oriented cone reads differently from a self-centered shockwave, which reads differently from a self-buff aura
**And** none of the four fall back to the shared flat-circle/flat-flash treatment from `ABILITY_FLASH_MS`

**Given** Iron Skin's `damageReduction` status effect is active on the caster
**When** the caster is rendered
**Then** the self-buff visual persists for the effect's duration, not just at cast moment

---

### Story 7.3: Spiritcaller Ability VFX

As a player,
I want Ancestor's Voice, Spirit Nova, Soul Mend, and Warding Cry to each look and feel distinct,
So that Spiritcaller's sustain/burst/defend/revive kit reads clearly in combat.

**Acceptance Criteria:**

**Given** the Story 7.1 primitive library exists
**When** Ancestor's Voice (AUTO, mixed-faction cone), Spirit Nova (TAP, expanding radius, mixed-faction), Soul Mend (AIM_CAST, ranged spirit-targeting revive), and Warding Cry (TAP, self-centered ally shield) fire
**Then** each renders a visually distinct effect, and Ancestor's Voice/Spirit Nova visually differentiate their heal-vs-damage split per target (e.g. distinct color/particle treatment for allies healed vs enemies damaged in the same cast)
**And** Soul Mend's channel/cast has a visible ranged-targeting indicator distinct from the other three, given its AIM_CAST channel behavior (Story 3.11/3.18)

**Given** Warding Cry's `shield` status effect is active on an ally
**When** that ally is rendered
**Then** the shield visual persists for the effect's duration (reuses Story 7.6's status-effect visual work where applicable)

---

### Story 7.4: Souldrinker Ability VFX

As a player,
I want Blood Spike, Crimson Lash, Dark Pact, and Void Pulse to each look and feel distinct,
So that Souldrinker's lifesteal/melee/self-cost kit reads clearly in combat.

**Acceptance Criteria:**

**Given** the Story 7.1 primitive library exists
**When** Blood Spike (AUTO, projectile with lifesteal), Crimson Lash (RELEASE, melee), Dark Pact (RELEASE, self-cost buff), and Void Pulse (RELEASE, zone/field) fire
**Then** each renders a visually distinct effect
**And** Blood Spike's lifesteal is visually communicated on the caster (e.g. a brief health-return indicator distinct from a generic flash) in addition to the projectile itself

**Given** Dark Pact's self-cost resource spend (Story 3.15)
**When** the ability fires
**Then** the caster's self-cost is visually acknowledged (distinct from the buff-gained visual), so the trade-off reads at a glance

---

### Story 7.5: Stormcaller Ability VFX

As a player,
I want Lightning Arc, Tempest Hurl, Thunder Clap, and Storm Eye to each look and feel distinct,
So that Stormcaller's ranged/control kit reads clearly in combat.

**Acceptance Criteria:**

**Given** the Story 7.1 primitive library exists
**When** Lightning Arc (AUTO, projectile), Tempest Hurl (RELEASE, thrown), Thunder Clap (TAP, self-centered AoE), and Storm Eye (RELEASE, persistent zone/field with per-tick effect) fire
**Then** each renders a visually distinct effect
**And** Storm Eye's persistent per-tick zone effect (Story 3.13) has a visible ongoing tick indicator (e.g. periodic pulse) distinct from a static zone circle, so its "still active, still ticking" state reads without a HUD element

---

### Story 7.6: Status Effect VFX

As a player,
I want to tell at a glance which status effect (damage reduction, slow, damage buff, shield) is active on a character, not just that "some" effect is active,
So that buffs/debuffs are readable mid-combat without opening a menu.

**Acceptance Criteria:**

**Given** `DungeonScreen.tsx:258-288`'s current single generic badge, differentiated from other effects only by `STATUS_EFFECT_COLORS` fill color
**When** this story ships
**Then** each of the four effect types (`damageReduction`, `slow`, `damageBuff`, `shield`) gets a distinct aura/overlay treatment (not just a distinct color on the same badge shape), built from the Story 7.1 primitive library
**And** the existing create-on-first-seen/cleanup-on-missing lifecycle for `statusBadgeGraphics` is preserved — this is a rendering-only change, no new delta events or state fields

**Given** an entity has multiple simultaneous status effects
**When** it is rendered
**Then** each effect's distinct visual is layered/positioned so they remain individually readable (not just stacked badges as today)

---

### Story 7.7: Grassland Boss Attack VFX & Charge Telegraph

As a player,
I want to see the boss's charge attack coming, and want its existing attack reactions to feel visually consistent with the rest of combat,
So that a currently-invisible attack becomes readable and the boss doesn't look visually disconnected from the new ability VFX.

**Acceptance Criteria:**

**Given** the sim already emits `boss:charged` (`GameRoom.ts:1926`) but `host-session.ts:50-63`'s transient-delta whitelist omits it
**When** this story ships
**Then** `boss:charged` is added to the whitelist and reaches the host
**And** a dedicated charge telegraph visual (built from the Story 7.1 primitive library) plays on the host canvas — today there is zero visual signal for this attack, only silent movement

**Given** the existing `boss:stomped`, `boss:phaseChanged`, and `boss:damaged` reactions (functional since `dev-5-boss-transient-delta-whitelist-fix`)
**When** this story ships
**Then** each is reskinned to use the Story 7.1 primitives, for visual consistency with the ability VFX shipped in 7.2–7.5
**And** no behavior change occurs to boss FSM, phase transitions, or damage resolution — rendering only

---

### Story 7.8: Environmental & Bond VFX Polish

As a player,
I want projectiles and zones to actually show the per-ability visuals built in 7.2–7.5, and want the existing purification pulse and bond tethers to feel consistent with the new visual language,
So that the ability-specific work isn't silently overridden by a shared fallback shape.

**Acceptance Criteria:**

**Given** `DungeonScreen.tsx:308`'s hardcoded `g.circle(0, 0, 8).fill({ color: 0xffffff })` for every projectile, and `:329`'s hardcoded `g.circle(0, 0, zone.radius).fill({ color: 0x9b59b6, alpha: 0.25 })` for every zone
**When** this story ships
**Then** projectile and zone rendering is driven by each `ProjectileState`/`ZoneState` entity's existing `class`/`abilityIndex` fields (added in Story 3.13) to select the correct per-ability visual from Stories 7.2–7.5, instead of falling back to one shared shape for every ability
**And** no new state fields or delta events are introduced — this consumes data that already exists

**Given** the existing purification pulse (Story 6.4) and bond particle tethers (Story 5.5)
**When** this story ships
**Then** both receive a light visual-consistency pass against the Story 7.1 primitive library (no mechanic or timing change — purification pulse still radiates from boss position per UX-DR16, tethers still persist for the run per FR16)

**Non-goals for Epic 7:** no final pixel-art sprites (the separate PixelLab-driven art pass the GDD already scopes remains untouched); no new abilities or mechanics; no protocol/schema changes beyond the one-line `boss:charged` whitelist fix in Story 7.7.

---

### Epic 7 Correction: Hub VFX Wiring & Aim/Destination Preview

Scoped from the 2026-08-03 correct-course review of the user's own `TODO.md` notes — not new PRD/GDD FRs. Two unrelated gaps found together: the entire VFX pipeline was never wired into the hub screen (Story 7.14), and the host has zero visibility into an in-progress aim before a `RELEASE`-type ability fires (Stories 7.15a-d). See ADR-0008 for the aim-preview contract. 7.14 has no dependency on 7.15a-d. Split by ownership per `CLAUDE.md`'s cross-context rule — 7.15a (contract) sequenced before 7.15b/7.15c/7.15d, which have no dependency on each other.

### Story 7.14: Hub-Screen VFX Wiring

As a player,
I want to see ability VFX when I cast in the hub, the same as I do in a dungeon run,
So that testing or just messing around with abilities in the hub isn't visually silent.

**Acceptance Criteria:**

**Given** `HubWorldScreen.tsx` currently has zero VFX wiring — `VfxEngine`, `getAbilityVfxConfig`, `resolveAbilityVfxPlacement`, and every per-class VFX module are instantiated only inside `DungeonScreen.tsx`
**When** this story ships
**Then** the reusable parts of `DungeonScreen.tsx`'s VFX wiring (engine lifecycle, delta→VFX dispatch, per-tick `VfxEngine` update/render call) are extracted into a shared hook/module (e.g. `useAbilityVfx(engine, gameState)`) that both `HubWorldScreen.tsx` and `DungeonScreen.tsx` call
**And** casting any ability in the hub now shows the same VFX as the equivalent cast in a dungeon run — status auras, trails, and per-class cast VFX (Stonehide/Spiritcaller/Souldrinker/Stormcaller) all apply identically, since the delta contract is unchanged

**Given** boss-specific VFX (`applyBossVfxPlan`, `planBossVfx`)
**When** this story ships
**Then** it remains Dungeon-only — there is no boss in the hub, so that branch is simply never exercised there; no guard is needed

**Given** `DungeonScreen.tsx`'s existing VFX behavior
**When** the extraction is complete
**Then** no regression occurs — existing Epic 7 VFX acceptance criteria (7.1–7.8, 7.11–7.13) still pass unchanged

**Non-goals:** no protocol/delta changes — this consumes the exact same ability deltas the hub already receives and ignores today.

---

### Story 7.15a: Aim-Preview Contract

As a Protocol Architect,
I want a typed contract for a player's in-progress aim before a `RELEASE`-type ability fires,
So that the host can render an aiming indicator without guessing at un-broadcast client state.

**Acceptance Criteria:**

**Given** `InputEvent` (`packages/shared-types/src/input.ts:12-14`) currently has only `'joystick'` and `'ability'` variants
**When** this story ships
**Then** a new `'aim-preview'` variant is added (`{ type: 'aim-preview'; abilityIndex: number; directionX: number; directionY: number }`)
**And** a new broadcast delta `ability:aim-preview` exists (`{ playerId, abilityIndex, directionX, directionY, targetX?, targetY? }`, `packages/net-protocol`) — presentation-only, never written to persistent `GameState`

**Given** the Contract-change hook (`packages/shared-types` and `packages/net-protocol` are both touched)
**Then** this story requires Protocol Architect review, ADR-0008, a compatibility note (additive only), and a contract round-trip test for `ability:aim-preview` before merge

**Non-goals:** server-side computation of `targetX`/`targetY` (Story 7.15b), rendering (Story 7.15c), and mobile-side sending (Story 7.15d) — this story is the contract only.

---

### Story 7.15b: Aim-Preview Resolution

As a Simulation Engineer,
I want the sim to compute and broadcast each aiming player's live direction and, for zone-placement abilities, their would-be target point,
So that the host can render an honest preview that can never drift from where the ability will actually land.

**Acceptance Criteria:**

**Given** a player sends `input:aim-preview` for a `RELEASE`-type ability
**When** `GameRoom.ts` receives it
**Then** it computes `targetX`/`targetY` (for zone-placement abilities — Storm Eye, Stone Wall, Dark Pact, Crimson Lash) using the exact same geometry/delivery math already used at real cast time (`ABILITY_GEOMETRY`, existing placement functions) — no duplicated formula — and broadcasts a throttled `ability:aim-preview` delta

**Given** `AUTO`/`AIM_CAST` abilities already stream a live direction every ~33ms via their existing continuous-fire input
**When** this story ships
**Then** the sim broadcasts `ability:aim-preview` for those abilities too, sourced from their existing fire-direction input — no new client-side signal needed for these two input types

**Given** this delta is presentation-only
**When** it is computed and broadcast
**Then** it never mutates `GameState`, never touches the PRNG, and is explicitly exempt from the deterministic-tick test's mutation assertions — a perf sanity check is still required (throttled per-aiming-player broadcast, bounded by current max player count)

**Given** `tests/unit`
**When** this story ships
**Then** each of the four named zone-placement abilities' preview-target computation is covered, asserting it matches the real cast-time placement for the same inputs

**Given** the Simulation-safety hook (`apps/simulation-server` touched)
**Then** this story requires typecheck, unit tests, and the perf sanity check above before merge

---

### Story 7.15c: Render Aim Arrow & Destination Preview

As a player,
I want to see where my aimed ability is currently pointing, and where a zone-targeted ability will land if I release now,
So that I can adjust my aim before committing to the cast.

**Acceptance Criteria:**

**Given** the `ability:aim-preview` delta (Story 7.15a/b)
**When** any player is aiming an ability
**Then** a translucent aim-direction arrow renders from that player's position along the current direction — for `AUTO`/`AIM_CAST` abilities this uses the live fire-direction stream, for `RELEASE`-type abilities this uses the new preview stream

**Given** Storm Eye, Stone Wall, Dark Pact, and Crimson Lash specifically
**When** their `targetX`/`targetY` preview is present in the delta
**Then** a ghosted destination/zone preview renders at that point: a circle for Storm Eye, a cone for Stone Wall and Crimson Lash (reusing the 7.13 cone/wedge primitive), and Dark Pact's existing hit-shape

**Given** an ability fires, or the player stops aiming (releases without firing, or the drag is cancelled)
**When** either occurs
**Then** the arrow and any destination/zone preview clear immediately

**Non-goals:** no protocol/sim changes — this story only consumes Story 7.15a/b's delta.

---

### Story 7.15d: Mobile Drag-Preview Sending

As a Mobile Controller Engineer,
I want the phone to report the in-progress drag direction for `RELEASE`-type abilities before the player releases,
So that the host has something to render an aim preview from.

**Acceptance Criteria:**

**Given** a player is mid-drag on a `RELEASE`-type ability's skill cell (Stone Wall, Crimson Lash, Dark Pact, Storm Eye, and any other current or future `RELEASE`-type ability)
**When** the drag is in progress
**Then** the phone sends a throttled `input:aim-preview` event (same ~33ms cadence as the existing joystick input) with the current drag direction
**And** sending stops immediately on release/fire or on touch-cancel

**Given** `AUTO`/`AIM_CAST` abilities
**When** this story ships
**Then** no mobile-side change is made for these — their existing continuous-fire input already carries live direction (Story 7.15b sources the broadcast from that existing stream)

**Non-goals:** no change to the actual fire behavior or the existing `ability` input message — this adds a new, separate, lower-stakes input alongside it.

---

## Dev Infra Fixes (No Epic)

Isolated platform/tooling items that don't extend or correct a specific epic's approved scope — same category as `dev-1-mobile-controller-network-binding`.

### Story dev-2: Controller Rotation Lock Enforcement

As a player on my phone,
I want the game to require landscape orientation after I join a session,
So that the controller layout has the space it needs and I'm not playing in a cramped portrait view.

**Acceptance Criteria:**

**Given** a player has joined a session
**When** their phone is in portrait orientation
**Then** the controller UI is blocked by a rotate-device prompt until the phone is turned to landscape
**And** once landscape is detected, the normal controller UI resumes automatically

---

### Story dev-3: Controller Fullscreen Toggle

As a player on my phone,
I want the controller to go fullscreen automatically and have a toggle to turn it on or off,
So that I have as much screen space as possible for the joystick and ability grid.

**Acceptance Criteria:**

**Given** a player joins a session
**When** the controller UI loads
**Then** it automatically requests fullscreen via the Fullscreen API
**And** a toggle button in the header lets the player exit or re-enter fullscreen manually at any time

---

### Story dev-4: Debug Invincible/High-Damage Mode

As a developer testing combat balance solo or with 1-2 players,
I want a debug toggle that makes my character invincible and deal much more damage,
So that I can test enemy and boss encounters without dying to a full-party-tuned difficulty curve.

**Acceptance Criteria:**

**Given** the existing `NODE_ENV`-gated debug message pattern (`debug:kill-boss`, `debug:kill-all`)
**When** a new `debug:toggle-god-mode` message is sent for a player
**Then** that player takes zero damage from all sources and deals a configured damage multiplier (from `balance.ts`) until toggled off
**And** the toggle is gated behind the same `NODE_ENV !== 'production'` check as the existing debug messages

