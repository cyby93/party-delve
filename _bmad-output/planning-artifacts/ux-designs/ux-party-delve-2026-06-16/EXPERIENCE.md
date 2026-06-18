---
title: Party Delve Experience Design
project: party-delve
status: final
updated: 2026-06-18
---

# Party Delve Experience Design

This document is the behavioral and structural companion to DESIGN.md. Where DESIGN.md answers "what does it look like," this document answers "how does it work, what does it feel like, and how does the player move through it." Component names, token references, and surface names must remain identical across both spines.

---

## 1. Foundation

### Two Apps, Two Roles

Party Delve runs on two React 18 + Vite web applications:

| App | Port | Surface Role | Held by |
|---|---|---|---|
| `host-client` | 3000 | The game screen — shared TV or monitor | The room |
| `mobile-controller` | 3001 | Input surface + personal information layer | Each player |

These two apps have **radically different jobs.** The host screen is a communal artifact — everyone watches it, no one holds it. The phone is a personal instrument — one player holds it, no one else needs to see it.

All visual design tokens are CSS custom properties (no game engine UI system). Both apps reference the same token set defined in DESIGN.md.

### Design Principles (behavioral)

1. **The host screen is the game.** Everything critical happens there. Everything personal happens on the phone. Never duplicate host-screen content onto the phone.
2. **The phone is an input surface first.** Its job is to send accurate input with minimal cognitive load. Any non-input UI on the phone must justify its presence.
3. **Spirit energy is earned, not decorative.** The Spirit Chant layer (`{colors.accent-spirit}`) surfaces only at moments of genuine narrative or mechanical significance.
4. **Low reading requirement during gameplay.** Iconography and spatial layout carry the phone controller during combat; text is for setup moments (join flow, class selection, bond card).
5. **Couch readability governs host screen decisions.** If text or state change is not legible from 3 meters, it belongs on the phone or must be redesigned.

---

## 2. Information Architecture

### Host Screen Inventory

All host screens in sequence:

| Screen | Entry trigger | Exit trigger |
|---|---|---|
| **Main Menu** | App launch | Host clicks "Create Session" |
| **Lobby** | Session created | Host clicks "Start Game" |
| **Hub World** | Session started or run ended | Group approaches dungeon entrance POI and accepts run |
| **Dungeon Run (HUD)** | Run starts | Boss defeated or all warriors in spirit form |
| **Spirit Bond Assignment** | Level 1, 2, or 3 cleared | Any player taps "Continue" on their phone |
| **Post-Run Summary** | Boss defeated (victory) or full wipe (failure) | Last player taps "Return to Camp" on phone |

**Spirit Bond Assignment is not a separate screen.** It is an overlay state on top of the dungeon canvas. The game world remains visible behind the bond overlay text and in-canvas tether animation.

### Phone Screen Inventory

All phone screens in sequence:

| Screen | Orientation | Entry trigger | Exit trigger |
|---|---|---|---|
| **Auth Choice** | Portrait | QR scan or direct URL | Guest / Sign In / Sign Up tapped |
| **Session Code Entry** | Portrait | After auth/guest choice | "Join" confirmed |
| **Hub Controller** | Landscape | Entered hub | Run starts |
| **In-Run Controller** | Landscape | Run starts | Run ends |
| **Bond Assignment** | Landscape | Level cleared (bonded player: full-screen takeover; non-bonded: slide-in Continue) | Player taps Continue |
| **Post-Run** | Landscape | Run ends | "Return to Camp" tapped |

**Class Selection** occurs within the Hub Controller context — the phone enters a portrait-friendly card scroll UI when the player interacts with the class selection POI. After confirming the class, the phone returns to the Hub Controller landscape view.

---

## 3. Voice and Tone

### Core Register

**Warm · Serious · Epic · Hopeful**

These four words define the emotional range of every string in the product. The game is never cynical, never ironic, never cute in a way that undercuts the world. Its warmth is earned, not default.

### Two Writing Surfaces

**Host screen copy (shared room register):**
Copy that appears on the host screen is read by a group simultaneously. Rules:
- Punchy and brief — the room doesn't pause to read
- Earned — host screen text only speaks at emotionally significant moments (outcome headlines, bond overlay, objective labels)
- No hedging, no filler. "Purified. The campfire noticed." Not "Your run has been completed successfully."

**Phone copy (personal register):**
Copy on the phone is read by one player, in their hand.
- Direct and brief — the player is also watching the host screen
- Bond descriptions address the player in second person ("You and [Player] are now bound by fate…")
- Occasional dry warmth is permitted, especially in bond descriptions — the inherent awkwardness of the bond mechanics can be leaned into
- Class flavour text: Lora italic, mythic register, third person — "From the mountain clans, where endurance is prayer."

### Character Voice Quick Reference

| Speaker | Register | Example |
|---|---|---|
| Keeper | Dry, steady, plain | "East road is deep today. Watch the treeline." |
| Vendor | Warm, chatty | "You're back. Good. The campfire was getting restless." |
| Spirit Bond descriptions | Direct, personal, occasionally dry | "You and Mira are now bound by fate. If they fall, you fall. Maybe warn them." |
| Territory Spirit Voice | Ancient, calm, brief | "The plains are quieter tonight. You did this." |
| Host screen outcome | Punchy, warm | "One warrior. All the spirits watching. The corruption blinked first." |

---

## 4. Component Patterns

This section defines behavioral specifications. Visual anatomy is in DESIGN.md Section 7. Component names are identical across both documents.

### `skill-cell`

**Idle state:**
The cell displays an ability icon (placeholder geometry in v1 alpha), the ability name (Lora 400 italic), and an input type badge (AUTO / RELEASE / TAP) in the bottom-left corner. No description, no tooltip — those live in the ability briefing panel during class selection, before the player enters the controller.

**Touch behavior by input type:**
- **Joystick-AutoFire:** On touch, a joystick ring spawns at the exact touch position within the cell. Player drags to aim; ability fires continuously while held. Ring tracks drag position. On lift, ability stops firing.
- **Joystick-Release:** On touch, a joystick ring spawns at touch position. Player drags to set direction; ability fires on thumb-lift. Ring shows direction intent while held.
- **Tap:** No joystick spawns. Cell acts as a tap button. A brief tap feedback animation confirms the input. No drag behavior.

