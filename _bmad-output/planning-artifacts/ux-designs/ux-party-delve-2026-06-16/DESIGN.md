---
name: Party Delve Design System
description: >
  Visual design spine for Party Delve. Defines all tokens, component anatomy, and
  visual rules for the host-client and mobile-controller surfaces. Source of truth
  for all CSS custom properties and component implementations.
status: final
updated: 2026-07-20

colors:
  bg-base:            { hex: "#0f0e10", role: "Deepest background" }
  bg-surface:         { hex: "#181620", role: "Cards, panels" }
  bg-subtle:          { hex: "#22202e", role: "Hover, secondary surfaces" }
  border:             { hex: "#36334a", role: "Dividers, input borders" }
  text-primary:       { hex: "#d8d0e8", role: "Main readable text" }
  text-secondary:     { hex: "#a89ec0", role: "Labels, dim copy" }
  accent-spirit:      { hex: "#6ea8d8", role: "Selections, active, spirit glow" }
  accent-warm:        { hex: "#c07d35", role: "Firelight, ochre, rewards" }
  accent-corruption:  { hex: "#7d2dff", role: "Corruption glow, danger" }
  accent-purify:      { hex: "#90d8f0", role: "Purification pulse, boss defeat" }
  interactive:        { hex: "#6ea8d8", role: "Buttons, CTAs" }
  interactive-hover:  { hex: "#88c0ee", role: "Button hover/focus" }
  corruption-acid:    { hex: "#39ff14", role: "Secondary corruption glow" }
  corruption-blood:   { hex: "#c0392b", role: "Injury/danger" }

typography:
  display:
    family: "Uncial Antiqua"
    source: "Google Fonts"
    weights: [400]
    uses: ["headings", "class names", "title", "section labels", "ambient bond overlay text"]
  body:
    family: "Lora"
    source: "Google Fonts"
    weights: [400, 700]
    italic: true
    uses: ["body text", "UI labels", "ability names", "flavour text", "bond descriptions", "tooltips"]
  scale:
    xs:   { size: "11px", lineHeight: "1.4", use: "input badges (AUTO/RELEASE/TAP), fine labels" }
    sm:   { size: "13px", lineHeight: "1.4", use: "secondary labels, cooldown text" }
    base: { size: "16px", lineHeight: "1.5", use: "body copy, skill cell names" }
    md:   { size: "20px", lineHeight: "1.3", use: "section headings, card titles" }
    lg:   { size: "28px", lineHeight: "1.2", use: "screen headings, lobby title" }
    xl:   { size: "40px", lineHeight: "1.1", use: "display title, session outcome headline" }
    xxl:  { size: "56px", lineHeight: "1.0", use: "main menu game title only" }

rounded:
  none: "0px"
  sm:   "4px"
  md:   "6px"
  lg:   "8px"
  xl:   "12px"
  note: >
    Primary interactive radius is md (6px) to lg (8px) — grounded, Raw Earth feel.
    Full pill radius is not used anywhere in the UI.

spacing:
  base: 8
  scale:
    "1":  "8px"
    "2":  "16px"
    "3":  "24px"
    "4":  "32px"
    "5":  "40px"
    "6":  "48px"
    "8":  "64px"
    "10": "80px"
    "12": "96px"

components:
  player-chip:
    description: "Compact player state indicator in the host top strip"
    variants: [alive, spirit-form]
  skill-cell:
    description: "Single ability slot in the phone 2x2 right-zone grid"
    variants: [idle, active-joystick, active-channel, on-cooldown, disabled]
  interact-button:
    description: "Contextual slide-in button on phone — POI proximity or bond-moment Continue"
    variants: [interact, continue]
  bond-card:
    description: "Full-screen phone takeover for bonded players at level end"
    variants: [standard, dismiss-ready]
  class-card:
    description: "Horizontally scrollable card in phone class selection flow"
    variants: [default, selected]
  ability-chip:
    description: "Compact ability tag in the ability briefing panel below class-card"
    variants: [joystick-autofire, joystick-release, aim-cast, tap]
  post-run-card:
    description: "Player breakdown row in the host post-run summary"
    variants: [victory, failure]
  revive-timer:
    description: "Ephemeral bottom-center host HUD element — appears when a player is downed"
    variants: [urgent, critical, expired]
  session-code-field:
    description: "Phone session code entry input"
    variants: [empty, prefilled, error]
  join-button:
    description: "Primary CTA on phone session code entry screen"
    variants: [default, loading, success]
