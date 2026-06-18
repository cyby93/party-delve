# Spine Review — Party Delve

## Overall verdict

The spine pair is well-formed and largely coherent. Visual and behavioral specs are consistent in naming, and the key flows are concrete and narrative-rich. The primary gaps are: three components have visual specs in DESIGN.md but no behavioral spec in EXPERIENCE.md (`session-code-field`, `join-button`, `ability-chip`); zero of the 16 `.working/` wireframes are linked from either spine; and several surfaces lack error/disconnected state coverage. Nothing is structurally broken — these are gaps addressable before engineering handoff.

---

## 1. Flow coverage — adequate

**Screens in the IA and their flow coverage:**

| Screen | Has named protagonist | Numbered steps | Climax beat | Failure path |
|---|---|---|---|---|
| **Main Menu (host)** | Partial — appears as step 1 in Flow 2, not its own flow | Via Flow 2 step 1 | Via Flow 2 | None |
| **Lobby (host)** | Yes — Flow 2 (Cyby) | Yes | Yes | None |
| **Hub World (host)** | Yes — Flows 2, 3 | Yes | Yes | None |
| **Dungeon Run / HUD (host)** | Yes — Flows 5, 6 | Yes | Yes | Partial (timer expiry only) |
| **Spirit Bond Assignment (host overlay)** | Yes — Flow 4 | Yes | Yes | None |
| **Post-Run Summary (host)** | Yes — Flow 6 | Yes | Yes | None (failure tone described in Section 5 but no dedicated flow) |
| **Auth Choice (phone)** | Partial — appears in Flow 1 step 3 only, guest path | Via Flow 1 | Via Flow 1 | None |
| **Session Code Entry (phone)** | Yes — Flow 1 | Yes | Implicit | None |
| **Hub Controller (phone)** | Yes — Flows 1, 3 | Yes | Yes | None |
| **In-Run Controller (phone)** | Yes — Flow 5 | Yes | Yes | None |
| **Bond Assignment (phone)** | Yes — Flow 4 | Yes | Yes | None |
| **Post-Run (phone)** | Implicit — Flow 6 step 5 | Implicit | Via host climax | None |

**Findings:**

- **medium** — Main Menu has no dedicated flow. It appears as step 1 of Flow 2 in one sentence. A screen this simple doesn't need its own flow, but no climax beat and no failure path are defined for it at all. If the session fails to create (network error, server unavailable), the behavior is unspecified.
- **medium** — Auth Choice screen is only covered via the guest path in Flow 1. The Sign In and Sign Up paths are called out in the IA and decision log (D-011) as distinct paths but have no flow steps, no failure state (wrong password, OAuth failure), and no success landing.
- **low** — Post-Run phone screen is only implicitly covered — it appears at the tail of Flow 6 without numbered steps from the phone perspective.
- **low** — Run failure (wipe) is covered as a State Pattern (Section 5) but has no dedicated Key Flow. The failure-path steps for the Post-Run Summary — from the moment of wipe through the phone "Return to Camp" — are absent as a flow.

---

## 2. Token completeness — adequate

**Defined color tokens (14):**
`bg-base`, `bg-surface`, `bg-subtle`, `border`, `text-primary`, `text-secondary`, `accent-spirit`, `accent-warm`, `accent-corruption`, `accent-purify`, `interactive`, `interactive-hover`, `corruption-acid`, `corruption-blood`

**Tokens referenced in EXPERIENCE.md (10):**
`{colors.accent-purify}`, `{colors.accent-spirit}`, `{colors.accent-warm}`, `{colors.bg-base}`, `{colors.bg-subtle}`, `{colors.bg-surface}`, `{colors.border}`, `{colors.corruption-blood}`, `{colors.text-primary}`, `{colors.text-secondary}`

**Typography tokens referenced (1):**
`{typography.scale.xl}`

**Broken references:** None. Every `{colors.*}` reference in EXPERIENCE.md resolves to a defined token.

**Tokens defined but never referenced in EXPERIENCE.md:**
- `{colors.interactive}` — **medium** — This token governs all CTA buttons (`join-button`, "Pick Selected Class", "Return to Camp"). EXPERIENCE.md describes button behavior extensively but never uses the token. The behavioral spec says "tapping Continue" but doesn't reference `{colors.interactive}` for the interactive state, leaving the token unanchored in behavioral text.
- `{colors.interactive-hover}` — **low** — Same issue; hover/focus state is a visual concern primarily in DESIGN.md, but touch feedback on buttons is part of the behavioral spec and could reference this token.
- `{colors.accent-corruption}` — **low** — Only appears in DESIGN.md (corruption glow, VFX reference). EXPERIENCE.md covers the purification pulse and spirit forms but never references this token in a behavioral context. Acceptable given it is explicitly called out as an in-canvas VFX token, but noting the gap.
- `{colors.corruption-acid}` — **low** — Same as above; in-canvas only per DESIGN.md Section 2. No behavioral state requires it. Acceptable omission.

