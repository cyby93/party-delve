# Mobile Touch Input Review — Party Delve

## Overall verdict

The controller layout is fundamentally sound: the 2×2 fixed grid provides learnable spatial muscle memory, skill cell sizes are far above the 44px minimum, and the floating joystick model removes thumb-finding friction. However, seven gaps in the spec and three implementation discrepancies between the wireframe and the written spines need resolution before build — the most critical being the absence of a cell-boundary escape rule for joystick skills, missing multi-touch requirements, no haptic/audio feedback spec for cooldown completion, and a cooldown overlay in the wireframe that contradicts the spec text.

---

## Findings

### [critical] — Floating joystick cell-boundary escape is unspecified

The spec states the skill-cell joystick ring is "constrained to the cell boundaries" (EXPERIENCE.md §6, Skill Cells). It does not specify what happens when the player's thumb drifts outside the cell during a Joystick-AutoFire or Joystick-Release hold. In practice this is common: a player holds S1 (top-left) and drags to aim down-left — the thumb will cross into S3 (bottom-left). Three possible behaviors exist and they produce radically different gameplay: (a) the ring clamps at the cell edge and direction locks to the last valid vector; (b) the touch is re-captured by S3 and S1 cancels; (c) the ring clips outside the cell visually but input continues relative to S1's origin. Behavior (b) would be a fatal input conflict during combat. The spec must define the escape rule, the clamp radius, and whether a cross-cell drag cancels or continues the active skill.

**Suggested fix:** Add an "Out-of-cell drag" rule to the skill-cell component pattern. Recommended behavior: ring clamps at the cell boundary; input direction is the clamped vector; the touch continues to belong to the originating cell until lift. Adjacent cell touches from a different finger remain independent.

---

### [critical] — Multi-touch requirements are absent

The spec does not state that the controller requires simultaneous multi-touch. A player routinely holds left-thumb on the movement joystick (left zone) while right-thumb holds a Joystick-AutoFire skill (right zone) — that is two concurrent touch points. On Joystick-Release skills, the player may additionally tap a TAP skill with a second right-hand finger while an AutoFire is active — three concurrent touch points. The spec mentions none of this. If the implementation listens to a single touch point per zone it will silently drop inputs during combined movement + skill use. iOS Safari and Android Chrome both support multi-touch, but it must be explicitly implemented with a multi-touch event model (tracking `event.touches` by identifier, not `event.targetTouches[0]`).

**Suggested fix:** Add a Multi-touch requirements section to EXPERIENCE.md §6 (Interaction Primitives) or §9 (Input Schemes). Specify: minimum 2 simultaneous touch points required (left zone + one skill); 3 recommended (movement + AutoFire + TAP); implementation must track each touch by `Touch.identifier`. Note that iOS Safari has a known issue with `touchmove` events being cancelled by `passive: false` listeners — this must be tested on device.

---

### [critical] — Cooldown overlay in wireframe contradicts spec text

EXPERIENCE.md §4 states: "a conic-gradient overlay covers the *majority of the cell*" and §10 reinforces "The conic-gradient cooldown overlay is large — it takes up most of the skill cell." DESIGN.md §7 (skill-cell) repeats "conic-gradient timer covering the majority of the cell face." The wireframe (`controller-landscape-1.html`) implements a 56px circular ring centered in the cell with a dark full-bleed overlay behind it — not a cell-covering conic. The 56px ring is approximately 29% of the cell height (estimated ~192px cell height) and looks like a traditional circular timer, not a cell-filling sweep. These are two completely different visual paradigms. The spec must pick one and the wireframe must match it. The cell-filling conic is the stronger eyes-off design (larger area = more glanceable), but the wireframe's ring approach may be more legible for the countdown number. If the spec text is correct, the wireframe must be rebuilt.

**Suggested fix:** Decide which model is authoritative and align both documents. If cell-filling conic: the wireframe needs a rebuild; document the transition percentage per second and the reveal direction (clockwise from top is convention). If ring: update spec text to match and validate the 14px countdown number is readable at arm's length.

---

### [high] — No dead-zone specification for skill-cell joystick

EXPERIENCE.md §6 specifies a dead-zone for the movement joystick ("Deadzone in center — character not moving below a small radius threshold"). No dead-zone is specified for the skill-cell joystick. For Joystick-Release skills specifically, a player touching the cell briefly and lifting without dragging (e.g., accidentally) will fire the ability in whatever direction the ring calculates — potentially 0,0 if the inner dot has not moved, causing undefined directional behavior. An explicit dead-zone prevents accidental firing and accidental directional locking.