**Cell boundary rule:** When a player's thumb drifts outside the cell boundary during a Joystick-AutoFire or Joystick-Release hold, the ability continues to function using the last valid direction registered before the boundary was crossed. The joystick ring clamps visually to the cell edge. On thumb-lift anywhere on screen, the hold is released. This prevents accidental ability interruption from natural thumb movement.

**Cooldown overlay:**
When a skill enters cooldown, a **cell-filling conic-gradient** overlay covers the majority of the cell face — not a circular ring. The conic fills clockwise from the top as the cooldown completes, progressively revealing the ability icon and name beneath it. The remaining cooldown duration is displayed as a centered countdown value in `{colors.text-primary}`. The overlay is large — it takes up most of the cell face. Players read cooldown state at a glance without focusing on small indicators. The ring-based timer model is not used.

**No in-cell descriptions.** Descriptions are exclusively in the ability briefing panel, accessible during class selection. During gameplay, the cell carries name and input type only.

---

### `interact-button`

**Appear trigger:** The server notifies the mobile client that the player's character is within interaction range of a POI (class selection POI, training dummy, dungeon entrance). The button slides in from the top edge of the phone screen.

**Disappear trigger:** Character moves out of interaction range. Button slides back up off-screen. No linger — disappears with the same motion that brought it in.

**Tap behavior:** Opens the relevant POI UI on the phone. For the class selection POI: transitions to the class selection card scroll. For the dungeon entrance: shows the biome/difficulty accept flow. For the training dummy: [ASSUMPTION: training dummy interaction UI not defined in this session — placeholder for future design].

**Continue variant:** At bond moments (non-bonded players) and rest moments between levels, the same component slides in with the label "Continue." Tapping Continue as any one player (bonded or non-bonded) advances the entire group. Bonded players tap Continue on their bond card; non-bonded players tap this slide-in Continue.

**Positioning:** Just below the top safe-area inset. Centered horizontally. Does not obstruct the left or right zones.

---

### `class-card`

**Tap-to-select:**
Tapping a class card highlights it — `{colors.accent-spirit}` border replaces the default `{colors.border}`, background shifts to `{colors.bg-subtle}`. This is the selection affordance. There is no separate "Select" button on the card.

**Ability panel auto-show:**
On card selection, an ability briefing panel automatically extends from the bottom of the screen. It contains: 4 `ability-chip` components (one per ability), a brief class role summary (Lora 400, `{colors.text-secondary}`), and the "Pick Selected Class" confirm button at the bottom. The briefing panel owns the confirmation action — the card itself does not.

**Horizontal scroll:**
Cards are arranged in a horizontal scroll container. Approximately 2–3 cards are visible at once. The scroll is unconstrained — swipe freely. No snap-to-card required, though it aids the UX. [NOTE FOR UX: snap scrolling behavior should be validated in usability testing — snap may feel more deliberate and intentional for a high-stakes selection.]

**Portrait context:**
Class selection occurs in portrait orientation. The horizontal card scroll fills the upper ~60% of portrait screen. The ability briefing panel occupies the lower ~40% when open.

---

### `bond-card`

**Full-screen takeover (bonded players):**
When a Spirit Bond is assigned, the phone controller disappears entirely for bonded players. The `bond-card` fills the entire screen — `{colors.bg-base}` background, bond-color frame glow. The player must read and process the bond before advancing. No other UI is accessible.

**Continue slide-in (non-bonded players):**
Non-bonded players see their controller remain visible and inactive (skill cells do not respond to touch during the bond moment). An `interact-button` in `continue` variant slides in from the top. The controller being visible signals that the run continues — they are not excluded, they are simply waiting.

**Advancing the group:**
Any one player — bonded or non-bonded — tapping Continue advances the entire group to the next level. The mechanic is permissive: the group doesn't need to wait for every player to dismiss. One Continue is sufficient.

**Bond description register:**
Bond descriptions are personal, direct, occasionally warm. They are addressed to the player: "You and [Player] are now bound by fate." They describe the mechanic plainly and may add a brief dry warmth. They do not editorialize the narrative beyond what the mechanic is.

---

### `player-chip`

**Alive state:**
Compact display in the host top strip. Player name, class indicator, health pip row. Always visible during the dungeon run.

**Spirit form state:**
When a player enters spirit form (revive timer expired), their chip dims — name text to `{colors.text-secondary}`, health pips emptied, a `{colors.accent-spirit}` glow wraps the chip at low opacity. This communicates that the player is still in the session (not disconnected) but is in spirit form. The chip persists — it is the persistent indicator that the spirit is still present.

**Bond state:**
If the player is bonded, a small colored dot appears in the chip — the bond's color. Up to three bond dots may appear per player in theory (though in practice, one bond per player is the expected case in v1.0). [NOTE FOR UX: multiple bonds per player are possible with small teams — chip design should accommodate at least 2 bond indicators per player chip without breaking the layout.]

---

### `skill-cell (spirit-form variant)`

**Spirit-form variant:** When a player enters spirit form (revive timer expired), the phone controller transitions to a spirit-form theme:

- **Visual theme:** The Raw Earth base layer recedes. The Spirit Chant layer leads. The entire controller background shifts to a luminous, ethereal state using the player's assigned session color as the dominant accent (session-color glow overlaid on `{colors.bg-base}`).
- **Left zone:** Movement joystick remains fully functional — spirit-form players can move.
- **Right zone:** 3 of the 4 skill cells become locked — rendered with a high-opacity dim mask (80% `{colors.bg-base}` overlay), non-interactive. The 4th cell is replaced by the class-specific **spirit-form ability** — a unique ability available only in spirit state, styled with the player's session color glow border.
- **Exit:** On revive (another player reaches and revives the downed player), the spirit-form theme immediately dissolves back to the standard controller theme.

---

### `revive-timer`