**Raw hex in EXPERIENCE.md:** Line 404 contains `#7a7490` and `#a89ec0` as bare hex values in prose (historical note explaining why `text-secondary` was bumped). These are in an explanatory aside, not a component spec, but technically violate the "no raw hex in EXPERIENCE.md" rule. — **low**

---

## 3. Component coverage — high (3 components visually specced only)

**10 components defined in DESIGN.md frontmatter.**
**DESIGN.md Section 7 visual specs:** All 10 present. ✓
**EXPERIENCE.md Section 4 behavioral specs:** 7 of 10 present.

| Component | DESIGN.md visual spec | EXPERIENCE.md behavioral spec |
|---|---|---|
| `player-chip` | ✓ | ✓ |
| `skill-cell` | ✓ | ✓ |
| `interact-button` | ✓ | ✓ |
| `bond-card` | ✓ | ✓ |
| `class-card` | ✓ | ✓ |
| `ability-chip` | ✓ | Missing |
| `post-run-card` | ✓ | ✓ |
| `revive-timer` | ✓ | ✓ |
| `session-code-field` | ✓ | Missing |
| `join-button` | ✓ | Missing |

**Findings:**

- **high** — `session-code-field` has no behavioral spec in EXPERIENCE.md Section 4. Its three states (empty, prefilled, error) are defined visually in DESIGN.md, and it appears in Flow 1, but no behavioral Section 4 entry covers: error trigger conditions, what error messages say, pre-fill behavior when URL params are absent vs. present, or what happens when the field is submitted empty.
- **high** — `join-button` has no behavioral spec in EXPERIENCE.md Section 4. Its loading and success states are defined visually, and it appears in Flow 1, but the behavioral spec is absent: what triggers the loading state, what constitutes success vs. failure, how the error is surfaced (to `session-code-field`? inline below the button?), and what the success navigation sequence is.
- **medium** — `ability-chip` has no behavioral spec in EXPERIENCE.md Section 4. It is referenced as appearing in the ability briefing panel (class card pattern), but no Section 4 entry describes its interaction behavior. It is a read-only display component, but its role in the briefing panel open/close cycle and its scan behavior should be captured.

---

## 4. State coverage — thin

**Host screens and their logical states:**

| Surface | Expected states | Covered |
|---|---|---|
| Main Menu | Idle, loading (session create in progress), error (server unreachable) | Idle only |
| Lobby | Empty (no players joined), filling (players joining real-time), ready (all joined), full, kicked-player flash | Filling + ready (implicitly via Flow 2); empty, error, full not covered |
| Hub World | Idle (free-roam), near-POI (per player), transitioning to dungeon | Near-POI covered (Sec 5); transitioning not explicitly covered |
| Dungeon Run (HUD) | Active combat, player downed, near-wipe vigil, level cleared, boss fight | All covered in Section 5 ✓ |
| Spirit Bond Assignment | Overlay visible, advancing | Covered ✓ |
| Post-Run Summary | Victory, failure, waiting-for-all-players | Victory + failure covered; waiting state (host persists until all return) covered ✓ |

**Phone screens and their logical states:**

| Surface | Expected states | Covered |
|---|---|---|
| Auth Choice | Idle, Sign In/Up tap loading, OAuth redirect in progress | Idle only (guest path) |
| Session Code Entry | Empty, prefilled, submitting (loading), error (wrong code, full lobby, server error), success | Submitting + success in Flow 1; error states missing in behavioral spec |
| Hub Controller | Active (no class), active (class selected), near-POI (interact visible), transitioning to class selection | Near-POI covered ✓; no-class state described implicitly |
| In-Run Controller | Active combat, ability cooldown, player downed (spirit form — phone state), bond moment (non-bonded) | Combat + cooldown + bond (non-bonded) covered ✓; **downed/spirit-form phone state explicitly flagged as undesigned (ASSUMPTION note)** |
| Bond Assignment | Bonded full-screen, non-bonded continue | Both covered ✓ |
| Post-Run | Return to Camp (waiting), all-returned (transitioning) | Button present in flows; transition covered ✓ |

**Findings:**

