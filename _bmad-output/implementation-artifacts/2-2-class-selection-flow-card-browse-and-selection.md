---
baseline_commit: 2080a17
---

# Story 2.2: Class Selection Flow — Card Browse & Selection

Status: done

## CLAUDE.md Required Task Header

```
Phase: 2 — Local Party MVP (Epic 2: Hub World & Class Selection)
Context: Story 2.1 is complete. Players can approach the class selection POI and see the
  interact button slide in on their phone. The interact button's onTap handler is a no-op
  TODO pointing to this story. This story wires the Interact tap to open a full-screen class
  selection overlay on mobile, renders the 4 alpha class cards in a horizontal scroll, and
  shows an ability briefing panel when a card is selected. No server interaction occurs in
  this story — the overlay is entirely client-side. Story 2.3 handles the class-confirmation
  server message, host-side updates, and controller transition.
Owner agent: Multi-context (explicit cross-context approval):
    Protocol Architect (Task 1 — class definitions in shared-types)
    Mobile Controller Engineer (Task 2 — ClassSelectionScreen overlay)
Goal: When a player taps "Interact" near the class selection POI, a full-screen class
  selection overlay opens on the phone showing 4 horizontally scrollable class cards. Tapping
  a card highlights it (accent-spirit border, bg-subtle tint) and slides an ability briefing
  panel up from the bottom showing 4 ability chips and a "Pick Selected Class" button.
  The back button dismisses the overlay. "Pick Selected Class" is rendered but is a no-op
  pending Story 2.3.
Allowed paths:
  - packages/shared-types/src/class-definitions.ts   (NEW)
  - packages/shared-types/src/index.ts               (add new export)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx
Blocked paths:
  - apps/simulation-server/**       (no server changes — class confirmation is Story 2.3)
  - apps/host-client/**             (host chip update is Story 2.3)
  - packages/net-protocol/**        (no new wire messages in this story)
  - packages/game-rules/**          (Story 3.1+ territory)
  - apps/backend-platform/**
Inputs:
  - packages/shared-types/src/player.ts              (PlayerClass enum already exists — reuse)
  - packages/shared-types/src/index.ts               (needs new export added)
  - apps/mobile-controller/src/screens/ControllerScreen.tsx  (has TODO for this story at onTap)
Non-goals:
  - Sending class selection message to sim server (Story 2.3)
  - Host canvas class-name chip update (Story 2.3)
  - Hub controller transition after class pick (Story 2.3)
  - In-canvas character class-switch animation (Story 2.3)
  - Actual class ability mechanics, stats, cooldowns (Story 3.3)
  - planck.js physics (Story 3.1)
  - Training dummy interaction flow (Story 2.4)
  - Class selection for already-selected classes (no deselect flow needed)
Acceptance criteria: see AC section below
Required hooks:
  - Contract-change hook: shared-types is modified (additive — new static types and constants,
    no new wire messages). Typecheck and Protocol Architect review required. No contract test
    needed (no wire protocol change).
  - Client-UX hook: apps/mobile-controller changes in Task 2.
Required tests:
  - No new contract tests (no wire protocol changes in this story)
  - Typecheck must be clean from repo root after both tasks
Telemetry impact: none (class card browsing has no KPI requirement in this story)
```

---

## Cross-Context Ownership Note

This story spans Protocol Architect (shared-types static data) and Mobile Controller Engineer
(mobile overlay UI). The tasks are sequential — Task 2 imports `CLASS_DEFINITIONS` from
shared-types, so Task 1 must finish first. Explicit cross-context approval is granted:
the shared-types change is a small, additive type declaration file with zero runtime logic,
and the mobile change is self-contained within ControllerScreen.tsx.

---

## Story

As a player,
I want to browse the class roster on my phone and tap a class card to see its abilities,
so that I can choose the right class for my playstyle before entering the dungeon.

---

## Acceptance Criteria

**AC1 — Class selection overlay opens on Interact tap:**
**Given** the player's phone shows the interact button (nearPoiId === 'class-select')
**When** the player taps the "Interact" button
**Then** the class selection screen opens as a full-screen overlay on the phone (covers the
controller)
**And** a top bar shows "← Back" on the left and "Choose Your Class" in Uncial Antiqua at md
(~16px in the bar, readable) centered
**And** a horizontally scrollable row of `class-card` components is visible
**And** approximately 2–3 cards are visible at once (cards ~190px wide with gap ~14px)
**And** a right-edge fade (gradient to bg-base) hints at more cards beyond the visible area

---

**AC2 — All 4 alpha classes are present:**
**Given** the class selection screen is open
**When** the card row renders
**Then** exactly 4 cards are present: Stonehide, Spiritcaller, Souldrinker, Stormcaller
**And** each card shows:
- class name in Uncial Antiqua at `--text-md` (20px), `text-primary`
- role label in Lora 700 at `--text-sm`, `text-secondary` (e.g., "Tank · Frontline Anchor")
- one flavour line in Lora 400 italic at `--text-sm`, `text-secondary`
- a placeholder icon area at the top of the card