**Ephemeral — appears only when a player is downed.** It does not exist on the host screen at any other time.

**Appear trigger:** A player's health reaches zero. The timer appears at bottom-center of the host canvas overlay with the player's name and the starting revive window value (60s / 40s / 20s / 10s / 5s / 2s, based on prior down count for that player in the run — GDD mechanic).

**Countdown behavior:** Timer counts down in real time. Timer text and progress bar begin at `{colors.accent-warm}` (amber, urgent state). At ≤10s remaining, both transition to `{colors.corruption-blood}` (critical state) and the amber halo intensifies. The container border (`{colors.accent-corruption}`, corruption-purple) remains unchanged throughout — it is a card-border accent only, not an urgency signal.

**Disappear triggers:**
- A teammate reaches and revives the player → timer vanishes, player chip returns to alive state
- Timer reaches 0 → timer vanishes, player enters spirit form, in-canvas spirit form VFX begins

**Multiple timers:** If more than one player is downed simultaneously, timers stack vertically above center-bottom. [NOTE FOR UX: a near-wipe with 3–6 downed players will produce 3–6 simultaneous timers. A condensed mode — showing all timers in a compact horizontal row or a summary count — may be required. Not designed in this session.]

---

### `post-run-card`

**Per-player breakdown row shown on the host post-run summary screen.** The summary is a single screen template with two emotional tones — victory and failure — not two separate screen designs.

**Victory tone:** Outcome headline (`{typography.scale.xl}`, Uncial Antiqua — e.g., *"Purified. The campfire noticed."*) at top, followed by team Spirit Essence earned (Lora 700, `{colors.accent-warm}`), then one `post-run-card` row per player.

**Failure tone:** Outcome headline (e.g., *"Tonight, the forest held its ground."*), Spirit Essence shows partial amount, player rows dim.

**Content per row:** Player name, class name, times downed count. Not shown: run time, mastery milestones (those surface elsewhere per D-015).

**Persistence:** The host screen persists on the post-run summary until all players have tapped "Return to Camp" on their phones. The host screen does not offer its own "Return" button — the group controls the transition from their phones.

---

## 5. State Patterns

These are the game's primary experience states — combinations of host-screen state and phone-screen state that occur simultaneously.

### Hub Idle

**What's happening:** Players are in the hub village between runs or after first joining. Characters are free-roaming the host canvas.

**Host screen:** Hub world canvas. Top strip visible with player chips. No HUD overlay beyond the strip. Campfire at canvas center, firelit ambient.

**Phone:** Landscape controller view active but no movement input is triggering dungeon content. Left joystick zone active for free-roam movement. Right skill zone: [ASSUMPTION: skills may be inactive or in a reduced state during hub free-roam — behavior not defined in session. Either skills are locked in the hub, or they trigger visual-only effects on training dummies. Flagged for design decision.]

---

### Near-POI (Interact Button Visible)

**What's happening:** A player's character has entered the proximity radius of a POI.

**Host screen:** A small chat-bubble/dialog icon appears above the character's head in-canvas (per D-012 and D-013). This signals to the rest of the group that this player is in a menu interaction, not idle or lost.

**Phone (that player):** `interact-button` slides in from the top edge.

**Phone (other players):** No change — they continue free-roaming. The host screen icon is the shared group signal.

---

### In-Dungeon Combat

**What's happening:** A dungeon level is active. Players are fighting enemies.

**Host screen:** Game canvas full-bleed. Top strip visible (player chips, objective label, level/biome label). In-canvas name tags and health pips float above each character. Bond tethers (particle lines, bond-colored) connect bonded pairs in-canvas. No other persistent overlay.

**Phone:** Landscape controller. Left zone: floating movement joystick. Right zone: 2×2 skill grid, fully active. HP strip at top (6px). Cooldown overlays animate on active cooldowns.

**Player downed:** `revive-timer` appears bottom-center on host. Downed player's phone: transitions to the spirit-form controller theme (see `skill-cell (spirit-form variant)` in Section 4). Movement joystick remains active. 3 skill cells locked. 1 spirit-form ability cell active. On revive, controller theme returns to standard immediately.

---

### Between-Level Bond Moment

**What's happening:** A dungeon level has been cleared. A Spirit Bond is being assigned.

**Host screen:** Host canvas remains visible (dungeon environment). Bond overlay text fades in over canvas — two player names + bond type (e.g., "Cyby · Dani — Fate Bond") in Uncial Antiqua, `{typography.scale.xl}` (40px) minimum, `{colors.accent-spirit}`, `text-shadow: 0 0 40px rgba(110,168,216,0.7)`. No panel, no border — text floats over the canvas. Bond-specific audio plays. A new particle tether line appears in-canvas between the bonded pair. Overlay text fades after ~3 seconds; tether remains. Visual reference: `mockups/bond-assignment-wireframe-1.html` covers the phone bond card; a host-canvas bond overlay wireframe is deferred — build from this spec.

**Phone (bonded players):** Controller disappears. Full-screen `bond-card`. Frame wraps in bond-color glow. Player reads and taps Continue.

**Phone (non-bonded players):** Controller visible, inactive. `interact-button` in `continue` variant slides in from top.

**Advance trigger:** First player (bonded or non-bonded) to tap Continue advances the group. Next level loads.

---

### Boss Fight (3 Bonds Active)

**What's happening:** Level 4 boss arena. Maximum corruption. All three Spirit Bonds are active simultaneously.

**Host screen:** Boss arena canvas (handcrafted, maximum corruption aesthetic). Top strip: all player chips visible, up to 3 bond-color dots visible per relevant chips. Three colored particle tethers criss-cross the canvas between bonded pairs. Boss health indicator: [ASSUMPTION: boss health bar UI not defined in this session — common placement is top-center of host screen, below the top strip. Flagged for design decision.]

**Phone:** Same landscape controller as combat state. All abilities active. No additional boss-fight-specific phone UI.

**High-stress interaction:** Multiple `revive-timer` elements may appear simultaneously as the boss fight escalates. Near-wipe state may be triggered.

---

### Near-Wipe Vigil (Spirit Forms)

