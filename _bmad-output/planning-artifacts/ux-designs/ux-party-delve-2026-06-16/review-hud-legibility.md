# HUD Legibility Review — Party Delve

## Overall verdict

The design is strong at the emotional layer but has a cluster of couch-distance legibility gaps that will hurt real sessions. The top strip is too small for 8 players; the revive timer — the most critical ephemeral element — is undersized and colour-coded wrong; and the post-run summary player cards are comfortably unreadable from the sofa. These are fixable without touching the visual identity. Seven findings below, three of which are blocking for a 3-metre viewing distance.

---

## Findings

### critical — Revive timer is too small and uses the wrong urgency colour

**What the problem is.** The wireframe (`host-hud-wireframe-1.html`) renders the revive timer at `font-size: 15px` for both the player name and the countdown value. EXPERIENCE.md (Flow 5) asserts that the countdown should be "Lora 700, `xl` size" (40px per the scale), and DESIGN.md confirms the `revive-timer` anatomy as "Timer value: Lora 700, `xl` size (40px)." The wireframe directly contradicts the spec: `#revive-time` is 15px, `#revive-player-name` is 15px. At 15px on a 1920×1080 canvas viewed from 3 metres, both strings will be invisible to most of the room.

Beyond size, the wireframe uses `accent-corruption` (`#7d2dff`, purple) as the border and countdown colour. The spec explicitly assigns the `critical` state to `corruption-blood` (`#c0392b`, red). Purple at low opacity against a dark dungeon canvas does not read as an emergency signal from the sofa. Red does. The amber halo that is supposed to escalate as the timer runs down is absent from the wireframe entirely.

**What it affects.** The revive timer is the highest-urgency piece of host-screen information in the game. A 5-player group that cannot clearly see "Dani — 20s" counting down will miss the coordination window and the mechanic will feel broken. This failure affects every session once a player goes down.

**Suggested fix.** Implement the timer value at `xl` (40px) and the player name at `md` (20px) minimum, matching the spec. Switch the border and text colour to `accent-warm` in the `urgent` state and `corruption-blood` in the `critical` (≤10s) state. Add the amber box-shadow halo that intensifies toward zero. Consider a minimum container width of 280px so the element is spatially prominent even before the countdown reaches its loudest state.

---

### critical — Player chip name and health pips are too small for 8-chip layouts

**What the problem is.** The wireframe renders `.chip-name` at `font-size: 13px`. DESIGN.md specifies player names at "Lora 700, `base` size" which is 16px. At 13px on a 1920px-wide strip, player names are below the 16px floor for secondary information and well below the 24px minimum for combat-critical labels. Five chips are shown in the wireframe with comfortable spacing; at 8 chips the per-chip width drops to approximately 200px, and the current padding plus the 5-pip health row will force further name truncation, possibly to 4–5 characters.

The health pips in the strip are `9×9px` squares. At 3 metres from a 1080p screen a 9px element subtends roughly 0.17 arcminutes — below the threshold for distinguishing filled from empty pips without leaning in. The in-canvas character tag name (`char-tag-name`) is also 13px, compounding the issue.

**What it affects.** The top strip is the only persistent status read for the whole group during combat. If a player in the back row cannot tell who is alive and at what health without standing up, the co-op health-awareness loop fails.

**Suggested fix.** Raise chip name to `base` (16px) as specified. Consider reducing the class-indicator label (currently absent in the wireframe but specified at `sm`/13px) to a single icon rather than text to reclaim horizontal space. Scale health pips to 12×12px minimum (the wireframe in-canvas pips are 7×7px — also underpowered). For the 8-player maximum, evaluate a two-row strip or a condensed glyph health indicator (a single coloured arc or segmented bar) rather than 5 discrete pips per chip.

---

### critical — Post-run summary player card text is illegible at couch distance