---

**AC3 — Card tap selects it and deselects others:**
**Given** the class selection card row is visible
**When** the player taps a class card
**Then** the tapped card enters its selected state:
  - `accent-spirit` border (2px) replaces the default `border` stroke
  - background shifts to `bg-subtle` (icon area also tints to `bg-subtle`)
  - a subtle `accent-spirit` box-shadow glow (12px, rgba(110,168,216,0.25)) on the card
**And** any previously selected card returns to its default state (border stroke, bg-surface)
**And** only one card can be selected at a time

---

**AC4 — Ability briefing panel slides up on card selection:**
**Given** a class card is selected
**When** the selection happens
**Then** the ability briefing panel slides up from the bottom edge of the screen in ~200ms
ease-out (`translateY(100%)` → `translateY(0)`)
**And** the card scroll area above compresses to make room (bottom of card area = top of panel)
**And** the panel contains:
  - Left section (~80% width): 4 `ability-chip` components in a 4-column row plus the class
    role summary in Lora 400 at `--text-xs`, `text-secondary` below the chips
  - Right section (~20% width, separated by a 1px border): the "Pick Selected Class" confirm
    button

---

**AC5 — Ability chips show name and input type:**
**Given** the ability panel is open
**When** it renders 4 `ability-chip` components
**Then** each chip shows the ability name in Lora 700 at `--text-sm`, `text-primary`
**And** an input type badge (AUTO, RELEASE, or TAP) in Lora 400 at `--text-xs`, `text-secondary`
**And** the badge uses a left-border accent: `accent-spirit` for AUTO, `accent-warm` for
RELEASE, `border` color for TAP
**And** ability names that are long truncate with ellipsis (no overflow)

---

**AC6 — "Pick Selected Class" button is present (Story 2.3 no-op):**
**Given** the ability panel is open
**When** the panel renders
**Then** a "Pick Selected Class" button is present in the right section of the panel
**And** the button uses `interactive` fill, Lora 700 label, 6px border-radius, min-height 48px
**And** tapping the button has no server-side effect in this story (no-op — Story 2.3 wires it)
**And** tapping it does close the class selection overlay (local-only state reset)
**Note:** The button's label in the panel must read "Pick Selected Class" — no "Select" button
appears on the card itself (UX-DR5 class-card spec)

---

**AC7 — Back button dismisses the overlay:**
**Given** the class selection overlay is open (whether or not a card is selected)
**When** the player taps "← Back"
**Then** the class selection overlay closes
**And** the controller view resumes (interact button still visible if player is still near POI)
**And** no selected class is stored — the selection is discarded on Back (Story 2.3 persists it)

---

**AC8 — Touch target minimums are met:**
**Given** the class selection overlay is displayed on a landscape phone
**When** any interactive element is inspected
**Then** each class card's full height is touch-responsive (full card area, min ~135px height)
**And** the "← Back" label area is at least 44×44px (per NFR5)
**And** the "Pick Selected Class" button is at least 44px tall (per NFR5)

---

## Tasks / Subtasks