---

# Party Delve Design System

## 1. Brand & Style

### The Two-Layer System

Party Delve's visual identity runs on two deliberately distinct design layers. These are not two palettes — they are two *registers* of the world.

**Raw Earth layer** is the base. It governs everything structural: backgrounds, surfaces, form fields, body text, borders, structural chrome. The Raw Earth layer is stable. It does not react. It is the world as it is — dark, earthy, grounded. Every screen begins here.

**Spirit Chant layer** is the accent. It surfaces only when something spiritually significant is happening: a selection is made, a bond is formed, a player enters spirit form, corruption leaks into the world, a boss is purified. The Spirit Chant layer has no decorative use. It is earned — by the player's action, by the narrative moment, by the world's state.

This separation is the aesthetic thesis of the game: the world feels heavy and real until it doesn't, and that moment of spirit energy surfacing is the emotional payload.

### Aesthetic Identity

**Tribal spirit fantasy.** Not swords and sorcery. Not high fantasy. Not dark fantasy. The world is earthy, inhabited, old. Nature and animal spirits are sacred, not ornamental. The setting is a frontier outpost on the border of a wounded world.

**What the design IS:**
- Grounded dark backgrounds with high-contrast readable text
- Organic, angular shapes — not clean tech, not rounded pill buttons
- Spirit energy as punctuation, not wallpaper
- Firelight warmth at anchor points (campfire, rewards, hub moments)
- Corruption as visible wrongness — wrong-colored light bleeding through cracks

**What the design IS NOT:**
- Neon / synthwave / cyberpunk
- High-key or light-mode
- Playful / cartoonish
- Glassmorphism or frosted glass panels
- Full-pill buttons or rounded-off everything
- Spirit glow used decoratively or frequently

---

## 2. Colors

### Token Reference

All tokens are CSS custom properties defined in the design system root. Every color usage in both apps must reference a token — never raw hex values in component CSS.

---

### `bg-base` — `#0f0e10`

The deepest background. Used as the page/canvas background for both apps, behind all surfaces. Never used for text, borders, or interactive elements. This is the void the world floats on — it should almost never be visible except at the very edges of the composition, behind panels that don't fill edge-to-edge.

---

### `bg-surface` — `#181620`

Cards and panels. The primary surface color for all UI panels: skill cells, bond cards, class cards, post-run cards, lobby player slots, session code field background. Always sits visually above `bg-base`. Do not use for structural backgrounds.

---

### `bg-subtle` — `#22202e`

Hover states and secondary surfaces. Used for hover/focus background states on interactive elements, for the ability briefing panel that slides in below a selected class card, and for any nested sub-surface inside a panel. Also the idle background for the phone's top HP strip. Not used as a primary panel color.

---

### `border` — `#36334a`

Dividers and input borders. Used for: all card borders, input field strokes, grid lines between skill cells, the top strip separator on the host HUD. The selected-card spirit-blue border overrides this with `accent-spirit`. Never used for text or icons.

---

### `text-primary` — `#d8d0e8`

Main readable text. All body copy, class names, player names, session codes, objective text, post-run summary text. Must pass 4.5:1 contrast against `bg-surface` at all standard sizes. Do not use `text-secondary` where `text-primary` is needed for readability.

---

### `text-secondary` — `#a89ec0`

Labels and dim copy. Used for: input type badges (AUTO / RELEASE / TAP), cooldown labels, secondary player stats, flavour text support lines, bond card "You are bonded with" attribution. Bumped from the original `#7a7490` per session decision — must remain legible from couch distance. Never use for primary readable content.

---

### `accent-spirit` — `#6ea8d8`

The Spirit Chant layer's primary color. Used for: active selections (selected class card border + background tint), active skill cell joystick ring, the ambient bond assignment text overlay on the host canvas (Uncial Antiqua glow), and spirit form glow on the host screen (player spirit forms). This is the color of the bond. It should feel cool, luminous, and earned. Never use as a background fill — only as a border, glow, or text accent. Note: this hex is identical to `interactive` — both map to the same spirit-blue. Their purposes are semantically separate; do not merge the tokens.

---

### `accent-warm` — `#c07d35`