**What the problem is.** The post-run summary wireframe (`post-run-summary-wireframe-1.html`) renders inside a 960×540px frame — half of the 1920×1080 target — and player card text is already small at that scale. Working from the actual pixel values: `.player-name` is `font-size: 13px`, `.player-class` is `11px`, `.stat-label` and `.stat-value` are `11px`. On a full 1920×1080 output these values would be doubled (the wireframe is half-scale), yielding approximately 26px name and 22px class/stat.

However, the wireframe is a static design artifact. If it is used as-is for implementation reference without the scaling note, developers will render these at face-value pixel sizes. At 13px/11px literal on a 1080p TV at 3 metres, all post-run card text is unreadable. Even at the implied doubled size, 22px for class name and downed count is marginal for the back of the room.

Separately, the bottom note ("Tap 'Return to Camp' on your phone to return to the hub") is `font-size: 10px` in the wireframe — equivalent to 20px at 1:1 on 1920×1080. This instruction is the only host-screen prompt telling players what to do next; it must be legible.

**What it affects.** The post-run summary is the moment the room processes the run together. Names and down counts at illegible sizes make the wrap-up feel anticlimactic and information-poor.

**Suggested fix.** Specify player card sizes explicitly for the 1920×1080 host canvas. Player name: Lora 700, `md` (20px) minimum, `lg` (28px) preferred. Class name: Lora 400, `base` (16px). Downed count: Lora 700, `base` (16px) so the number reads clearly. The bottom note should be `sm` (13px) minimum at full resolution — raise it from the current 10px spec and consider whether it belongs on the host screen at all (if the phone controls the transition, the phone can carry this instruction). The wireframe frame should be annotated clearly with "960×540 at 0.5× scale — all px values render at 2× on 1920×1080 host" to prevent implementation confusion.

---

### high — Corner labels are undersized and the text-shadow is insufficient over busy canvas areas