**What's happening:** Multiple warriors have entered spirit form. One or more warriors remain alive. The Vigil — up to 6 luminous spirit forms surround the last standing warrior(s) in-canvas.

**Host screen:** Spirit forms are in-canvas — luminous, colored, silent. The visual weight of multiple fallen spirits surrounding the last fighter makes the stakes visible without breaking the world. No special HUD overlay beyond existing elements. Multiple `revive-timer` elements may be active if some players are still in their revive window.

**Phone (spirit-form players):** Spirit-form controller theme active (see `skill-cell (spirit-form variant)` in Section 4). All spirit-form phones show the luminous session-color theme with movement joystick active and spirit-form ability available. This is the vigil state — all downed players can still move and use their spirit ability while the last warrior fights. The host-canvas vigil visual (luminous colored spirit forms surrounding the last standing warrior) is in-canvas, not HUD.

**Phone (alive players):** Normal combat controller. No change.

---

### Spirit-Form (Downed Player State)

**What's happening:** A player's revive timer has expired. They have entered spirit form. Their character is no longer fighting but they remain in the session with limited capabilities.

**Host screen:** Player's in-canvas spirit form appears — luminous, colored, hovering at the position where the character fell. Their `player-chip` in the top strip shows the spirit-form state (name dimmed, pips empty, `{colors.accent-spirit}` glow rim at full opacity, ghost icon in pip row). No HUD change beyond the chip.

**Phone (downed player):** Full spirit-form controller theme active. Raw Earth base recedes. Spirit Chant layer leads. Controller background shifts to a luminous, ethereal state using the player's session color. Left joystick zone: fully active — spirit-form players can move. Right zone: 3 cells locked (80% `{colors.bg-base}` mask, non-interactive). 4th cell: class-specific spirit-form ability, styled with session-color glow border. No standard skills are available.

**Trigger:** Server `player_downed` event (revive timer expired or immediate — see GDD mechanic).

**Exit trigger:** Server `player_revived` event → spirit-form theme dissolves immediately to standard controller. Player chip returns to alive state.

**Near-Wipe Vigil specific:** When all warriors except one are in spirit form, the host-canvas vigil visual shows all spirit forms surrounding the last standing fighter — in-canvas, not HUD. All downed phones are in spirit-form theme simultaneously.

---

### Boss Defeat Purification

**What's happening:** The boss has been defeated. The purification pulse radiates across the level.

**Host screen:** Purification pulse visual sweep — `{colors.accent-purify}` radiates outward from the boss position across the entire canvas. Corrupted environmental sprites flip to clean versions simultaneously. Territory Spirit Voice plays ("The plains are quieter tonight. You did this."). After the pulse completes, the level sits clean. Warriors remain free to roam.

**Phone:** Post-run screen transitions in. Landscape orientation maintained. Players see the summary on the host screen; their phones show the "Return to Camp" button.

---

### Run Failure

**What's happening:** All warriors have entered spirit form simultaneously. The run ends.

**Host screen:** Scene ends. Territory Spirit Voice plays ("Tonight, the forest was worse than we anticipated…"). Transition back to hub.

**Phone:** Post-run screen — failure tone. Spirit Essence (partial) shown. "Return to Camp" button.

---

### Post-Run Summary

**What's happening:** Run outcome is resolved. The host displays the summary. Players hold their phones showing "Return to Camp."

**Host screen:** Post-run summary template — victory or failure tone. Outcome headline, team Spirit Essence, per-player `post-run-card` rows. Screen persists until all players return.

**Phone:** Landscape. Outcome reflected in minimal phone UI. "Return to Camp" button is the only action. Tapping it triggers the player's return to hub. When all players have returned, the host screen transitions to Hub World.

---

### Reconnect

**Reconnect state (phone):** If the phone loses connection to the session (network drop, browser backgrounded, screen lock):
- The controller UI is replaced by a reconnect screen showing: the session code (large, centered), a "Rejoin Session" button (primary CTA), and a network status indicator.
- Player identity (name, class, session color, spirit bonds) is preserved for a grace period [duration TBD by engineering].
- On successful reconnect, the phone returns directly to the controller view — no re-auth, no class re-selection.
- If the grace period expires, the player slot is released and the player must re-join via QR or session code (auth state is preserved in session storage).

**Reconnect state (host):** When a player disconnects, their character freezes in place on the host canvas. Their player chip in the top strip shows a "disconnected" indicator (chip border shifts to `{colors.border}` dashed, name dims to `{colors.text-secondary}`). No gameplay pause — the run continues.

---

## 6. Interaction Primitives

These are the atomic interaction patterns. All higher-level flows compose from these.

### Movement Joystick

**Model:** Floating — the joystick ring spawns at the exact position the player's thumb touches the left zone. The ring does not live at a fixed position. This model adapts to how each player naturally holds their phone without requiring them to find a target.

**Behavior:** Ring tracks thumb position. Deadzone in center (character not moving below a small radius threshold). Full-range analog — velocity scales with drag distance from spawn origin.

**Zone:** Left ~40% of landscape screen. Any touch in this zone spawns the joystick.

---

### Skill Cells (Right Zone)

**Model:** Fixed 2×2 grid — always the same layout regardless of class. Only cell contents (which ability) differ per class.

**Three input types (see `skill-cell` in Section 4):** Joystick-AutoFire, Joystick-Release, Tap.

**Floating joystick within cell:** For Joystick-type skills, the directional ring spawns at touch position within the cell — same floating model as the movement joystick, constrained to the cell boundaries.

---

### Interact / Continue

**Single component, two labels.** `interact-button` component.

- **Interact:** Contextual POI proximity trigger. One tap opens the POI UI.
- **Continue:** Bond moment and rest moment advance. One tap (by any player) advances the group.

These two uses share the same visual component and slide-in/slide-out motion pattern. The label changes; the behavior pattern is identical.

---

### Return to Camp

**Phone button, post-run only.** Appears on the post-run phone screen. Tapping signals this player's readiness to return. When all active players have tapped, the group transitions back to the Hub World.