**Suggested fix:** Add dead-zone specification to skill-cell joystick in EXPERIENCE.md §6. Recommended: 8–12px dead-zone radius around the spawn origin. Within that radius, Joystick-Release does not fire on lift; Joystick-AutoFire does not fire. This matches common mobile game controller practice.

---

### [high] — Orientation transition is underspecified

EXPERIENCE.md §11 describes the portrait-to-landscape transition as "the OS rotation handles it when the player tilts their phone" and notes a portrait-mode lock or rotation prompt is "not in scope for v1.0." The spec also notes a "soft nudge is recommended." But the transition trigger point is undefined: does landscape mode engage immediately on QR scan success, or only once the player reaches the Hub Controller screen? If it engages after class selection confirmation, the player rotates mid-flow — during which the class-card horizontal scroll and ability briefing panel (portrait) must not render sideways. The risk is a 3–5 second orientation limbo during a socially visible moment (first-time join with the whole party watching). The "soft nudge" is flagged but not designed.

**Suggested fix:** Define the exact trigger point for landscape enforcement. Recommended: lock to portrait during Auth Choice and Session Code Entry; allow OS rotation once the player is on the Hub Controller screen; add a brief soft-nudge banner ("Rotate for best experience") that auto-dismisses after 3s. Specify the nudge component name and dismiss behavior.

---

### [high] — Reconnect state is flagged but undesigned

EXPERIENCE.md has no reconnect state defined. The memory notes this is a Mobile Controller Engineer concern. The bond-card full-screen takeover (§4) blocks all controller input for bonded players — if a player loses connection and reconnects during a bond moment, the spec gives no guidance on what state they re-enter. Similarly, the interact-button's disappear trigger ("character moves out of interaction range — no linger") could leave a reconnecting player without a button if their character was mid-POI-interaction when the connection dropped.

**Suggested fix:** Add a Reconnect state to EXPERIENCE.md §5 (State Patterns). Minimum needed: what the phone shows during reconnection (spinner? last known controller state?); which server event triggers controller re-activation; whether bond-card state is replayed or skipped on reconnect; whether a reconnected player can re-join mid-POI interaction.

---

### [high] — Interact-button height at 44px is marginal for a slide-in target

DESIGN.md §7 and EXPERIENCE.md §7 both confirm the minimum interact-button height is 44px. The button slides in from the top edge while the player is holding the phone in landscape with thumbs on the left and right zones. To tap the interact-button the player must lift a thumb and reach upward — across a phone that is ~844px wide in landscape. The top-center position means the button is at maximum reach distance from both thumb zones. At exactly 44px tall, the tap success rate in a thumb-reach gesture from landscape grip (thumb arc limited by grip) will be below comfortable. This is not about the spec minimum being wrong — it is about the tap being structurally harder than the spec assumes.

**Suggested fix:** Increase interact-button minimum height to 52px (matching the join-button spec) and explicitly note in the spec that this target must be validated on device with one-handed landscape grip. Consider whether a wider touch affordance (invisible extended hit area below the visible button) would help. Also note the button appears while players are moving — the left thumb on the movement joystick cannot easily lift to reach the top-center. Verify the intended input model: does the player stop moving to tap Interact, or is it designed to be tappable while moving?

---

### [medium] — Badge font-size discrepancy: 9px in wireframe vs. 11px in spec

DESIGN.md §3 defines `xs` scale as 11px for "input badges (AUTO / RELEASE / TAP)." The wireframe renders badges at `font-size: 9px`. This is a 2px deviation but at this scale it is significant: 9px is below most platforms' minimum legible text size and below the WCAG advisory minimum. The badges are described as "reference-only during gameplay" (EXPERIENCE.md §7) but must be readable during class selection and the ability briefing panel. On a physical device, 9px Lora text over a dark background at arm's length will not be comfortably legible for all users.

**Suggested fix:** Align wireframe to the spec value of 11px. If 11px still feels cramped at badge scale, the badge padding (currently 2px 6px in the wireframe) should be kept; the type weight could be Lora 700 to compensate for size. Do not reduce below 11px in implementation.

---

### [medium] — No haptic or audio feedback spec for cooldown-complete