- [x] **Task 1: Add ClassDefinitions to shared-types** (AC: #1, #2, #4, #5) — Protocol Architect
  - [x] Create `packages/shared-types/src/class-definitions.ts` — `AbilityInputType`, `ClassAbilityDef`, `ClassDef` interfaces + `CLASS_DEFINITIONS` constant (see Dev Notes §Task 1)
  - [x] Edit `packages/shared-types/src/index.ts` — append `export * from './class-definitions.js'`
  - [x] Run `npm run typecheck` from repo root — must be clean

- [x] **Task 2: Implement ClassSelectionScreen overlay in mobile controller** (AC: all) — Mobile Controller Engineer
  - [x] Read `apps/mobile-controller/src/screens/ControllerScreen.tsx` in full before editing
  - [x] Wire the `InteractButton` `onTap` handler to open the overlay when `nearPoiId === 'class-select'` (see Dev Notes §Task 2 — InteractButton wiring)
  - [x] Add `ClassSelectionScreen` component in the same file (see Dev Notes §Task 2 — component structure)
  - [x] Add `ClassCard` sub-component (see Dev Notes §Task 2 — ClassCard)
  - [x] Add `ClassIcon` sub-component with SVG placeholder icons per class (see Dev Notes §Task 2 — ClassIcon)
  - [x] Add `AbilityChip` sub-component (see Dev Notes §Task 2 — AbilityChip)
  - [x] Render `ClassSelectionScreen` as absolute overlay inside the existing root container (see Dev Notes §Task 2 — overlay placement)
  - [x] Run `npm run typecheck` from repo root — must be clean

### Review Findings (AI)

- [x] [Review][Decision] Auto-close overlay when activePoi leaves 'class-select' — deferred; Back button is always visible and sufficient for dismissal. Story 2.3 may revisit when POI-exit semantics are finalized with class persistence.
- [x] [Review][Patch] Top bar height raised to 44px, card scroll and right-edge fade top adjusted to 44 — fixed [apps/mobile-controller/src/screens/ControllerScreen.tsx]
- [x] [Review][Patch] Panel open: added `transition: 'bottom 200ms ease-out'` to card scroll area and right-edge fade — fixed [apps/mobile-controller/src/screens/ControllerScreen.tsx]
- [x] [Review][Patch] SPIRITCALLER SVG viewBox corrected from "0 0 44 48" to "0 0 44 44" — fixed [apps/mobile-controller/src/screens/ControllerScreen.tsx]
- [x] [Review][Patch] ClassIcon switch: added `default: return null` exhaustiveness guard — fixed [apps/mobile-controller/src/screens/ControllerScreen.tsx]
- [x] [Review][Defer] stopJoystick not called on ControllerScreen unmount [apps/mobile-controller/src/screens/ControllerScreen.tsx] — deferred, pre-existing gap in joystick useEffect cleanup, not introduced by this story
- [x] [Review][Defer] Object.values(CLASS_DEFINITIONS) display order is implicit insertion-order [packages/shared-types/src/class-definitions.ts] — deferred, pre-existing; V8 guarantees insertion order for string keys but an explicit CLASS_ORDER array would make it intentional
- [x] [Review][Defer] WebkitOverflowScrolling deprecated — deferred, harmless on iOS 13+; verify on target device range
- [x] [Review][Defer] scrollSnapType + alignItems:center snap miscalculation on panel resize — deferred, browser-specific edge case, verify with real device testing
- [x] [Review][Defer] Ability panel missing aria-hidden/inert when not shown — deferred, a11y out of scope for this story

---

## Dev Notes

### Orientation Strategy

The Epic AC says "in portrait orientation" for the card row. The UX EXPERIENCE.md has two
conflicting statements:
- Line 307: "Portrait-only screens: class selection flow" (implies device rotation)
- Line 641: "not a device orientation change — the device stays landscape, the class selection
  panel scrolls horizontally within the right portion of the screen"

The definitive source is the wireframe `class-selection-wireframe-4.html` (the v4 supersedes
v1–v3 per the UX design index). The wireframe shows a 844×390px landscape frame (full
landscape phone) for all three class selection states. **Implement as a full-screen landscape
overlay — no device rotation.** The phrase "portrait orientation" in the Epic AC refers to
portrait-aspect-ratio cards (tall cards), not the device.

---

### Task 1 — Dev Notes: shared-types/src/class-definitions.ts

Create this new file at `packages/shared-types/src/class-definitions.ts`:

```typescript
import { PlayerClass } from './player.js';

export type AbilityInputType = 'AUTO' | 'RELEASE' | 'TAP';

export interface ClassAbilityDef {
  name: string;
  inputType: AbilityInputType;
}

export interface ClassDef {
  id: PlayerClass;
  displayName: string;
  role: string;
  flavor: string;
  abilities: [ClassAbilityDef, ClassAbilityDef, ClassAbilityDef, ClassAbilityDef];
}

export const CLASS_DEFINITIONS: Record<PlayerClass, ClassDef> = {
  [PlayerClass.STONEHIDE]: {
    id: PlayerClass.STONEHIDE,
    displayName: 'Stonehide',
    role: 'Tank · Frontline Anchor',
    flavor: 'Called from the mountain clans, where endurance is prayer.',
    abilities: [
      { name: 'Stone Wall',    inputType: 'TAP'     },
      { name: 'Tremor Stomp', inputType: 'RELEASE'  },
      { name: 'Iron Skin',    inputType: 'TAP'     },
      { name: 'Avalanche',    inputType: 'AUTO'    },
    ],
  },
  [PlayerClass.SPIRITCALLER]: {
    id: PlayerClass.SPIRITCALLER,
    displayName: 'Spiritcaller',
    role: 'Burst Healer · Revive Support',
    flavor: 'Calls on the dead to protect the living. Timing is everything.',
    abilities: [
      { name: "Ancestor's Voice", inputType: 'AUTO'    },
      { name: 'Spirit Nova',      inputType: 'TAP'     },
      { name: 'Soul Mend',        inputType: 'RELEASE' },
      { name: 'Warding Cry',      inputType: 'TAP'     },
    ],
  },
  [PlayerClass.SOULDRINKER]: {
    id: PlayerClass.SOULDRINKER,
    displayName: 'Souldrinker',
    role: 'Drain DPS · Risk-Reward',
    flavor: 'The Bloodrite trade in sacrifice and return. Pain is currency.',
    abilities: [
      { name: 'Blood Draw',    inputType: 'AUTO'    },
      { name: 'Crimson Lash', inputType: 'RELEASE' },
      { name: 'Dark Pact',    inputType: 'TAP'     },
      { name: 'Void Pulse',   inputType: 'TAP'     },
    ],
  },
  [PlayerClass.STORMCALLER]: {
    id: PlayerClass.STORMCALLER,
    displayName: 'Stormcaller',
    role: 'Zone DPS · Area Pressure',
    flavor: 'Where the shaman walks, the sky cracks open.',
    abilities: [
      { name: 'Lightning Arc',  inputType: 'AUTO'    },
      { name: 'Tempest Hurl',   inputType: 'RELEASE' },
      { name: 'Thunder Clap',   inputType: 'TAP'     },
      { name: 'Storm Eye',      inputType: 'AUTO'    },
    ],
  },
};
```

**Important:** The `abilities` field is typed as a 4-tuple
`[ClassAbilityDef, ClassAbilityDef, ClassAbilityDef, ClassAbilityDef]` — TypeScript will
enforce exactly 4 entries at compile time. This matches the FR12 requirement ("exactly 4
abilities in a fixed 2×2 grid").

**`packages/shared-types/src/index.ts`** — append this line:
```typescript
export * from './class-definitions.js';
```

This file currently exports 9 modules. The new line goes at the end.

**Naming note:** `AbilityInputType` is a display/UI type (what badge to show, how the skill
cell behaves). It is NOT the same as the `InputEvent` union in `input.ts` (which is the wire
protocol event shape). They serve different purposes — do not merge them.

**Story 3.3 note:** These ability names and input types are placeholders used for UI display.
Story 3.3 will define the actual ability mechanics (cooldowns, damage, effect radius) in
`packages/game-rules/balance.ts`. The names here should be stable enough not to change, but
the dev agent for Story 3.3 may revise them during implementation.

---

### Task 2 — Dev Notes: ControllerScreen.tsx

**Current state of the file** (read it fully before editing):
- Root div: `position: relative; height: 100%; display: flex; background: var(--bg-base); touchAction: none`
- `InteractButton` is already implemented; its `onTap` prop calls `() => { /* TODO Story 2.2 — open POI UI */ }`
- `activePoi` is derived from `myPlayer?.nearPoiId ?? null`
- Joystick zone: 40% left, full height
- Skill grid: 60% right, 2×2, non-interactive in hub

**Overall structure after this story:**

```
ControllerScreen (root div, position: relative, height: 100%, display: flex)
├── InteractButton (absolute, top slide-in, wired to open overlay)
├── Left joystick zone (40%)
├── Right skill grid (60%)
└── ClassSelectionScreen (absolute, inset: 0, z-index: 50, visible when open)
    ├── TopBar (32px)
    ├── CardScrollArea (absolute, top: 32, bottom: panelOpen ? 130 : 0)
    │   └── [ClassCard × 4]
    ├── RightFade (gradient overlay, pointer-events: none)
    └── AbilityPanel (absolute, bottom: 0, height: 130, slide-up)
        ├── PanelLeft (80%): [AbilityChip × 4] + role hint
        └── PanelRight (20%): "Pick Selected Class" button
```

---

#### InteractButton wiring

Add `classSelectionOpen` state to `ControllerScreen`. Update the InteractButton `onTap` prop:

```typescript
// Add near the top of ControllerScreen
const [classSelectionOpen, setClassSelectionOpen] = useState(false);

// Update InteractButton in the JSX:
<InteractButton
  visible={activePoi !== null}
  onTap={() => {
    if (activePoi === 'class-select') setClassSelectionOpen(true);
    // Other POI types handled in future stories
  }}
/>
```

Then render the overlay just before the closing tag of the root container:

```typescript
{classSelectionOpen && (
  <ClassSelectionScreen
    onBack={() => setClassSelectionOpen(false)}
    onPickClass={() => {
      setClassSelectionOpen(false);
      // TODO Story 2.3 — send class:selected message to sim server
    }}
  />
)}
```

---

#### ClassSelectionScreen component

Add this as a top-level function in `ControllerScreen.tsx` (NOT inside `ControllerScreen` — it
would cause remounts on every parent re-render):

```typescript
interface ClassSelectionScreenProps {
  onBack: () => void;
  onPickClass: (classId: PlayerClass) => void;
}

function ClassSelectionScreen({ onBack, onPickClass }: ClassSelectionScreenProps) {
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const panelOpen = selectedClass !== null;
  const selectedDef = selectedClass !== null ? CLASS_DEFINITIONS[selectedClass] : null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--bg-base)',
        zIndex: 50,
        touchAction: 'auto',    // override parent's touchAction: none to allow scroll
        userSelect: 'none',
      }}
    >
      {/* ── Top bar ── */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 32,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          zIndex: 10,
        }}
      >
        <button
          onPointerDown={e => { e.preventDefault(); onBack(); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0 8px',
            minWidth: 44,
            minHeight: 44,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ← Back
        </button>
        <span
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          Choose Your Class
        </span>
      </div>

      {/* ── Card scroll area ── */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          left: 0,
          right: 0,
          bottom: panelOpen ? 130 : 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: '12px 24px',
          gap: 14,
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          touchAction: 'pan-x',
        }}
      >
        {(Object.values(CLASS_DEFINITIONS) as ClassDef[]).map(def => (
          <ClassCard
            key={def.id}
            def={def}
            isSelected={selectedClass === def.id}
            onTap={() => setSelectedClass(def.id)}
          />
        ))}
        {/* Trailing spacer so last card is not flush with right edge */}
        <div style={{ minWidth: 24, flexShrink: 0 }} />
      </div>

      {/* ── Right-edge fade ── */}
      <div
        style={{
          position: 'absolute',
          top: 32,
          right: 0,
          bottom: panelOpen ? 130 : 0,
          width: 80,
          background: 'linear-gradient(to right, transparent 0%, var(--bg-base) 100%)',
          pointerEvents: 'none',
          zIndex: 5,
        }}
      />

      {/* ── Ability panel ── */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 130,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 200ms ease-out',
          display: 'flex',
          zIndex: 10,
        }}
      >
        {selectedDef !== null && (
          <>
            {/* Left ~80%: ability chips + role hint */}
            <div
              style={{
                flex: '0 0 80%',
                padding: '12px 14px 10px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                  flex: 1,
                }}
              >
                {selectedDef.abilities.map((ab, i) => (
                  <AbilityChip key={i} ability={ab} />
                ))}
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  paddingTop: 2,
                }}
              >
                {selectedDef.role}
              </p>
            </div>

            {/* Right ~20%: pick button */}
            <div
              style={{
                flex: '0 0 20%',
                borderLeft: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 10px',
                gap: 6,
              }}
            >
              <button
                onPointerDown={e => { e.preventDefault(); onPickClass(selectedDef.id); }}
                style={{
                  width: '100%',
                  minHeight: 48,
                  background: 'var(--interactive)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 11,
                    color: 'var(--bg-base)',
                    letterSpacing: '0.02em',
                    textAlign: 'center',
                    lineHeight: 1.3,
                  }}
                >
                  Pick Selected Class
                </span>
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
```

**`touchAction: 'auto'` on the overlay** — critical. The root `ControllerScreen` div has
`touchAction: 'none'` which blocks all scroll. The `ClassSelectionScreen` overlay must set
`touchAction: 'auto'` to unblock the CSS layer, then `touchAction: 'pan-x'` on the card area
to allow horizontal scroll while preventing vertical scroll / browser pull-to-refresh.

**`bottom: panelOpen ? 130 : 0`** on the card area — when the ability panel slides up, the
card area shrinks from the bottom so cards don't go beneath the panel. The panel height (130px)
matches the wireframe `f3-ability-panel` exactly.

**`WebkitOverflowScrolling: 'touch'`** — enables iOS momentum scrolling in the card area.

**`scrollSnapType: 'x mandatory'`** on the card area + **`scrollSnapAlign: 'center'`** on each
`ClassCard` — enables snap-to-card behavior. Optional but improves perceived quality. See
§ClassCard below.

**Do NOT add `display: none` or `visibility: hidden`** to `ClassSelectionScreen` when not
open — instead, only render it when `classSelectionOpen` is true (conditional render in
ControllerScreen). This avoids the overhead of keeping it in the DOM when idle and prevents
the scroll position from persisting between openings.

---

#### ClassCard component

```typescript
interface ClassCardProps {
  def: ClassDef;
  isSelected: boolean;
  onTap: () => void;
}

function ClassCard({ def, isSelected, onTap }: ClassCardProps) {
  return (
    <div
      onPointerDown={e => { e.preventDefault(); onTap(); }}
      style={{
        width: 190,
        minWidth: 190,
        height: 190,
        background: isSelected ? 'var(--bg-subtle)' : 'var(--bg-surface)',
        border: isSelected ? '2px solid var(--accent-spirit)' : '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: isSelected ? '0 0 12px rgba(110,168,216,0.25)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 0 12px 0',
        flexShrink: 0,
        overflow: 'hidden',
        touchAction: 'manipulation',
        cursor: 'pointer',
        scrollSnapAlign: 'center',
      }}
    >
      {/* Icon area */}
      <div
        style={{
          width: '100%',
          height: 66,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid var(--border)',
          marginBottom: 10,
          background: isSelected ? 'var(--bg-subtle)' : 'transparent',
          flexShrink: 0,
        }}
      >
        <ClassIcon classId={def.id} isSelected={isSelected} />
      </div>

      {/* Class name — Uncial Antiqua md (20px) */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-md)',
          color: 'var(--text-primary)',
          textAlign: 'center',
          marginBottom: 4,
          padding: '0 8px',
        }}
      >
        {def.displayName}
      </span>

      {/* Role label — Lora 700 sm text-secondary */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: 8,
          padding: '0 8px',
        }}
      >
        {def.role}
      </span>

      {/* Flavor — Lora 400 italic sm text-secondary */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontStyle: 'italic',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.5,
          padding: '0 12px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {def.flavor}
      </span>
    </div>
  );
}
```

**`scrollSnapAlign: 'center'`** pairs with the container's `scrollSnapType: 'x mandatory'`
to snap each card to the center of the scroll viewport on swipe.

**`WebkitLineClamp: 3`** truncates long flavor text to 3 lines. This is necessary because some
flavor lines may be longer than the card height allows.

---

#### ClassIcon component

Simple SVG placeholder icons — one per class. These match the art direction (outlined strokes,
no fill) shown in the wireframe. Colors: `isSelected` → `accent-spirit` stroke; default →
`border` stroke.

```typescript
interface ClassIconProps {
  classId: PlayerClass;
  isSelected: boolean;
}

function ClassIcon({ classId, isSelected }: ClassIconProps) {
  const stroke = isSelected ? 'var(--accent-spirit)' : 'var(--border)';

  switch (classId) {
    case PlayerClass.STONEHIDE:
      return (
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
          <polygon points="24,6 44,40 4,40" stroke={stroke} strokeWidth="2" strokeLinejoin="round"/>
          <polygon points="24,14 36,36 12,36" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      );
    case PlayerClass.SPIRITCALLER:
      return (
        <svg width="44" height="44" viewBox="0 0 44 48" fill="none">
          <circle cx="22" cy="24" r="14" stroke={stroke} strokeWidth="1.5" strokeDasharray="4 3"/>
          <circle cx="22" cy="24" r="5" stroke={stroke} strokeWidth="1.5"/>
          <line x1="22" y1="6" x2="22" y2="18" stroke={stroke} strokeWidth="1" strokeLinecap="round"/>
          <line x1="22" y1="30" x2="22" y2="42" stroke={stroke} strokeWidth="1" strokeLinecap="round"/>
        </svg>
      );
    case PlayerClass.SOULDRINKER:
      return (
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M22 4 C10 4 4 14 4 22 C4 32 22 44 22 44 C22 44 40 32 40 22 C40 14 34 4 22 4 Z"
            stroke={stroke} strokeWidth="1.8" strokeLinejoin="round"/>
          <circle cx="22" cy="20" r="5" stroke={stroke} strokeWidth="1.2"/>
        </svg>
      );
    case PlayerClass.STORMCALLER:
      return (
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M22 4 L28 18 L42 18 L30 28 L34 42 L22 34 L10 42 L14 28 L2 18 L16 18 Z"
            stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      );
  }
}
```

**These are placeholder icons** — final artwork ships in the polish phase. The shapes match
the wireframe illustrations: mountain/triangle for Stonehide, dashed orb for Spiritcaller,
teardrop/flame for Souldrinker, lightning star for Stormcaller.

---

#### AbilityChip component

```typescript
interface AbilityChipProps {
  ability: ClassAbilityDef;
}

const ABILITY_BADGE_BORDER: Record<AbilityInputType, string> = {
  AUTO:    'var(--accent-spirit)',
  RELEASE: 'var(--accent-warm)',
  TAP:     'var(--border)',
};

function AbilityChip({ ability }: AbilityChipProps) {
  return (
    <div
      style={{
        background: 'var(--bg-subtle)',
        borderRadius: 4,
        padding: '6px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        borderLeft: `3px solid ${ABILITY_BADGE_BORDER[ability.inputType]}`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {ability.name}
      </span>
      <span
        style={{
          display: 'inline-block',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          background: 'var(--border)',
          borderRadius: 4,
          padding: '1px 5px',
          alignSelf: 'flex-start',
          whiteSpace: 'nowrap',
        }}
      >
        {ability.inputType}
      </span>
    </div>
  );
}
```

**`borderLeft: 3px solid ...`** is the per-input-type visual accent from the UX DESIGN.md
ability-chip spec. This is the per-type color differentiation that makes input types scannable.

---

#### Imports to add at top of ControllerScreen.tsx

Add these imports alongside the existing ones:

```typescript
import type { ClassDef } from 'shared-types';
import { CLASS_DEFINITIONS, PlayerClass } from 'shared-types';
import type { AbilityInputType } from 'shared-types';
```

The existing import `import type { GameState } from 'shared-types'` stays — just add these
alongside it (combine into one import from 'shared-types' if preferred, but separate is fine
with TypeScript's `import type`).

---

#### Overlay placement in ControllerScreen return

```tsx
return (
  <div
    style={{
      position: 'relative',
      height: '100%',
      display: 'flex',
      background: 'var(--bg-base)',
      touchAction: 'none',
      userSelect: 'none',
    }}
  >
    <InteractButton
      visible={activePoi !== null}
      onTap={() => {
        if (activePoi === 'class-select') setClassSelectionOpen(true);
        // training-dummy and dungeon-entrance handled in future stories
      }}
    />
    {/* Left zone — floating joystick */}
    ...
    {/* Right zone — 2×2 skill grid */}
    ...
    {/* Class selection overlay */}
    {classSelectionOpen && (
      <ClassSelectionScreen
        onBack={() => setClassSelectionOpen(false)}
        onPickClass={(_classId) => {
          setClassSelectionOpen(false);
          // TODO Story 2.3 — send class:selected message to sim server and persist class
        }}
      />
    )}
  </div>
);
```

**Why conditional render (not always-present hidden):** The class selection screen has
horizontal scroll state. If it were always mounted, the scroll position would persist between
openings. Unmounting on close resets the state cleanly for the next open. The performance cost
of mounting/unmounting is negligible (no PixiJS, no WebSocket, just DOM).

---

### CSS Design Tokens Used in this Story

All style values use CSS custom properties — no raw hex values in JSX inline styles (except
when referencing CSS variables in `rgba(...)` for box-shadows where the variable can't be
used directly, e.g., `rgba(110,168,216,0.25)` for the spirit glow on selected cards).

| Token | Value | Usage |
|---|---|---|
| `--bg-base` | #0f0e10 | Screen background, right-edge fade target |
| `--bg-surface` | #181620 | Card default, top bar, ability panel |
| `--bg-subtle` | #22202e | Selected card, ability chip, icon area tint |
| `--border` | #36334a | Default card border, panel dividers, TAP badge border |
| `--text-primary` | #d8d0e8 | Class names, ability chip names |
| `--text-secondary` | #a89ec0 | Role labels, flavor text, back button |
| `--accent-spirit` | #6ea8d8 | Selected card border, AUTO badge border |
| `--accent-warm` | #c07d35 | RELEASE badge border |
| `--interactive` | #6ea8d8 | Pick Selected Class button fill |
| `--font-display` | Uncial Antiqua | Class names, screen title |
| `--font-body` | Lora | Everything else |
| `--text-md` | 20px | Class name in card |
| `--text-sm` | 14px | Role, flavor, ability names |
| `--text-xs` | 11px | Badge text |

**UX-DR11 (Spirit Chant glow rule):** The spirit glow (`box-shadow: 0 0 12px
rgba(110,168,216,0.25)`) on selected class cards is CORRECT per the spec — "selected class
card border + tint" is an explicitly listed spirit-active state. The Pick button uses
`var(--interactive)` (not a glow) — correct, interactive elements use the `interactive` token.

---

### Previous Story Learnings (Story 2.1)

**TouchAction override pattern:** Story 2.1 established `touchAction: 'manipulation'` on
the InteractButton. For ClassSelectionScreen, the pattern extends: the overlay sets
`touchAction: 'auto'` (to unblock the parent's `none`), and the card area uses
`touchAction: 'pan-x'` (horizontal scroll, no vertical, no zoom). Use
`e.preventDefault()` on `onPointerDown` to prevent double-firing on mobile.

**No game-rules imports:** ControllerScreen must not import from `packages/game-rules`.
`CLASS_DEFINITIONS` in `shared-types` is correct (zero runtime logic, just constants).

**CSS design tokens in JSX:** All spacing/color values in inline styles use `var(--token)`.
Exception: PixiJS `Graphics` uses hex integer literals directly — but this story has no
PixiJS, so exception does not apply.

**`satisfies` pattern in net-protocol:** Not needed in this story (no new delta types).

---

### Project Structure Notes

- `packages/shared-types/src/class-definitions.ts` is a **NEW file** — no existing file to read first
- `packages/shared-types/src/index.ts` — read before editing; append `export * from './class-definitions.js'` at the end of the existing 9 lines
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — existing working file; read it fully before editing; the `InteractButton`'s `onTap` at line 192 is the specific change entry point
- No changes needed to `apps/simulation-server/**`, `apps/host-client/**`, or `packages/net-protocol/**`
- No new test files — typecheck is the only required verification

### Project Context Rules

All rules from `_bmad-output/project-context.md` apply. Key rules for this story:

- **No game-rules imports in mobile controller.** `CLASS_DEFINITIONS` must live in `shared-types`, not `game-rules`. `shared-types` is zero-logic constants — correct placement.
- **Authority model.** The mobile controller sends input events only. Class selection browsing is local UI state. No `GameState` mutation in the mobile app.
- **TypeScript strict mode.** No `any` without suppression comment. `CLASS_DEFINITIONS` is typed as `Record<PlayerClass, ClassDef>` — fully typed, no index signatures.
- **CSS design tokens only.** No raw hex values in inline JSX styles (exception: `rgba()` box-shadow values where CSS variable interpolation is unavailable).
- **8px grid.** All padding/gap/margin must be multiples of 8px (or 4px half-unit for fine internal padding). Card gap: 14px — close to 16 (2×8), acceptable per the wireframe. Panel padding: 12px (= 8+4 half-unit), 16px (2×8) — both correct.
- **Touch targets ≥44×44px.** Back button: `minWidth: 44, minHeight: 44` ✓. Pick button: `width: 100%, minHeight: 48` ✓. Class cards: `width: 190, height: 190` ✓.
- **npm only.** `npm run typecheck` from repo root. Do not use pnpm.
- **Context7 MCP for React/web docs.** `npx -y @upstash/context7-mcp` if you need to look up CSS scroll snap, React hooks, or inline style TypeScript types.
- **No Colyseus @Schema.** Not applicable to this story — no Colyseus changes.
- **No Math.random() in game logic.** Not applicable — no simulation code.
- **Serialization wrappers.** Not applicable — no wire messages in this story.

---

### References

- Epic 2 Story 2.2 acceptance criteria: `_bmad-output/planning-artifacts/epics.md` lines 477–502
- UX class-card component spec: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` lines 458–477
- UX ability-chip component spec: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` lines 479–503
- UX class selection experience flow: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` lines 145–158
- UX Flow 3 (Dani selects Souldrinker): `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/EXPERIENCE.md` lines 695–708
- UX Spirit Chant glow rule: `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/DESIGN.md` (UX-DR11)
- GDD class roster (4 alpha classes): `_bmad-output/planning-artifacts/gdds/gdd-party-delve-2026-06-13/gdd.md` lines 231–244
- Wireframe (class selection v4): `_bmad-output/planning-artifacts/ux-designs/ux-party-delve-2026-06-16/mockups/class-selection-wireframe-4.html`
- Current ControllerScreen: `apps/mobile-controller/src/screens/ControllerScreen.tsx`
- Current PlayerClass enum: `packages/shared-types/src/player.ts`
- Current shared-types index: `packages/shared-types/src/index.ts`
- Project context rules: `_bmad-output/project-context.md`
- Authority model: `CLAUDE.md` §Working Model

---

## Dev Agent Record

### Agent Model Used

claude-sonnet-4-6

### Debug Log References

_No blockers encountered. Typecheck passed clean on first run._

### Completion Notes List

**Task 1 — shared-types/class-definitions.ts:**
Created new file with `AbilityInputType` union type, `ClassAbilityDef` and `ClassDef` interfaces, and `CLASS_DEFINITIONS` constant typed as `Record<PlayerClass, ClassDef>`. The `abilities` tuple type enforces exactly 4 entries at compile time (FR12). Appended `export * from './class-definitions.js'` to shared-types index. This is an additive-only change — no existing types modified.

**Task 2 — ControllerScreen.tsx:**
- Added `classSelectionOpen: boolean` state to `ControllerScreen`. Wired `InteractButton.onTap` to `setClassSelectionOpen(true)` when `activePoi === 'class-select'`.
- Added four top-level components (outside `ControllerScreen` to avoid remount on parent re-render): `ClassIcon`, `ClassCard`, `AbilityChip`, `ClassSelectionScreen`.
- `ClassSelectionScreen` conditionally rendered at the end of the root container JSX — unmounts on close to reset horizontal scroll position.
- `touchAction: 'auto'` on overlay root overrides parent's `none` to enable scrolling; card area uses `touchAction: 'pan-x'` for horizontal-only scroll.
- All colors/spacing via CSS design tokens; only exception is `rgba(110,168,216,0.25)` for the spirit-glow box-shadow (CSS variable cannot be used in rgba() directly).
- "Pick Selected Class" button closes overlay locally; no server message (Story 2.3 wires this).
- CONTRACT CHANGE HOOK: shared-types was modified (additive new type file). No new wire messages — no contract test required per story spec. Protocol Architect review required.

**Confidence: 97%** — Implementation follows story spec exactly. All ACs covered. Typecheck clean. Minor confidence deduction: cannot visually verify the overlay renders correctly without running the app; the panel `bottom: panelOpen ? 130 : 0` compression logic relies on matching the wireframe height.

### File List

- `packages/shared-types/src/class-definitions.ts` — NEW
- `packages/shared-types/src/index.ts` — MODIFIED (added export)
- `apps/mobile-controller/src/screens/ControllerScreen.tsx` — MODIFIED
- `_bmad-output/implementation-artifacts/sprint-status.yaml` — MODIFIED (status: in-progress → review)
- `_bmad-output/implementation-artifacts/2-2-class-selection-flow-card-browse-and-selection.md` — MODIFIED (this file)

### Change Log

- 2026-06-24: Implemented story 2.2 — added CLASS_DEFINITIONS to shared-types and full ClassSelectionScreen overlay to mobile controller. Typecheck clean. Status → review.