**Not a host-screen button.** The host screen persists until the transition is complete. This is intentional: the group controls the pace, and no one is auto-returned without their input.

---

### Hold-to-Confirm (Destructive Actions)

**Model:** For irreversible or socially impactful actions, a hold gesture is required — player holds the button for ~1.5 seconds before the action fires. A progress ring fills during the hold.

**Applied to:** Kick player from lobby (host action — [ASSUMPTION: kick is triggered from the host client, not the phone, but the exact interaction mechanism on the host is not defined in this session. The hold-to-confirm model is confirmed as the pattern]).

**Not applied to:** Join, class selection, Continue, Return to Camp — all single-tap.

---

### Multi-touch Requirement

**Multi-touch requirement:** The phone controller requires simultaneous multi-touch support. A player must be able to hold a touch in the left joystick zone AND hold or tap a skill cell in the right zone simultaneously. This is the primary input pattern during combat — movement + ability activation. Implementations that do not support at least 2 simultaneous touch points will silently break the core loop. Minimum: 2 concurrent touches required; 3 recommended (movement + hold skill + tap skill). Implementation must track each touch by `Touch.identifier` — not `event.targetTouches[0]`. Note the iOS Safari `touchmove` cancellation issue: listeners that control default touch behavior must use `{ passive: false }`.

### No Input Remapping (v1.0)

The 2×2 skill grid layout is fixed per class. Players cannot remap abilities to different cells in v1.0. This is a GDD-level constraint, not a UX decision — it simplifies the class design and keeps the controller UX consistent.

---

## 7. Accessibility Floor

### Touch Target Minimums

All interactive touch targets on the phone must meet a minimum 44×44px hit area. This applies to:
- `skill-cell` (each cell must be at least 44px in each dimension — typically much larger in practice)
- `interact-button` (minimum 44px height, full-width touch area)
- `join-button` (52px minimum height per component spec)
- `session-code-field` (minimum 44px height)
- Auth choice buttons (Sign In / Sign Up / Continue as Guest — each minimum 44px)
- `bond-card` Continue button

Floating joystick and skill cell joystick ring have no fixed target — they spawn at touch position, so touch accuracy is not a constraint.

---

### Contrast Targets

**Host screen (couch distance, ~2–4m):**
- `{colors.text-primary}` against `{colors.bg-surface}`: must achieve 4.5:1 minimum. Targeting 7:1+ for couch readability.
- Objective label and level/biome label in the top strip must be legible at couch distance — use `{colors.text-primary}` on the dark gradient strip background.
- `{colors.text-secondary}` against `{colors.bg-surface}`: must achieve 3:1 minimum (WCAG AA for large text / UI components). The session decision to bump `text-secondary` from `#7a7490` to `#a89ec0` was driven by this concern.

**Phone screen (handheld distance, ~30–40cm):**
- Standard WCAG AA (4.5:1) applies to all phone body text.
- Cooldown countdown value in `{colors.text-primary}` over the conic-gradient overlay: the overlay uses `{colors.bg-base}` at 70% opacity — ensure the text remains 4.5:1 against the composited overlay color.

---

### Low Reading Requirement During Gameplay (Design Principle)

**Confirmed design principle (D-009, D-007):** During active gameplay (in-dungeon combat), a player must be able to use their phone controller without reading. The right zone carries only:
- Ability icon (iconographic)
- Ability name (Lora italic, `base` — visible but not required reading)
- Input type badge (AUTO / RELEASE / TAP — memorizable after first session)
- Cooldown overlay (fills the cell — scannable at a glance)

**Nothing else.** No description, no tooltip, no status text during combat. Players learn their abilities in the ability briefing panel before entering the controller. Once in combat, muscle memory and icon recognition take over.

---

### Portrait Fallback

The phone join flow (Auth Choice, Session Code Entry) and class selection are designed in portrait. All other phone screens are landscape.

If a player holds their phone in portrait during the gameplay screens, the controller layout will be misaligned. The orientation transition behavior is specified in Section 11 (Orientation Transitions) — a rotation prompt appears after Session Code Entry and auto-dismisses when landscape is detected.

---

## 8. HUD & Diegetic UI

### Philosophy: Two Surfaces, Two Rules

**Host screen:** Near-zero non-diegetic overlay. The game canvas is the experience. The thin top strip is the only persistent non-diegetic element. Everything else — bond tethers, spirit forms, name tags, health pips — lives in-canvas as diegetic world elements or in-canvas renders (not separate HTML overlay elements).

**Phone screen:** Minimal persistent HUD (6px HP strip at top). All other elements are contextual: cooldown overlays appear when abilities fire, the interact button appears when near a POI, the bond card appears at level end.

---

### Host HUD Elements

| Element | Type | Persistence | Location |
|---|---|---|---|
| Top strip (player chips + labels) | Non-diegetic overlay | Persistent during dungeon run | Fixed top, 48px height |
| Level/biome label | Non-diegetic overlay | Persistent during dungeon run | Top-right in strip |
| Objective label | Non-diegetic overlay | Persistent during dungeon run | Top-center or top-right in strip |
| Player name tags | In-canvas render | Always in dungeon | Floating above character |
| Player health pips | In-canvas render | Always in dungeon | Floating above character |
| `revive-timer` | Non-diegetic overlay | Ephemeral — player downed only | Bottom-center |
| Spirit Bond tethers | In-canvas diegetic | Persistent once bond assigned | Between bonded characters |
| Spirit forms (The Vigil) | In-canvas diegetic | Present while player in spirit form | Around fallen character's position |
| Bond overlay text | Non-diegetic overlay | Ephemeral — ~3s at bond assignment | Centered over canvas |
| Chat-bubble POI icon | In-canvas render | While player near POI | Above character head |

---

### Phone HUD Elements

| Element | Type | Persistence | Location |
|---|---|---|---|
| HP strip | Minimal persistent HUD | Always during dungeon run | 6px strip at very top of phone screen |
| Skill cell cooldown overlays | Contextual | While ability on cooldown | On the relevant `skill-cell` |
| `interact-button` | Contextual | While near POI or at rest/bond moment | Top of phone, slides in |
| `bond-card` | Full-screen takeover | Bond assignment, bonded players only | Full screen |