Firelight, ochre, rewards. Used for: campfire-adjacent UI moments, the `accent-warm` glow on the revive timer (urgency register), Spirit Essence reward display in the post-run card, the Vendor-adjacent hub UI. This is the color of the campfire — it signals warmth, safety, and earned reward. Never use for danger states; danger is `corruption-blood`.

---

### `accent-corruption` — `#7d2dff`

Corruption glow, primary danger. Used for: soul crack glow overlays (in-canvas art direction reference), the corruption progress indicator if added to the HUD in future phases, corruption-themed ability visual effects. This is the dominant corruption color. It should feel deeply wrong — a purple that doesn't belong in the earthy world. Never use for selections or achievements.

---

### `accent-purify` — `#90d8f0`

Purification pulse, boss defeat. Used exclusively for the purification pulse moment: the visual sweep that radiates from the fallen boss across the host canvas, and the accompanying UI flash state if the HUD registers a boss defeat. This color is reserved for one of the most emotionally significant moments in the game — do not use it for general blue accents or hover states.

---

### `interactive` — `#6ea8d8`

Buttons and CTAs. The base fill or border color for all primary interactive elements: join-button (default state), the "Pick Selected Class" confirm button, the "Continue" button on the bond card, the "Return to Camp" button on the post-run phone screen. Same hex as `accent-spirit` — a deliberate design choice that connects interactive affordance with spirit energy. Use this token only for interactive elements; use `accent-spirit` for visual/spirit effects.

---

### `interactive-hover` — `#88c0ee`

Button hover and focus. Applied when a button or interactive element receives hover (desktop/host) or touch feedback. This token provides a visible but subtle step up in luminosity. Always paired with `interactive`.

---

### Corruption Fixed Tokens

These three corruption colors appear exclusively in in-canvas art and VFX — they are not used in the UI chrome.

| Token | Hex | Use |
|---|---|---|
| `accent-corruption` | `#7d2dff` | Primary soul crack glow — the dominant corruption signature |
| `corruption-acid` | `#39ff14` | Secondary corruption glow — used for specific enemy types or biome variants |
| `corruption-blood` | `#c0392b` | Injury and danger — downed player indicators, critical health, near-wipe HUD states |

---

## 3. Typography

### Font Roles

**Uncial Antiqua** is the display face. It carries the game's tribal-mythic identity. Its natural letterforms feel hand-carved, ancient, and ceremonial. It is used for: the game title, screen headings, class names in class cards, section labels in the post-run summary, the ambient Spirit Bond overlay text on the host canvas. It is never used for body copy, UI labels, ability names, or anything that must be read quickly under pressure.

**Lora** is the body and UI face. It is a readable serif with warmth — not a neutral sans, not a sharp geometric. Its weight and legibility at small sizes make it right for: ability names in skill cells, input type badges, bond card descriptions, Keeper dialogue, all form fields, all button labels, all player names. Lora italic is the flavour register — used exclusively for flavour text lines on class cards and bond descriptions addressed to the player.

### Scale Ramp

| Step | Size | Line Height | Use |
|---|---|---|---|
| `xs` | 11px | 1.4 | Input type badges (AUTO / RELEASE / TAP), fine labels |
| `sm` | 13px | 1.4 | Secondary labels, cooldown text, `text-secondary` labels |
| `base` | 16px | 1.5 | Body copy, skill cell ability names, session code display |
| `md` | 20px | 1.3 | Section headings, card titles, class card class names |
| `lg` | 28px | 1.2 | Screen headings, lobby title, bond card headline |
| `xl` | 40px | 1.1 | Post-run outcome headline, session code large display |
| `xxl` | 56px | 1.0 | Main menu game title only |

### Weight Rules

| Weight | Use |
|---|---|
| Lora 400 | All body text, labels, secondary copy |
| Lora 400 italic | Flavour text on class cards, bond descriptions |
| Lora 700 | Button labels, primary CTAs, player names in player-chips |
| Uncial Antiqua 400 | All display headings — this font has one weight |

### What Each Font Is Never Used For

**Uncial Antiqua is never used for:**
- Body copy longer than two lines
- Button labels or CTAs
- Cooldown text or ability names
- Any text that must be read quickly under pressure
- Text smaller than `md` scale (20px) — below this it loses legibility

**Lora is never used for:**
- The game title
- Screen-level headings on the host screen
- The ambient bond assignment overlay on the host canvas

---

## 4. Layout & Spacing

### The 8px Grid