- **high** — Downed player's phone state is explicitly called out as an open ASSUMPTION in Section 5 ("Downed player's phone: [ASSUMPTION: what the downed player sees on their phone while in spirit form is not defined in this session]"). This is a primary gameplay state that needs a design decision before implementation.
- **high** — Spirit-form player's phone state in the Near-Wipe Vigil is similarly marked as undesigned ("[ASSUMPTION: spirit-form phone state not designed in this session]"). This is also a primary gameplay state.
- **medium** — Session Code Entry error states have no behavioral coverage in EXPERIENCE.md. Three distinct error conditions exist (wrong/expired code, lobby full, server error) and none are specified. The `session-code-field` has an `error` visual state defined, but what triggers it, what text it shows, and whether the join-button resets are unspecified.
- **medium** — Lobby screen state for the host has no loading, error, or full-lobby state defined in any section. Flow 2 covers the happy path only.
- **medium** — Auth Choice phone screen: Sign In and Sign Up paths are named in the IA but have no state coverage anywhere in either spine.
- **low** — Hub Controller with no class selected: skill cells show "4 empty or placeholder skill cells" (Flow 1, step 7) but no state specification covers what the right zone shows, whether skills can be triggered, or whether there is a nudge to select a class.
- **low** — Boss health bar placement is explicitly flagged as an ASSUMPTION ("boss health bar UI not defined in this session — common placement is top-center") in Section 5. This is a persistent host HUD element during the most critical screen in the game.

---

## 5. Visual reference coverage — broken

**16 wireframe/reference files in `.working/`:**

```
bond-assignment-wireframe-1.html
class-selection-wireframe-1.html through -4.html (4 files)
color-themes-1.html
controller-landscape-1.html
controller-layouts-1.html
direction-ember-stone.html
direction-primal-fractured.html
direction-raw-earth.html
direction-spirit-chant.html
host-hud-wireframe-1.html
join-flow-wireframe-1.html
post-run-summary-wireframe-1.html
typography-specimen-1.html
```

**Links in DESIGN.md:** 0
**Links in EXPERIENCE.md:** 0

**Findings:**

- **critical** — Zero wireframes linked from either spine. All 16 files are orphaned from the documentation. A reader of either document has no path to the wireframes, and a developer implementing from the spec cannot find the visual references without knowing to look in `.working/`.
  - `host-hud-wireframe-1.html` — directly relevant to DESIGN.md Section 7 (`player-chip`, `revive-timer`) and EXPERIENCE.md Section 8 (HUD & Diegetic UI). Not linked.
  - `join-flow-wireframe-1.html` — directly relevant to DESIGN.md Section 7 (`session-code-field`, `join-button`) and EXPERIENCE.md Flow 1. Not linked.
  - `controller-landscape-1.html`, `controller-layouts-1.html` — directly relevant to EXPERIENCE.md Section 9 (Input Schemes). Not linked.
  - `class-selection-wireframe-1.html` through `-4.html` — directly relevant to Flow 3 and `class-card` component specs. Not linked. Four iterations exist; the decision log doesn't indicate which is the resolved iteration.
  - `bond-assignment-wireframe-1.html` — directly relevant to Flow 4, Section 5 Bond Moment, `bond-card` spec. Not linked.
  - `post-run-summary-wireframe-1.html` — directly relevant to `post-run-card`, Flow 6, Section 5 Post-Run. Not linked.
  - `color-themes-1.html`, `typography-specimen-1.html` — directly relevant to DESIGN.md Sections 2–3. Not linked.
  - `direction-*.html` (4 files: ember-stone, primal-fractured, raw-earth, spirit-chant) — direction explorations. The decision log records D-004 and D-005 choosing the Spirit Ground / Raw Earth + Spirit Chant direction. The rejected directions could be noted in the decision log; the chosen direction reference should be linked from DESIGN.md Section 1.

---

## 6. Bloat — low

**Findings:**

- **low** — DESIGN.md Section 1 (Brand & Style) includes aesthetic narrative prose ("The world is earthy, inhabited, old. Nature and animal spirits are sacred, not ornamental. The setting is a frontier outpost on the border of a wounded world.") that describes the game world rather than making visual design decisions. The surrounding content does earn this context (the two-layer system and the Is/Is-Not lists are genuine design decisions), but the middle paragraph of "Aesthetic Identity" reads closer to GDD flavor text than design rationale.
- **low** — The Voice and Tone section (EXPERIENCE.md Section 3) includes example strings ("East road is deep today. Watch the treeline.", "You're back. Good. The campfire was getting restless.") as character voice examples. These are appropriate as reference — they are tied directly to the writing register decision — and are better served as a table (which they are). No action needed; flagging only because the Vendor and Territory Spirit examples in the table are pulled from GDD character descriptions verbatim, not generated as new design decisions.
- **low** — DESIGN.md Section 5 (Elevation & Depth) shadow language table includes a raw rgba value (`0 0 8px rgba(110,168,216,0.35)`) as a spec. This is reasonable in a design doc shadow table (it is a spec value, not a color reference), but it embeds the spirit-blue hex value (`110,168,216` = `#6ea8d8`) as a raw component in the CSS spec rather than deriving it from the `accent-spirit` token. A developer could implement the shadow with an incorrect value if `accent-spirit` changes. — **medium** — Flag for implementation: the shadow table values should reference the token, e.g. `0 0 8px color-mix(in srgb, var(--accent-spirit) 35%, transparent)` or equivalent.