---

### Diegetic Moments

These are moments where the world itself is the UI — no separate HTML overlay exists; the in-canvas experience carries the narrative.

**Purification pulse:** At boss defeat, `{colors.accent-purify}` radiates outward across the canvas. Corrupted sprites flip to clean versions. The pulse IS the "boss defeated" UI — no modal, no banner, no alert.

**Spirit forms (The Vigil):** Players in spirit form appear as luminous, colored in-canvas figures. Silent. Their presence communicates the stakes without any UI element needing to say "3 players are in spirit form."

**Campfire state:** The hub campfire brightness in-canvas is a living world-state indicator — brighter with collective player progression, dimmer without it. No progress bar; the fire is the bar.

**Bond tethers:** Colored particle lines connecting bonded pairs in-canvas. Three tethers during the boss fight. Not a HUD element — a world element.

---

## 9. Input Schemes

### Phone Touch Only

No keyboard, no mouse, no physical controller, no PC gamepad. Mobile touch is the only player input method. This is a GDD-level constraint and a core product USP (Zero Barrier to Together).

### Landscape Layout During Gameplay

```
┌─────────────────────────────────────────────────────────────┐
│  [HP STRIP — 6px, full width]                               │
├─────────────────────────────┬───────────────────────────────┤
│                             │  ┌──────────┬──────────┐      │
│   MOVEMENT JOYSTICK ZONE    │  │  Skill 1 │  Skill 2 │      │
│   (~40% width)              │  │          │          │      │
│   Floating — spawns at      │  │   AUTO   │  RELEASE │      │
│   touch position            │  ├──────────┼──────────┤      │
│                             │  │  Skill 3 │  Skill 4 │      │
│                             │  │          │          │      │
│                             │  │  RELEASE │   TAP    │      │
│                             │  └──────────┴──────────┘      │
│                             │   RIGHT ZONE (~60% width)      │
└─────────────────────────────┴───────────────────────────────┘
```

*Input type badges (AUTO / RELEASE / TAP) shown per-cell in the bottom-left corner.*

### Three Input Types

| Type | Model | Fires when |
|---|---|---|
| **Joystick-AutoFire** | Touch to spawn ring, drag to aim | Continuously while held |
| **Joystick-Release** | Touch to spawn ring, drag to set direction | On thumb lift |
| **Tap** | Pure tap | On touch down (or tap completion) |

All four skill cells are filled by the player's class. The grid layout is fixed — the same cell positions across all classes. Only the ability content in each cell changes per class.

### No Remapping in v1.0

Ability positions within the 2×2 grid are fixed per class. Players cannot customize which ability occupies which cell. Post-launch consideration only.

---

## 10. Game Feel & Juice

### Spirit Chant Layer Emergence

The Spirit Chant layer (`{colors.accent-spirit}`) is the primary feel vector — it surfaces at emotionally significant moments and creates the contrast that makes those moments land.

**Bond assignment (phone):**
- For bonded players: the `bond-card` fills the screen; the phone frame wraps in bond-color glow. This is the most intimate design moment in the game — one player alone with their bond. The frame glow makes the phone feel alive.
- For non-bonded players: the controller goes inactive; the `interact-button` Continue slides in. Quieter — but the quiet is intentional, the contrast to the bonded player's full-screen experience.

**Bond assignment (host):**
- Bond overlay text fades in over the canvas in Uncial Antiqua `{typography.scale.xl}` (40px) minimum, `{colors.accent-spirit}` glow (`text-shadow: 0 0 40px rgba(110,168,216,0.7)`). Brief, centered, ambient. No panel, no border — the text floats as if spoken by the world.
- Bond-specific audio plays. The visual and audio together make the moment.
- The new particle tether appears in-canvas between the bonded pair. For the rest of the run, this tether is visible in every dungeon frame — a permanent mark on the world.

**Purification pulse (host):**
- `{colors.accent-purify}` radiates across the entire canvas from the boss position. Corrupted sprites flip simultaneously. The environmental transformation is the payoff — players see the world healed in real time. The accompanying audio (clean, resonant, water-like) reinforces the visual.

**Spirit forms (The Vigil):**
- Fallen warriors appear as luminous figures in the world. Silent. No audio cue for their presence — the visual weight is the statement. Up to 6 spirit forms surrounding the last fighter. The contrast between the glowing spirits and the desperate action happening in-canvas is the most emotionally complex visual in the game.

**Cooldown feedback:**
- The conic-gradient cooldown overlay is large — it takes up most of the skill cell. The feeling of watching the cell "reload" is satisfying and immediate. Cooldown completion is felt, not just noticed.

---

### Micro-interactions

- `interact-button` slide-in: 200ms ease-out from top edge. No easing on disappear — faster is more responsive.
- Class card selection tap: immediate border color swap to `{colors.accent-spirit}` + ability panel slides up from bottom, 200ms.
- `bond-card` full-screen transition: cross-fade from controller view to bond card, 300ms. Frame glow appears after card is fully visible.
- Revive timer urgency escalation: amber halo on `revive-timer` intensifies gradually — not a sudden jump. Creates dread.
- Purification pulse: brief screen flash of `{colors.accent-purify}` before the canvas sweep begins — a frame-length trigger that primes the player for what's coming.

---

## 11. Responsive & Platform

### Host App

| Property | Value |
|---|---|
| Context | Browser or Electron wrapper |
| Display target | TV or monitor, shared screen |
| Viewing distance | ~2–4 meters (couch) |
| Input | No host-player touch input during gameplay; host controls session management (Create Session, Start Game, kick player) |
| Orientation | Landscape — always |
| Canvas | Full-bleed, edge-to-edge |
| Breakpoints | Not applicable — the host fills whatever display it runs on |

**No tablet or alternate host layout needed for v1.0.**

---

### Phone App

| Property | Value |
|---|---|
| Context | Mobile browser (iOS Safari / Android Chrome) |
| Display target | Player's own phone, held in hand |
| Orientation | Portrait for join flow and class selection; Landscape for all gameplay |
| Input | Touch only |
| Breakpoints | Single phone layout; no tablet or desktop controller layout for v1.0 |