All spacing, sizing, and layout decisions derive from an 8px base unit. Padding, margin, gap, and fixed sizing values are multiples of 8. The 4px half-unit is permitted for fine internal padding within compact elements (skill cell label padding, input badge padding). Never use arbitrary values.

### Host Screen Layout Rules

The host screen is a TV or monitor. Players view it from couch distance — typically 2–4 meters. Layout rules follow:

**Canvas-first:** The game canvas fills the screen edge to edge at all times. No UI chrome competes with the canvas for space. The canvas is the game; the HUD is minimal overlay.

**Thin top strip:** A single persistent horizontal strip occupies the top of the host screen. Height: 48px (6 × 8px). Contains: player chips (one per connected player), the current level/biome label (right-aligned), the current objective label (center or right). This strip sits above the canvas using absolute positioning with a subtle dark gradient beneath it for legibility — it does not occlude the canvas by more than its 48px height.

**Corner labels:** Level and biome label (top-right), objective label (top-center or top-right adjacent). Both are Lora 700 at `sm` size — brief, high-contrast, couch-readable.

**Revive timer:** Ephemeral. Appears bottom-center of the host screen when a player is downed. Does not persist otherwise. See Component section.

**In-canvas elements:** Player name tags and health pips are rendered in-canvas, not in the HTML overlay layer. Bond tethers are in-canvas particle lines. Spirit form glows are in-canvas. These are not HTML elements.

**Bond overlay text:** When a bond is assigned, a brief centered text block fades in over the canvas — Uncial Antiqua `lg` (28px), `accent-spirit` with subtle glow. No panel, no border, no background. Text fades out after ~3 seconds. The tether remains.

### Phone Layout Rules

The phone is held in landscape orientation during all gameplay. Portrait is used only for the join flow (auth choice, session code entry) and for class selection before entering the hub.

**Left zone:** Approximately 40% of landscape screen width. Movement joystick — floating, spawns at touch position. Background is `bg-base` with no visual element except the spawned joystick ring (which inherits `accent-spirit` at active state).

**Right zone:** Approximately 60% of landscape screen width. Fixed 2×2 grid of skill cells. Grid uses the full height of the zone with consistent gutters (8px between cells). Each cell is a rectangle — not square.

**Top of phone screen:** A 6px HP strip — `corruption-blood` fill on `bg-subtle` track, indicating current health. Always visible during gameplay. Minimal — not a full bar with labels.

**Portrait-only screens:** Auth choice screen, session code entry screen, class selection flow. These use standard vertical stack layout. After class selection is confirmed and the player transitions to the hub, the screen shifts to landscape.

### Safe Areas

For iOS/Android mobile browser: all interactive touch targets must respect safe area insets. The floating joystick and skill grid should not be positioned where system UI (home indicator, status bar) can intercept touches. Use `env(safe-area-inset-*)` CSS environment variables on the phone layout wrapper.

On the host screen (browser/Electron): no safe area concerns. Full-bleed canvas is correct.

---

## 5. Elevation & Depth

### Two-Layer Philosophy

The Raw Earth / Spirit Chant two-layer system maps directly to elevation and depth:

**Raw Earth (base layer):** All structural UI — backgrounds, panels, cards, form fields — sits at z-index 0–10. These elements use no glow and minimal shadow. The only shadow permitted on Raw Earth elements is a subtle inset or drop shadow using a very dark semi-transparent black (not a colored glow). This shadow exists to communicate surface separation — panel above background — not to create drama.

**Spirit Chant (accent layer):** Spirit Chant elements float above the Raw Earth layer. Bond tethers, spirit form glows, skill cell active states, interact button active glow, the bond overlay text — these sit at z-index 20+ and use the `accent-spirit` glow (box-shadow or drop-filter with `#6ea8d8` at 30–50% opacity). The glow is what places these elements in the Spirit Chant layer visually.

### When Spirit Chant Glow Appears

Spirit Chant glow (`accent-spirit` box-shadow or drop-shadow) appears on a UI element only when that element is in a spiritually active state:
- A class card is selected → spirit-blue border + `bg-subtle` background tint
- The interact / continue button is visible → the button carries a subtle spirit-blue glow
- A skill cell joystick ring is active for an AUTO or AIM_CAST ability → ring is `accent-spirit` (AIM_CAST additionally pulses; see `skill-cell` component). A RELEASE ability's ring uses `accent-warm` instead — not a Spirit Chant glow, matching its badge color.
- The bond overlay text fades in → text carries `accent-spirit` glow