---

## 7. Inheritance — high (one violation, one advisory)

**Component name consistency across both spines:** All 7 components specced in both documents use identical names. No drift. ✓

**Token reference syntax (`{path.to.token}`):** All references in EXPERIENCE.md use the `{colors.*}` and `{typography.*}` form. ✓

**Raw hex in EXPERIENCE.md:**
- **medium** — Line 404: `#7a7490` and `#a89ec0` appear as bare hex values in the Contrast Targets section. These are presented as an explanatory aside ("The session decision to bump `text-secondary` from `#7a7490` to `#a89ec0` was driven by this concern") but still constitute raw hex in the behavioral spine. Replace with token names: "the decision to bump `text-secondary` from its previous value was driven by this concern" — the actual hex lives in DESIGN.md.

**Shadow table in DESIGN.md Section 5:**
- **medium** — The spirit glow shadow values embed `rgba(110,168,216, ...)` as raw color components, not tokens. This creates maintenance drift risk. The shadow spec should reference the token by variable name in the implementation note.

**No other raw hex values found in EXPERIENCE.md.** ✓

---

## 8. Shape fit — strong

**DESIGN.md canonical section order check:**

| Expected | Actual | Match |
|---|---|---|
| 1. Brand & Style | 1. Brand & Style | ✓ |
| 2. Colors | 2. Colors | ✓ |
| 3. Typography | 3. Typography | ✓ |
| 4. Layout | 4. Layout & Spacing | ✓ |
| 5. Elevation | 5. Elevation & Depth | ✓ |
| 6. Shapes | 6. Shapes | ✓ |
| 7. Components | 7. Components | ✓ |
| 8. Do's and Don'ts | 8. Do's and Don'ts | ✓ |

All 8 canonical sections present and in order. ✓

**EXPERIENCE.md required sections check:**

| Required | Present | Notes |
|---|---|---|
| Foundation | ✓ (Sec 1) | |
| IA | ✓ (Sec 2) | |
| Voice and Tone | ✓ (Sec 3) | |
| Component Patterns | ✓ (Sec 4) | 3 components missing — see Section 3 |
| State Patterns | ✓ (Sec 5) | 2 states explicitly undesigned — see Section 4 |
| Interaction Primitives | ✓ (Sec 6) | |
| Accessibility Floor | ✓ (Sec 7) | |
| Key Flows | ✓ (Sec 12) | |
| HUD & Diegetic UI | ✓ (Sec 8) | Required game section ✓ |
| Input Schemes | ✓ (Sec 9) | Required game section ✓ |
| Game Feel & Juice | ✓ (Sec 10) | Required game section ✓ |
| Responsive & Platform | ✓ (Sec 11) | Required game section ✓ |

All required sections present. No order violations. ✓

**Findings:**

- **low** — DESIGN.md Section 2 (Colors) uses `### token-name — #hex` as sub-headers for each token. These function as per-token documentation sections, which is clear, but the `### ` heading level is also used for component sub-sections in Section 7. There is no structural conflict (sections are clearly delineated by `##`), but the reuse of `###` for both color token detail pages and component anatomies creates an inconsistency in the heading semantics of the document.

---

## Finding summary

| Severity | Count | Sections |
|---|---|---|
| **critical** | 1 | Sec 5 (zero wireframes linked) |
| **high** | 5 | Sec 3 (2×), Sec 4 (3×) |
| **medium** | 7 | Sec 1 (1×), Sec 2 (1×), Sec 3 (1×), Sec 4 (3×), Sec 6 (1×), Sec 7 (1×) |
| **low** | 9 | Sec 1 (2×), Sec 2 (4×), Sec 4 (2×), Sec 6 (2×), Sec 8 (1×) |
| **Total** | **22** | |

**Per-section verdicts:**

| Section | Verdict |
|---|---|
| 1. Flow coverage | adequate |
| 2. Token completeness | adequate |
| 3. Component coverage | high (3 missing behavioral specs) |
| 4. State coverage | thin |
| 5. Visual reference coverage | broken |
| 6. Bloat | low (minor) |
| 7. Inheritance | high (one raw hex, one shadow drift risk) |
| 8. Shape fit | strong |