**Join flow and class selection are portrait.** The transition from portrait (session code entry, class selection) to landscape (hub controller) should feel natural — the OS rotation handles it when the player tilts their phone.

### Orientation Transitions

- **Portrait → Landscape (join to play):** After the player taps "Join Game" on the Session Code Entry screen (portrait), the app displays a brief full-screen prompt: "Rotate your phone to landscape to play" with a rotation animation. The prompt auto-dismisses once the device is detected in landscape. If the device does not auto-rotate (rotation lock on), the prompt persists with a manual dismiss option. Landscape enforcement engages at the Hub Controller screen — Auth Choice and Session Code Entry remain portrait.
- **Landscape → Portrait sub-views:** Class selection opens as a portrait-friendly card scroll within the landscape controller context. This is handled as an in-app scroll region, not a device orientation change — the device stays landscape, the class selection panel scrolls horizontally within the right portion of the screen.
- **Bond card (landscape full-screen):** The bond assignment takeover stays in landscape — no orientation change.

---

### What Is Out of Scope for v1.0

- Tablet layout for the phone controller
- Desktop browser controller layout
- Physical gamepad / keyboard input
- Localization
- Any screen reader / VoiceOver optimization beyond baseline contrast compliance

---

## 12. Key Flows

Each flow below traces a specific user journey through both surfaces. Named protagonists are used throughout for concreteness.

---

### Flow 1: Mira Joins for the First Time as a Guest

**Protagonist:** Mira, first-time player, no account. Cyby has already created a session and the host screen shows the Lobby.

1. Cyby's lobby screen shows the QR code large and centered. The session code "WOLF-7" appears below it. Mira raises her phone.
2. Mira scans the QR code. Her phone's camera app opens the game URL with the session code in the URL params.
3. **Auth Choice screen (portrait):** Mira sees three options — "Continue as Guest," "Sign In," "Sign Up." She taps "Continue as Guest."
4. **Session Code Entry screen (portrait):** The code field is pre-populated with "WOLF-7" (from URL params). A name field below asks for her display name — empty, no fallback. She types "Mira."
5. Mira taps the `join-button`. A brief loading state (pulse animation). Then: success.
6. Mira's character walks through the campsite gate onto the host canvas. The host screen shows a new slot filling in the player roster in the top strip — "Mira" with a class-TBD indicator.
7. Mira's phone transitions to landscape: **Hub Controller** view. Left zone ready for movement joystick. Right zone shows 4 empty or placeholder skill cells (no class selected yet).
8. Mira can see her character on the host screen. She can move around the hub using her left joystick zone.

**Climax beat:** The moment Mira's character walks onto the host canvas and the room sees "Mira" appear in the player strip. Zero friction from scan to playing.

---

### Flow 2: Cyby Hosts a Session

**Protagonist:** Cyby, the host. Party is about to sit down.

1. Cyby opens the game on their PC/TV (host-client at port 3000). **Main Menu** — the Party Delve title in Uncial Antiqua xxl, a single "Create Session" button.
2. Cyby clicks "Create Session."
3. **Lobby screen:** A large QR code appears center-screen. Session code "WOLF-7" shown below. Player slots are empty.
4. Players scan in (Mira joins per Flow 1; others follow). Each arriving player fills a slot in the lobby's player roster, real-time.
5. Cyby can see all player names populating. A per-player kick button (X) sits beside each slot — hold-to-confirm if activated.
6. When the group is ready, Cyby clicks "Start Game."
7. **Hub World** loads on the host screen. All characters walk out of the campsite gate into the village. The campfire is visible, warm, at center.

**Climax beat:** The moment "Start Game" is clicked and the hub world appears with all characters walking in together. The shared screen lights up with the world.

---

### Flow 3: Dani Selects Souldrinker in the Hub

**Protagonist:** Dani, in the hub, navigating to class selection.

1. Dani moves their character using the left joystick zone on their phone. On the host screen, their character walks toward the class selection POI (the Campsite Gate, facing clean lands).
2. **Near-POI state:** A small chat-bubble icon appears above Dani's character on the host canvas. On Dani's phone, the `interact-button` slides in from the top edge — label: "Interact."
3. Dani taps "Interact."
4. **Phone transitions to portrait:** The class selection scroll appears. A horizontal row of `class-card` components is visible — approximately 2–3 cards. Dani swipes to browse.
5. Dani taps the Souldrinker card. The card highlights: `{colors.accent-spirit}` border, `{colors.bg-subtle}` tint. The ability briefing panel slides up from the bottom automatically, showing 4 `ability-chip` components and the class flavour intro ("The Bloodrite trade in sacrifice and return…" in Lora italic).
6. Dani reads the abilities. Taps "Pick Selected Class" in the ability briefing panel.
7. Dani's phone transitions back to landscape — **Hub Controller** view. The skill cells in the right zone now show Souldrinker's 4 abilities, each with name, icon placeholder, and input type badge.
8. On the host canvas, Dani's character has a brief in-world class-switch animation (walks out through gate, new class walks back in). The host strip updates Dani's chip to show "Souldrinker."

**Climax beat:** The skill cells filling in on the right zone with Dani's 4 abilities — the moment the phone becomes a Souldrinker controller. Personal, immediate, theirs.

---

### Flow 4: The Team Clears Level 2 and Receives a Fate Bond

**Protagonists:** Cyby and Dani (bonded). Mira and Rexx (non-bonded, others in session).