Spirit Chant glow does NOT appear on idle elements, default buttons, or any decorative use.

### Shadow Language

| Use | Shadow spec |
|---|---|
| Panel above background | `0 2px 8px rgba(0,0,0,0.4)` |
| Card active state | `0 0 0 2px {border-color: accent-spirit}` (border, not shadow) |
| Spirit Chant glow — subtle | `0 0 8px rgba(110,168,216,0.35)` |
| Spirit Chant glow — strong (bond moment) | `0 0 20px rgba(110,168,216,0.6)` |
| Interact button idle | None |
| Interact button visible | `0 0 12px rgba(110,168,216,0.4)` |

---

## 6. Shapes

### The 6–8px Radius Rule

All interactive UI elements — buttons, cards, skill cells, input fields, player chips — use a border-radius between 6px (`rounded-md`) and 8px (`rounded-lg`). This is the primary shape language of the Raw Earth layer.

**Rationale:** Full pill buttons feel modern and clean — they communicate tech and polish. Party Delve's world is neither. The 6–8px radius is just enough to soften a purely mechanical rectangle while retaining a hand-hewn, grounded quality. The shape says "this was made, not manufactured."

### When Radius Is Zero

Host canvas edge elements — any UI element that bleeds into or is flush with the canvas edge — use `border-radius: 0`. This includes:
- The thin top strip itself (full-width, flush to top edge)
- Any panel that extends to a screen edge

The rationale: a rounded corner against a screen edge creates a visual gap that reads as a mistake. Flush edges are intentional.

### Amber Glow

The `accent-warm` amber glow is used for the revive timer's urgency state — a warm amber halo appears behind the revive timer element as time runs short, intensifying as the timer approaches zero. It is also the ambient glow reference for campfire-adjacent hub moments in the host canvas (art direction guidance, not HTML UI).

### Spirit Glow

The `accent-spirit` spirit glow is reserved for the Spirit Chant layer events listed in Section 5. On the phone, the bond card wraps the frame in the bond-specific color at the bond assignment moment — [ASSUMPTION: bond-specific colors are a distinct palette per bond type, using the base `accent-spirit` as the default. Bond-specific color tokens are not defined in this session and must be specified when the bond type designs are finalized.]

---

## 7. Components

### `player-chip`

**Purpose:** Represents a single player's session state in the host top strip.

**Anatomy:**
- Container: horizontal flex row, 8px padding, `rounded-md` (6px), `bg-surface` background
- Player name: Lora 700, `base` size (16px) minimum — not `xs` or `sm` — couch-distance legibility requirement; clamp to ~10 chars with ellipsis
- Class indicator: small icon or text label, Lora 400, `sm` size, `text-secondary`
- Health pip row: 3–5 small rectangular pips, minimum 12×12px per pip — must be large enough to count from 3 metres; filled `accent-warm` (alive), empty `border` color
- Spirit Bond indicator: if bonded, a small colored dot in the bond's color appears adjacent to the name

**States:**
- `alive`: default — name visible, health pips filled proportionally
- `spirit-form`: chip opacity remains at 100% (do not reduce container opacity — faded chip is indistinguishable from disconnected); name dims to `text-secondary`; pips are empty; ghost icon (20×20px minimum) replaces health pips in the pip row; `accent-spirit` glow rim on the chip container at full opacity to communicate spirit presence, not absence

**Sizing:** Target height 36px within the 48px strip. Width is content-driven — clamp player name to ~10 chars with ellipsis.

---

### `skill-cell`

**Purpose:** One of the four ability slots in the phone's 2×2 right-zone grid.