EXPERIENCE.md §7 (Low Reading Requirement) and §10 (Game Feel) describe the cooldown overlay as "large" and "felt, not just noticed," but no haptic or audio spec exists for the cooldown-complete event. A player watching the host screen has no peripheral vision on the phone controller. The cooldown completing is a critical gameplay signal — it means the player can fire again. Without at least a vibration pulse on cooldown completion, the player must glance at the phone to check readiness, which breaks the eyes-on-TV design principle.

**Suggested fix:** Add a Haptic and Audio feedback spec to EXPERIENCE.md §6 or §10. Minimum: a 10–20ms vibration pulse via `navigator.vibrate()` on cooldown complete (note: iOS Safari does not support `vibrate()` — alternative is a subtle audio cue). Specify: trigger event, vibration pattern, audio event name, volume guidance. Flag iOS Safari limitation.

---

### [medium] — Spirit-form phone state is completely undefined

EXPERIENCE.md §5 (In-Dungeon Combat, Near-Wipe Vigil) explicitly flags that "what the downed player sees on their phone while in spirit form is not defined in this session." This is a real input-surface gap: a downed player holds a phone with an active combat controller for a skill set they cannot use. The spec gives no guidance on what the controller shows, whether inputs are blocked, whether the player can interact (e.g., observe, communicate), or when the controller reactivates. During a near-wipe scenario this is the most emotionally significant player state — they are watching their friends fight — and the phone surface is unaddressed.

**Suggested fix:** Define the spirit-form phone state. Minimum options to choose between: (a) dimmed controller (skill cells fully disabled, joystick disabled, visual treatment to indicate spirit form); (b) spectator view or host-canvas thumbnail; (c) a minimal revive-prompt UI. This is a design decision, not a deferral — it needs to be in the spec before the combat controller is implemented.

---

### [medium] — Guest name session-storage behavior underspecified

EXPERIENCE.md §12 (Flow 1) implies the guest name is entered once and used for the session. DESIGN.md does not specify where the name is persisted. The prompt for this review identifies session storage as the intended storage. Session storage is tab-scoped and cleared on tab close. Three failure cases are unaddressed: (1) player opens a second tab (cross-tab: name not available — player appears nameless or must re-enter); (2) player closes and reopens the tab during a session (session storage cleared — player must rejoin); (3) player uses private browsing (session storage clears on window close). None of these is catastrophically bad in a couch co-op context, but case (2) is the reconnect scenario and must align with the reconnect state (flagged separately as [high]).

**Suggested fix:** Add a Guest Session Persistence section to EXPERIENCE.md §11 or as a note in §12 Flow 1. Specify: storage mechanism (session storage), cross-tab behavior (isolated, must re-enter), tab-close behavior (session lost, must rejoin via QR), private-mode behavior (same as tab-close). Note that `localStorage` would survive tab close but persists across sessions — this is a product decision. Align whatever choice is made with the reconnect state design.

---

### [low] — HP strip at 6px provides presence but no numerical information

The HP strip is deliberately minimal: "It is presence, not information. Players glance at it; they do not read it" (DESIGN.md §8). This is a principled design decision and the strip is not the primary health display — health pips on the host canvas serve that role. However, the phone is the only device the downed player's allies do NOT share. A player with 10% HP will not know from the strip exactly how critical their situation is; they rely entirely on in-canvas pips. In a loud couch environment with 4–6 players, a player can miss a critical health state. This is a known design trade-off, but should be explicitly documented as intentional so it is not "fixed" by a developer adding a number.

**Suggested fix:** Add a design note in EXPERIENCE.md §7 or DESIGN.md §8 explicitly stating: "The HP strip communicates health presence, not precision. Players read precision health from in-canvas pips on the host screen. No numeric HP value is shown on the phone during combat. This is intentional." This prevents scope creep.

---

### [low] — Class selection orientation transition missing component name

EXPERIENCE.md §4 (class-card) states class selection occurs in portrait. §11 (Phone App) confirms portrait for class selection. But the transition back to landscape after confirming a class ("phone transitions back to landscape — Hub Controller view," Flow 3 step 7) is described only in a flow narrative. There is no component, state name, or transition spec for this moment. When does the orientation lock change? Does the phone animate or snap? Is there a brief loading screen during the orientation shift?

**Suggested fix:** Add a one-line spec in EXPERIENCE.md §11 (Phone App orientation table) for the class-selection-to-hub-controller transition: expected trigger (class confirmed), expected behavior (OS auto-rotate enabled, no explicit prompt), expected duration (device rotation speed, no artificial delay). Name this transition so developers can implement it without guessing.