1. Level 2 clears — all enemies purified. The host canvas stills.
2. **Bond Assignment (host):** The Spirit Bond overlay text fades in over the canvas, centered: *"Cyby · Dani — Fate Bond"* — Uncial Antiqua `xl` (40px) minimum, `{colors.accent-spirit}` glow (`text-shadow: 0 0 40px rgba(110,168,216,0.7)`), no panel. Bond audio plays.
3. A colored particle tether line appears in-canvas between Cyby's and Dani's characters — the Fate Bond color (distinct from Bond 1's color from Level 1). It glows.
4. The text fades after ~3 seconds. The tether remains.
5. **Phone (Cyby):** Controller disappears. Full-screen `bond-card`. Frame wraps in Fate Bond color glow. Bond name in Uncial Antiqua. Bond description in Lora italic: *"You and Dani are now bound by fate. If they fall, you fall. Maybe warn them."* Bond mechanic summary. Continue button appears after ~1.5s.
6. **Phone (Dani):** Same `bond-card`, addressed to Dani. Same glow, same description personalized for Dani's view.
7. **Phone (Mira and Rexx):** Controllers remain visible, inactive. `interact-button` slides in from top — label: "Continue."
8. Mira taps "Continue." The group advances to Level 3. Bond cards dismiss, controllers reactivate.

**Climax beat:** The moment Cyby and Dani both look up from their glowing phones at each other after reading "If they fall, you fall." The social moment the bond creates, not just the mechanic.

---

### Flow 5: Rexx Is Downed with 20s on the Revive Timer

**Protagonist:** Rexx, downed in the boss fight. Rexx's third time being downed this run (revive window = 20s per GDD escalation table).

1. Rexx's health reaches zero during the boss fight. On the host canvas, Rexx's character collapses.
2. **Host HUD:** `revive-timer` appears at bottom-center — *"Rexx — 20s"* — Lora 700, `xl` size, `{colors.text-primary}`.
3. The timer counts down. At 10s remaining, timer text flips to `{colors.corruption-blood}`. The amber halo behind the `revive-timer` component intensifies.
4. The rest of the team is navigating the boss fight with the timer visible. The room is shouting about whether anyone can reach Rexx.
5. **If someone reaches Rexx in time:** A teammate's character reaches Rexx's position. Revive interaction completes. `revive-timer` disappears. Rexx's character stands. Rexx's phone returns to the active combat controller (if it changed state during the down).
6. **If the timer expires (20s):** `revive-timer` disappears. In-canvas, Rexx's spirit form appears — luminous, colored, hovering at the position where Rexx fell. The `player-chip` for Rexx in the top strip dims — name to `{colors.text-secondary}`, pips emptied, spirit-blue glow on the chip.
7. The Vigil begins. The boss fight continues short-handed.

**Climax beat:** 5 seconds left. The amber halo at full intensity. The room watching the timer. Everything else on screen happening simultaneously. The `revive-timer` is the most urgent UI element in the game at this moment — 40px Lora 700 in `{colors.corruption-blood}` against the dark canvas. It earns that size.

---

### Flow 6: The Team Defeats the Grassland Boss

**Protagonists:** The full team — Cyby, Dani, Mira, Rexx (in spirit form).

1. The boss's health reaches zero. The boss animation begins.
2. **Purification pulse:** A `{colors.accent-purify}` sweep radiates outward from the boss position across the entire host canvas. Corrupted ground sprites flip to clean versions — cracked golden grass becomes whole, soul crack glows disappear, void eyes close.
3. **Territory Spirit Voice** plays: *"The plains are quieter tonight. You did this."*
4. The team's characters remain on the now-clean level. Players can free-roam the purified environment. Rexx's spirit form may dissipate at this point or remain — [ASSUMPTION: spirit form behavior at run victory not explicitly defined in session. Either all spirit forms are restored to full characters at purification (thematically resonant), or they remain until the hub return. Flagged for design decision.]
5. **Phone (all players):** Controller transitions to Post-Run phone view. "Return to Camp" button is the only action. The landscape view shows a brief summary and the button.
6. **Host screen:** Post-Run Summary template — **victory tone**. Outcome headline: *"Purified. The campfire noticed."* Uncial Antiqua xl. Team Spirit Essence earned in `{colors.accent-warm}`. One `post-run-card` row per player: name, class, times downed.
7. Host screen persists until all players tap "Return to Camp."
8. Players return one by one. When all have tapped, the host transitions to **Hub World**. Characters walk through the gate. The campfire burns a little brighter.

**Climax beat:** The purification pulse. The entire host canvas — which the whole room has been watching for 30 minutes — flipping from corrupted to clean in a single visual sweep. The campfire reacting when they return. The room earned this.

---

## Visual References

Promoted mockups are the canonical visual references. Files in `.working/` are exploration artifacts and deprecated iterations.

| File | Illustrates |
|---|---|
| `mockups/host-hud-wireframe-1.html` | Host screen HUD — minimal overlay layout, player chips, revive timer |
| `mockups/controller-landscape-1.html` | Phone controller — landscape, 2×2 grid, floating joystick cells, idle + active states |
| `mockups/class-selection-wireframe-4.html` | Class selection — hub interact button, card browse, selected + ability panel |
| `mockups/join-flow-wireframe-1.html` | Join flow — host lobby screen, phone auth choice, phone session code entry |
| `mockups/bond-assignment-wireframe-1.html` | Phone bond card — full-screen takeover, Fate Bond and Proximity Bond variants |
| `mockups/post-run-summary-wireframe-1.html` | Host post-run summary — victory and failure states |
| `mockups/color-themes-1.html` | Five palette variations; Spirit Ground (variation 4) selected |
| `mockups/typography-specimen-1.html` | Four type direction specimens; Direction B (Ritual Hand) selected |
| `.working/direction-ember-stone.html` | Design direction candidate A — Ember & Stone |
| `.working/direction-primal-fractured.html` | Design direction candidate B — Primal & Fractured |
| `.working/direction-raw-earth.html` | Design direction candidate C — Raw Earth (base layer) |
| `.working/direction-spirit-chant.html` | Design direction candidate D — Spirit Chant (accent layer) |
| `.working/controller-layouts-1.html` | Four portrait controller layout options (deprecated — landscape chosen instead) |
| `.working/class-selection-wireframe-1.html` | Class selection v1 (deprecated — see v4) |
| `.working/class-selection-wireframe-2.html` | Class selection v2 (deprecated — see v4) |
| `.working/class-selection-wireframe-3.html` | Class selection v3 (deprecated — see v4) |

---

*End of Party Delve Experience Design*