**Anatomy:**
- Container: rectangle, `bg-surface`, `border` stroke, `rounded-lg` (8px)
- Ability icon: top-center, placeholder geometric shape in v1 alpha; production sprites replace in later phase
- Ability name: Lora 400 italic, `base` size, `text-primary`, bottom region of cell
- Input type badge: Lora 400, `xs` size, `text-secondary`, bottom-left corner — displays AUTO, RELEASE, TAP, or AIM_CAST
- Cooldown overlay: conic-gradient timer covering the majority of the cell face; color `bg-base` at 70% opacity over the cell; countdown value in `text-primary` centered
- Joystick ring + knob: spawns at exact touch position when cell is touched (AUTO, RELEASE, and AIM_CAST types only — TAP never spawns one). Same visual grammar as the movement joystick (ring + solid draggable knob), scaled down to fit the cell: **80px ring, 28px knob** (movement is 110px/40px). Knob tracks the live drag offset from spawn origin, clamped to the ring radius. Ring clamps visually to the cell edge if the drag crosses the cell boundary (see EXPERIENCE.md §4, Cell boundary rule) — direction continues to update from the clamped position.
  - **AUTO:** ring + knob in `accent-spirit`, static (no animation). Matches the existing AUTO badge color.
  - **RELEASE:** ring + knob in `accent-warm`. Matches the existing RELEASE badge color.
  - **AIM_CAST:** ring + knob in `accent-spirit` **with a slow pulse** — opacity/scale breathing at a ~1.2s cycle. `accent-spirit` and `interactive` are the same hex (see Colors section), so a color-only distinction from AUTO would be invisible; the pulse is what communicates "this is a channel, not a repeating strike." Reuses the Spirit Chant layer's existing pulse idiom (see purification pulse, Colors section) rather than inventing a new animation language.