**What the problem is.** The wireframe renders both `#level-label` and `#objective-label` at `font-size: 14px`, Lora 400 (not 700), in `#a89ec0` (text-secondary). DESIGN.md specifies these as "Lora 700 at `sm` size" — `sm` is 13px, so size is close but weight is wrong (the wireframe uses Lora 400, not 700). More critically, `text-secondary` (#a89ec0) against a dark but complex isometric dungeon background does not meet the 4.5:1 contrast target for critical UI stated in EXPERIENCE.md Section 7. The text-shadow specified is `0 1px 6px rgba(0,0,0,0.9), 0 0 12px rgba(0,0,0,0.7)` — effective over solid dark areas but not over mid-tone tile edges, particle effects, or bright corruption glow regions.

The labels sit 64px below the top strip, floating directly over the canvas with no panel or scrim. When the boss fight is active with three tethers glowing and environment corruption at maximum, these labels will frequently fall over visually complex areas.

**What it affects.** The level/biome label is ambient orientation info, but the objective label ("CLEAR · 4 enemies remain") is active gameplay guidance. Losing it in visual noise during the hardest content is the worst possible time to lose it.

**Suggested fix.** Keep the no-panel philosophy but strengthen the legibility: use `text-primary` (#d8d0e8) instead of `text-secondary`; confirm Lora 700 weight; extend the text-shadow to at least two layers of blur (`0 1px 4px rgba(0,0,0,1), 0 0 16px rgba(0,0,0,0.9), 0 0 32px rgba(0,0,0,0.6)`). If that remains insufficient after playtesting, a 2px-high gradient scrim immediately below the top strip (from `rgba(15,14,16,0.6)` to transparent over ~40px) will protect both labels without adding chrome.

---

### high — Bond overlay text font size is unspecified; current references are too small for a shared-room reveal

**What the problem is.** EXPERIENCE.md and DESIGN.md both specify the bond overlay text as "Uncial Antiqua `lg`" — which is 28px. Flow 4 describes this as the moment the room reads together: *"Cyby · Dani — Fate Bond"* centered over the host canvas. At 28px on a 1920×1080 screen viewed from 3 metres, this string is approximately 2.8cm tall on a 40-inch TV — readable but not commanding. For a moment that is described as a narrative beat the whole room shares, 28px is subdued.

The `bond-assignment-wireframe-1.html` is a phone wireframe, not a host-canvas wireframe, so no rendered pixel reference exists for the host overlay text. This is itself a gap: the host bond overlay has no wireframe, making the 28px spec the only reference, and that reference is below what the moment warrants.

**What it affects.** The bond moment is the emotional centrepiece of the inter-level design. If the text is too small to read from the sofa, the shared recognition ("oh, Cyby and Dani are bonded!") that creates the social moment does not happen.

**Suggested fix.** Raise the bond overlay text to `xl` (40px) minimum. At 40px, Uncial Antiqua on a dark canvas with the specified `accent-spirit` glow reads clearly at 3 metres and sits appropriately weighted as a narrative reveal. Consider `xxl` (56px) for the bond pair names and `lg` (28px) for the bond type label as a secondary line. Add a host-canvas wireframe for this overlay state — it is missing from the `.working` directory.

---

### medium — Spirit-form chip state uses opacity 0.42 — too dim to distinguish from disconnected

**What the problem is.** The wireframe applies `opacity: 0.42` to the entire Dani chip in spirit-form state (`.chip-dani` rule). At 42% opacity against a `#181620` strip background, the chip is visually very close to invisible. EXPERIENCE.md specifies the spirit-form chip as: "name dims to `text-secondary`, health pips emptied, a spirit-blue glow (`accent-spirit`, low opacity) surrounds the chip." The dimming is intentional, but the spec does not say "opacity 0.42 on the whole chip" — it says dim the name text specifically, not the container.

The problem is discrimination: a disconnected or loading player slot would likely also render at reduced opacity. Players across the room need to distinguish between "Dani is in spirit form (still in the run)" and "Dani dropped from the session." With the whole chip at 42% opacity, that distinction is unclear.

**What it affects.** Miscommunication during the Vigil state — the highest-drama moment in the game when the outcome is uncertain. If the room cannot tell whether a missing chip means "in spirit form" or "disconnected," the strategic clarity of the Vigil breaks.

**Suggested fix.** Dim only the name text to `text-secondary` and empty the pips, as the spec says. Keep the chip container at full opacity but style it distinctly: corruption-purple border (as in the wireframe, but at full opacity), the ghost icon at full opacity and a brighter glow, and an explicit `accent-spirit` rim glow on the chip container. Reserve opacity fade for disconnected/inactive states to preserve the semantic distinction.

---

### medium — In-canvas floating name tags and health pips: no minimum size specified; overlap risk at 8 players

**What the problem is.** The wireframe shows `char-tag` elements at `font-size: 13px` for names and 7×7px pips. With 5 players in the wireframe these elements have comfortable separation. With 8 players in a single dungeon level, depending on encounter design, character positions can compress considerably — especially during corridor fights or boss arenas where the group clusters. No minimum separation distance or overlap-handling rule is specified in either spine document.

At 13px in-canvas name tags and 7px pips at 3 metres on a 1080p TV, these elements are marginal even without overlap. With 6–8 players in close proximity, stacked name tags will be illegible.

**What it affects.** Players need to be able to identify characters by name at a glance during combat — especially to coordinate revives ("Rexx is down, can anyone reach them?"). If name tags stack and occlude each other, this coordination fails.

**Suggested fix.** Set a minimum rendered size of 16px for in-canvas name text. Define an overlap-handling rule: when two characters are within N canvas units, apply a vertical offset cascade to their name tag elements (stagger them above each other rather than overlap). Specify pip minimum at 10×10px. Both constraints should be added to EXPERIENCE.md Section 8 or to a forthcoming in-canvas rendering spec.

---

*Review by: UX Legibility Review agent — couch-distance specialist*
*Artifacts reviewed: EXPERIENCE.md, DESIGN.md, host-hud-wireframe-1.html, post-run-summary-wireframe-1.html, bond-assignment-wireframe-1.html*
*Date: 2026-06-18*