- Deadzone: 10px radius from spawn origin (independent of the movement joystick's 8px `DEADZONE_RADIUS` — see EXPERIENCE.md §6). Below this radius, the knob stays centered on the ring and no direction is committed.

**States:**
- `idle`: default appearance above
- `active-joystick`: AUTO or RELEASE ring+knob visible and tracking at touch origin
- `active-channel`: AIM_CAST ring+knob visible and tracking, pulsing
- `on-cooldown`: conic-gradient overlay active; cell content dims; interaction disabled
- `disabled`: full `bg-base` overlay, no interaction (e.g., not yet unlocked)

**Sizing:** Each cell fills ~50% of the right zone's height minus gutters. Width fills the zone with an 8px gutter between the two columns. [ASSUMPTION: target cell height ~80–100px in landscape on a standard 390px-wide phone held landscape, giving ~180px effective height zone for 2 rows. Exact sizing to be validated during build.]

**Out of scope:** A channel-progress indicator for AIM_CAST (visualizing the server-side channel start/refresh/cancel state added in Story 3.18) is not specified here — this component spec covers the aim/direction interaction only. Flagged as an open gap for a future UX pass; see `.decision-log.md` D-018.

---

### `interact-button`

**Purpose:** Contextual phone CTA — slides in from the top edge when the player's character is near a POI. Reused for the "Continue" action at bond moments (non-bonded players) and the rest-moment advance.

**Anatomy:**
- Container: horizontal pill-ish bar (but using `rounded-lg`, not full pill), full-width or ~80% width, centered, `bg-surface` background, `accent-spirit` border (2px), spirit glow shadow
- Label: Lora 700, `md` size, `text-primary` — reads "Interact" or "Continue" based on context
- Position: slides in from top edge of phone screen; positioned just below the safe-area inset at the top

**Variants:**
- `interact`: Label "Interact" — triggers POI UI (class selection, training dummy, dungeon entrance)
- `continue`: Label "Continue" — advances the group to the next level (bond moment, rest moment)

**Motion:** Slides from `translateY(-100%)` to `translateY(0)` on appear; reverses on disappear. Duration ~200ms, ease-out. Disappears when the character moves away from the POI (interact variant) or when any player taps Continue (continue variant).

**Touch target:** Full width of the button is the touch target. Minimum 44px height.

---

### `bond-card`

**Purpose:** Full-screen phone takeover for bonded players when a Spirit Bond is assigned at level end.

**Anatomy:**
- Container: full-screen, `bg-base` background, bond-color frame glow wrapping the phone frame
- Bond icon: top-center, large (48px), spirit-colored — [ASSUMPTION: bond icon design TBD when bond types are finalized]
- Bond name: Uncial Antiqua, `lg` size (28px), `text-primary`, centered
- Bond description: Lora 400 italic, `base` size, `text-secondary`, centered — direct personal address ("You and [Player] are now bound by fate…")
- Bond mechanic summary: Lora 700, `sm` size, `text-primary` — brief mechanical statement ("Both players fall together")
- Continue button: `interact-button` component in `continue` variant, below description

**States:**
- `standard`: card fully visible, controller hidden behind it
- `dismiss-ready`: Continue button becomes active after a brief mandatory read delay (~1.5s)

**Sizing:** Full screen — no margins. The bond-color glow wraps the physical phone frame (CSS `outline` or `box-shadow` on the root element).

---

### `class-card`

**Purpose:** One class entry in the horizontal scrollable class selection list on the phone.

**Anatomy:**
- Container: fixed-width card, `bg-surface`, `border` stroke, `rounded-lg` (8px)
- Class name: Uncial Antiqua, `md` size (20px), `text-primary`
- Role label: Lora 700, `sm` size, `text-secondary` (e.g., "Tank / Frontline anchor")
- Flavour line: Lora 400 italic, `sm` size, `text-secondary` — one sentence
- Selection state: `accent-spirit` border (2px) replaces `border`; `bg-subtle` tint on background

**Tap behavior:** Tapping highlights the card (selected state). Does not show a "Select" button on the card itself. The ability briefing panel auto-opens at the bottom of the screen on card highlight.

**States:**
- `default`: `bg-surface`, `border` stroke
- `selected`: `accent-spirit` border, `bg-subtle` tint, triggers ability briefing panel

**Sizing:** Cards are approximately 200px wide (portrait), visible 2–3 at a time in the horizontal scroll. Height ~180px.

---

### `ability-chip`

**Purpose:** Compact representation of one ability within the ability briefing panel (auto-opens when a class card is selected).

**Anatomy:**
- Container: inline-flex, `bg-subtle`, `rounded-sm` (4px), horizontal padding 8px, vertical padding 4px
- Ability name: Lora 700, `sm` size, `text-primary`
- Input type badge: Lora 400, `xs` size, `text-secondary` — AUTO, RELEASE, TAP, or AIM_CAST

**Variants:** Four visual variants match the four input types, via a left-border accent color: `accent-spirit` for AUTO, `accent-warm` for RELEASE, `border` for TAP, `accent-spirit` for AIM_CAST (same family as AUTO — both are continuous-while-held; the chip is a static preview so AIM_CAST's live pulse doesn't apply here, the shared color alone signals the "held" family). Corrects the current build's `ABILITY_BADGE_BORDER`, which colors AIM_CAST as `accent-warm` (a pre-Story-3.18 leftover from when AIM_CAST fired on release, grouped with RELEASE) — see `.decision-log.md` D-018.

---

### `post-run-card`

**Purpose:** Per-player breakdown row in the host post-run summary screen.

**Anatomy:**
- Container: horizontal flex row, `bg-surface`, `rounded-md` (6px), full-width within summary panel
- Player name: Lora 700, `base` size, `text-primary`
- Class name: Lora 400, `sm` size, `text-secondary`
- Down count: Lora 400, `sm` size, `text-secondary` — "Downed ×N"
- Spirit Essence earned: Lora 700, `base` size, `accent-warm` — numeric value

**Variants:**
- `victory`: default appearance
- `failure`: player name and class dim to `text-secondary`; spirit Essence shows partial value; [ASSUMPTION: failure-state partial reward display rules TBD — flagged in GDD]

---

### `revive-timer`

**Purpose:** Ephemeral host HUD element — appears when any player is downed. Shows remaining revive window. Disappears when the player is revived or enters spirit form.

**Anatomy:**
- Container: centered bottom, absolute positioned, `bg-surface`, `rounded-md` (6px), horizontal padding 16px, vertical padding 8px, minimum width 280px
- Player name: Lora 700, `sm` size, `text-primary`
- Timer value: Lora 700, `xl` size (40px) minimum — must be legible at 3 metres; changes color by urgency state
- Progress bar: fills the bottom of the container using the urgency color progression
- Card border: `accent-corruption` (corruption-purple) — for the container border only, not for the countdown text or progress bar
- Amber halo: `accent-warm` box-shadow behind the container, intensifies as timer approaches 0

**Color progression (countdown text and progress bar):**
- `urgent` (timer > 10s): `accent-warm` (amber)
- `critical` (timer ≤ 10s): `corruption-blood` (#c0392b)

**States:**
- `urgent`: timer > 10s — timer text and progress bar `accent-warm`; amber halo present
- `critical`: timer ≤ 10s — timer text and progress bar transition to `corruption-blood`; amber halo intensifies
- `expired`: element fades out; spirit form VFX triggers in-canvas

**Multiple simultaneous timers:** If more than one player is downed, timers stack vertically above center-bottom. [NOTE FOR UX: stacking behavior with 3+ simultaneous timers in a near-wipe scenario may require a condensed mode — not defined in this session.]

---

### `session-code-field`

**Purpose:** Phone input for manual session code entry (when not using QR scan).

**Anatomy:**
- Input field: full-width, `bg-surface`, `border` stroke, `rounded-md` (6px), Lora 400 `base` size, `text-primary`; placeholder text "Enter session code" in `text-secondary`
- Pre-populated state: field shows the code from QR URL params, pre-filled and editable
- Error state: `corruption-blood` border; brief error text below in Lora 400, `sm` size, `text-secondary`

**States:**
- `empty`: placeholder visible
- `prefilled`: code from QR URL; border remains `border` color
- `error`: `corruption-blood` border; error label below

---

### `join-button`

**Purpose:** Primary CTA on the phone session code entry screen — confirms joining the session.

**Anatomy:**
- Container: full-width button, `interactive` fill, `rounded-lg` (8px), height 52px minimum
- Label: Lora 700, `md` size, `bg-base` text (reversed — dark text on spirit-blue background)
- Loading state: label replaced by a simple three-dot pulse animation; button disabled
- Success state: brief green flash, then navigation proceeds

**States:**
- `default`: `interactive` fill, `interactive-hover` on tap
- `loading`: pulse animation, non-interactive
- `success`: momentary `accent-purify` flash before navigation

---

## 8. Do's and Don'ts

### Do's

- **Do use `accent-spirit` only when it is earned** — selection, active state, spirit energy moment. Every use should feel like a small narrative event.
- **Do keep the game canvas unobstructed** — the top strip is 48px. Nothing else overlays the canvas persistently.
- **Do use Lora 700 for all button labels** — buttons must be legible at couch distance and under thumb pressure.
- **Do use the 8px grid for all spacing** — every padding, margin, gap, and fixed size is a multiple of 8 (or 4 for fine internal padding).
- **Do keep border-radius between 6–8px** on interactive elements. This is non-negotiable for the Raw Earth feel.
- **Do use `text-secondary`** for all secondary labels, badges, and dim copy — it has been tuned for legibility at the session; do not return to the original darker value.
- **Do keep the phone HP strip at 6px** — it is presence, not information. Players glance at it; they do not read it.
- **Do let the bond card fill the entire phone screen** — this is one of the most significant moments in the game. Give it the whole canvas.
- **Do use Uncial Antiqua only at `md` scale or larger** — below 20px it loses legibility.
- **Do render bond tethers and spirit forms in-canvas** — these are diegetic world elements, not HTML overlay UI.

### Don'ts

- **Don't use full-pill border-radius** on any button or interactive element. Never.
- **Don't decorate with `accent-spirit`** — glow on idle elements, loading spinners, section dividers, or anything that is not in a spiritually active state.
- **Don't put a "Select" button on individual class cards** — highlight state on tap is the selection affordance.
- **Don't show a class roster on the host screen** — class selection is phone-only.
- **Don't render bond descriptions, ability descriptions, or HP numbers on the host screen** — that information belongs on the phone.
- **Don't use `accent-purify`** outside the purification pulse moment and its immediate UI response.
- **Don't use raw hex values in component CSS** — all color references must be CSS custom properties resolving to design tokens.
- **Don't show the revive timer persistently** — it appears only when a player is downed and disappears on resolution.
- **Don't use Uncial Antiqua below 20px** (the `md` scale step) in any context.
- **Don't use glassmorphism, blur, or frosted panel effects** — they conflict with the Raw Earth base layer.
- **Don't use more than one font family** for any single text element — do not mix Uncial Antiqua and Lora in a single label or compound heading.

---

## Visual References

Promoted mockups are the canonical visual references. Files in `.working/` are exploration artifacts and deprecated iterations.

| File | Illustrates |
|---|---|
| `mockups/host-hud-wireframe-1.html` | Host screen HUD — minimal overlay layout, player chips, revive timer |
| `mockups/controller-landscape-1.html` | Phone controller — landscape, 2×2 grid, floating joystick cells, idle + active states. Predates AIM_CAST (added Story 3.11, after this mock) — its `active-s2` frame shows the AUTO/RELEASE ring+knob pattern (`.skill-joystick-outer`/`.skill-joystick-inner`) that D-017 formalizes for all held types; the AIM_CAST pulse (D-018) is not represented in this mock. |
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
