---
stepsCompleted: [1, 2, 3, 4]
session_active: false
workflow_completed: true
inputDocuments: []
session_topic: 'Define a core ability-activation mechanic taxonomy (instant, aim+release, aim+hold/channel, cast/charge, aim+cast, etc.), and use it to properly define the fantasy + mechanics of all 16 abilities across the 4 base classes (Stonehide, Spiritcaller, Souldrinker, Stormcaller) — especially the 7 current placeholder/no-op abilities (Iron Skin, Ancestors Voice, Spirit Nova, Soul Mend, Warding Cry, Dark Pact, Storm Eye) and Blood Draws missing lifesteal.'
session_goals: 'Land on implementable, testable ability specs — flavor/fantasy finalized, mechanics adjustable later through playtesting — that map cleanly onto the existing hit-scan/cooldown/damage pipeline in packages/game-rules and apps/simulation-server.'
selected_approach: 'ai-recommended'
techniques_used: ['Morphological Analysis', 'Role Playing', 'SCAMPER Method']
technique_execution_complete: true
ideas_generated: [
  'Core Input/Activation Types (5)', 'Effect Types as Composable Primitives', 'Target Shape / Delivery (5 shapes)',
  'Duration/Repetition axis', 'Delivery Mechanism: Hitscan vs Projectile', 'Self-Cost primitive', 'Displacement/Pull primitive',
  'Stonehide: Iron Skin (self-shield)', 'Stonehide: Avalanche (basic attack)', 'Stonehide: Tremor Stomp (slow radius)', 'Stonehide: Stone Wall (pull cone)',
  'Spiritcaller: Ancestors Voice (dual-faction cone)', 'Spiritcaller: Spirit Nova (expanding shockwave)', 'Spiritcaller: Soul Mend (ranged spirit revive)', 'Spiritcaller: Warding Cry (party shield)',
  'Souldrinker: Blood Spike (self-cost lifesteal projectile)', 'Souldrinker: Crimson Lash (missing-HP cleave)', 'Souldrinker: Dark Pact (ally drain-for-buff)', 'Souldrinker: Void Pulse (projectile + vacuum zone)',
  'Stormcaller: Storm Eye (lightning DoT zone)'
]
context_file: ''
---

# Brainstorming Session Results

**Facilitator:** Cyby
**Date:** 2026-07-08

## Session Overview

**Topic:** Define a core ability-activation mechanic taxonomy (instant, aim+release, aim+hold/channel, cast/charge, aim+cast, etc.), and use it to properly define the fantasy + mechanics of all 16 abilities across the 4 base classes (Stonehide, Spiritcaller, Souldrinker, Stormcaller) — especially the 7 current placeholder/no-op abilities and Blood Draw's missing lifesteal.

**Goals:** Land on implementable, testable ability specs — flavor/fantasy finalized, mechanics adjustable later through playtesting — that map cleanly onto the existing hit-scan/cooldown/damage pipeline.

### Context Guidance

_No context file provided for this session._

### Session Setup

Follows directly from a code-gap analysis: of the 16 class abilities defined in `packages/shared-types/src/class-definitions.ts`, 7 are currently no-ops (damage=0, cooldown-only, no gameplay effect) — Stonehide's Iron Skin, Spiritcaller's Ancestor's Voice / Soul Mend / Warding Cry, Souldrinker's Dark Pact, Stormcaller's Storm Eye — plus Spiritcaller's Spirit Nova is mislabeled (comment says "burst heal" but deals damage), and Souldrinker's Blood Draw has no actual lifesteal despite its name/flavor. The current `AbilityInputType` union (`AUTO`/`RELEASE`/`TAP`) is also too coarse for the richer mechanics the user wants (aim+hold/channel, cast/charge, aim+cast).

Session will first establish the input-mechanic taxonomy, then work class-by-class through all 16 abilities to define fantasy + mechanical shape for each.

## Technique Selection

**Approach:** AI-Recommended Techniques
**Analysis Context:** Defining fantasy + mechanics for 16 class abilities (4 classes) with focus on implementable, testable specs mapping onto existing hit-scan/cooldown pipeline

**Recommended Techniques:**

- **Morphological Analysis:** Systematically builds the core ability-mechanic taxonomy (input type × effect type × target shape) as a clean parameter grid.
- **Role Playing:** Embodies each class's fantasy identity to generate emotionally coherent ability ideas for the placeholder abilities.
- **SCAMPER Method:** Converges Phase 2's candidate ideas into one specific, implementable spec per ability, grounded in the working abilities already in the codebase.

**AI Rationale:** The topic mixes a structured/systems problem (mechanic taxonomy, pipeline compatibility) with a flavor/identity problem (class fantasy) — so foundation-setting uses a structured/deep technique, idea generation uses a collaborative/embodied technique, and refinement converges with a structured technique built for taking loose ideas to concrete variations.

## Technique Execution Results

### Morphological Analysis — Core Taxonomy

Built a 5-dimension grid that every ability can be pinned to:

1. **Input/Activation:** Instant (tap), Aim+Release, Aim+Hold/Channel, Cast/Charge, Aim+Cast
2. **Effect primitive(s), composable:** Damage, Heal, Shield/Mitigation, Buff, Debuff, plus two discovered mid-session — **Self-Cost** (pay a resource, e.g. HP, to activate) and **Displacement/Pull** (physics force, not a stat effect). Lifesteal = Damage+Heal fired together, not its own primitive.
3. **Target shape:** Self, Proximity/Radius (self-centered, no aim), Aimed Point/Circle (aim biases which targets are caught — reuses existing `isInHitZone` geometry), Cone/Line (new), Zone/Field (placed, persists)
4. **Duration:** Instant (applies once) vs Continuous/Ticking (re-applies at intervals for as long as active)
5. **Delivery:** Hitscan (resolves instantly, what all 9 working abilities do today) vs Projectile (travels, can miss, resolves on collision) — plus a discovered variant, **Expanding Radius** (omnidirectional growing ring, e.g. Spirit Nova), and the pattern that a projectile's on-impact effect can *chain* into spawning a Zone/Field (e.g. fireball → burn patch).

**Key Breakthroughs:** Realizing "target shape" and "effect type" are orthogonal (so AoE isn't its own effect, it's a delivery/shape choice); the Self-Cost and Displacement primitives emerging organically from class fantasy rather than being pre-planned; recognizing that `TAP` abilities with a directional shape need a facing-direction fallback rather than requiring active aim.

**User Creative Strengths:** Caught real gaps in the draft taxonomy before they became implementation problems (projectile payload chaining, lifesteal-as-composite, nearby-vs-aimed targeting distinction).

**Energy Level:** High, focused — stayed in structured/deep mode the whole phase, no drift into premature ability specifics.

### Role Playing — Class-by-Class Ability Definition

Went class by class, embodying each archetype to define/fix every ability (not just the 7 placeholders — Souldrinker's and Stonehide's "working" abilities got a full rework too once their weak identities became obvious by contrast).

**Stonehide (Tank) — final kit:**
- **Iron Skin:** Self Buff, flat % damage reduction, short duration, Instant/Tap.
- **Avalanche:** Basic attack — Aim+Hold/Channel, Cone/Line, Damage. (Swapped roles with Stone Wall mid-session.)
- **Tremor Stomp:** Self-centered Proximity/Radius, Damage + Slow debuff to everyone caught.
- **Stone Wall:** Aim+Release, long-reach Cone/Line, small Damage + Displacement/Pull — drags every enemy hit toward the caster.

**Spiritcaller (Healer) — final kit:**
- **Ancestor's Voice:** Aim+Hold/Channel, Cone/Line at mid-range, mixed-faction resolution (Damage to enemies, Heal to allies caught in the same cone).
- **Spirit Nova:** Instant/Tap, Expanding Radius delivery (new pattern — a shockwave ring growing outward from the caster), mixed-faction Heal/Damage. Fixes the code's mislabel (was dealing damage only).
- **Soul Mend:** Aim+Cast (2-3s channel, cancels on interrupt, range-limited), targets a downed ally's *spirit* specifically, revives them into their body on completion — bypasses the normal walk-to-body revive flow entirely.
- **Warding Cry:** Self-centered Proximity/Radius, Instant/Tap, temporary Shield/Buff to all allies caught.

**Souldrinker (Drain DPS) — final kit:**
- **Blood Spike** (renamed from Blood Draw): Aim+Hold/Channel, Projectile delivery, flat Self-Cost (HP) per cast with a 1-HP safety floor, Damage + 50% lifesteal on hit, pure loss on miss.
- **Crimson Lash:** Aim+Release, Cone/Line (hits everyone in a row), damage scales inversely with the caster's own current HP.
- **Dark Pact:** Aim+Release (corrected from `TAP`), targets a living ally specifically, drains 10% of their current HP to the caster in exchange for a temporary +25% damage Buff — new "Drain-Transfer" pattern, cost paid by someone else.
- **Void Pulse:** Aim+Release (corrected from `TAP`), Projectile that explodes on impact (Damage) and spawns a Zone/Field that pulls all units — allies and enemies — toward its center.

**Stormcaller (Zone DPS) — final kit:**
- **Lightning Arc:** Confirmed as basic attack, Aim+Hold/Channel, unchanged.
- **Tempest Hurl, Thunder Clap:** Confirmed as-is (aimed throw / AoE slam), no rework needed.
- **Storm Eye:** Aim+Release placement (corrected from `AUTO`), Zone/Field, Continuous/Ticking — steady Damage tick plus periodic random lightning-bolt strikes on random targets inside the zone. Fixes the placeholder.

**Creative Breakthroughs:** Soul Mend's ranged-spirit-revive (a wholly new interaction, not a stat tweak); Blood Spike's self-cost framing making class buffs more valuable via a flat (not scaling) HP cost; Dark Pact's inter-player HP drain forcing real co-op attention; Void Pulse and Stone Wall both reusing the Displacement primitive independently, confirming it's a real reusable building block and not a one-off.

**Input-type corrections surfaced for Phase 3:** Dark Pact and Void Pulse move `TAP` → Aim+Release; Storm Eye moves `AUTO` → Aim+Release (placement); Soul Mend moves `RELEASE` → Aim+Cast; Stone Wall/Avalanche input types swap.

**User Creative Strengths:** Strong instinct for class-fantasy coherence (Blood Spike, Dark Pact, Soul Mend) and for pushing back/correcting when a suggestion didn't fit the mechanical reality (Stone Wall/Avalanche swap).

**Energy Level:** Sustained high engagement across all 4 classes; explicitly chose to also rework already-working abilities rather than stop at the 7 placeholders, broadening the session's value.

### Creative Facilitation Narrative

Started from a very concrete forcing function — 7 dead abilities and one mislabeled one, found via code inspection — and used that as fuel for genuine divergent-then-convergent design work. The Morphological Analysis phase avoided the trap of jumping straight to "what should Iron Skin do" before establishing shared vocabulary, which paid off immediately once Projectile/Zone/Displacement concepts started getting reused organically across classes. The Role Playing phase then let the user's game-design instincts drive almost everything — corrections (Stone Wall/Avalanche swap, Soul Mend's input type) came from the user catching mismatches between fantasy and mechanics, not from AI-side critique.

### Session Highlights

**User Creative Strengths:** Clear game-design intuition, willing to self-correct mid-thought, consistently pushed toward *interactive* and *risk/reward* mechanics (Dark Pact, Blood Spike, Crimson Lash's missing-HP scaling) rather than settling for safe flat-damage abilities.
**AI Facilitation Approach:** One ability at a time, always pinning each idea back to the Phase 1 grid so nothing became a bespoke one-off, flagging input-type/implementation corrections without stopping the creative flow.
**Breakthrough Moments:** The Self-Cost and Displacement primitives emerging from class fantasy rather than being pre-planned; Soul Mend's ranged spirit-revive; realizing Projectile-impact effects can chain into spawned Zone/Field constructs (solves the "fireball with a burn patch" question cleanly).
**Energy Flow:** Consistently high; user opted to extend scope (revisiting working abilities) rather than stopping at the minimum placeholder-fixing goal.

### SCAMPER Method — Convergence Pass

**Substitute:** Reconciled 7 input-type corrections surfaced during Role Playing — Stone Wall (TAP→Aim+Release), Avalanche (AUTO→Aim+Hold/Channel), Tremor Stomp (RELEASE→Instant/Tap), Soul Mend (RELEASE→Aim+Cast), Dark Pact (TAP→Aim+Release), Void Pulse (TAP→Aim+Release), Storm Eye (AUTO→Aim+Release placement). Confirmed as a batch, no further changes needed.

**Modify:** Closed three implementability gaps deliberately left loose during idea generation:
- **Soul Mend range:** Confirmed it keeps the same range-limit rule as every other ability — no map-wide exception, just a generous radius.
- **Dark Pact safety:** Confirmed no down-safety floor — draining an ally can accidentally push them into downed state; this is intentional risk, not a bug to guard against.
- **Blood Spike insufficient HP:** Confirmed the ability still fires when HP is low, but the self-cost caps at whatever HP remains above the 1-HP floor rather than blocking the cast.

**Key Breakthroughs:** None of the corrections required new ideas — the taxonomy from Phase 1 held up under real scrutiny, and every "loose end" had a clear, fast answer once asked directly, confirming the specs were already close to implementation-ready going into this phase.

**User Creative Strengths:** Decisive convergence — clear, immediate answers on every edge case with no second-guessing, confirming strong internal design conviction going into this phase.

**Energy Level:** Efficient, focused — this phase was short by design since Phase 2 already produced concrete specs rather than vague candidates.

**Overall Creative Journey:** Went from "we have a taxonomy idea and 8 broken/weak abilities" to a complete, implementation-ready 16-ability spec sheet across three techniques, with the middle phase organically expanding scope to rework every ability's identity, not just the placeholders.

## Idea Organization and Prioritization

### Final Ability Spec Sheet (by class)

**Stonehide (Tank) — "Gather, Mitigate, Control, Sustain"**

| Ability | Input | Shape | Effect | Duration | Delivery |
|---|---|---|---|---|---|
| Iron Skin | Instant/Tap | Self | Buff (flat % dmg reduction) | Instant application, timed buff | Hitscan |
| Avalanche (basic attack) | Aim+Hold/Channel | Cone/Line | Damage | Instant | Hitscan |
| Tremor Stomp | Instant/Tap | Proximity/Radius (self) | Damage + Debuff (slow) | Instant | Hitscan |
| Stone Wall | Aim+Release | Cone/Line (long reach) | Small Damage + Displacement (pull) | Instant | Hitscan |

**Spiritcaller (Healer) — "Sustain, Burst, Revive, Defend"**

| Ability | Input | Shape | Effect | Duration | Delivery |
|---|---|---|---|---|---|
| Ancestor's Voice | Aim+Hold/Channel | Cone/Line (mid-range) | Mixed-faction: Heal allies / Damage enemies | Instant, re-fires per cooldown tick | Hitscan |
| Spirit Nova | Instant/Tap | Expanding Radius (new pattern) | Mixed-faction: Heal allies / Damage enemies | Instant | Expanding Radius |
| Soul Mend | Aim+Cast (2-3s channel, cancels on interrupt) | Aimed Point, filtered to downed ally spirits | Special: remote revive | Instant on completion | Hitscan |
| Warding Cry | Instant/Tap | Proximity/Radius (self) | Buff (shield) to all allies caught | Instant | Hitscan |

**Souldrinker (Drain DPS) — "Risk-Reward Blood Magic"**

| Ability | Input | Shape | Effect | Duration | Delivery |
|---|---|---|---|---|---|
| Blood Spike (renamed from Blood Draw) | Aim+Hold/Channel | Aimed Point | Self-Cost (flat HP, 1-HP floor, caps if insufficient) + Damage + 50% lifesteal on hit | Instant | Projectile |
| Crimson Lash | Aim+Release | Cone/Line | Damage (scales inversely with caster's own HP) | Instant | Hitscan |
| Dark Pact | Aim+Release | Aimed Point, filtered to living allies | Drain 10% target HP → self + Buff (+25% dmg) to self; no down-safety floor | Instant + timed buff | Hitscan |
| Void Pulse | Aim+Release | Aimed Point → spawns Zone/Field | Damage on impact + Displacement (pull all units) in zone | Instant impact, zone is Continuous | Projectile → chained Zone/Field |

**Stormcaller (Zone DPS) — "Area Pressure"**

| Ability | Input | Shape | Effect | Duration | Delivery |
|---|---|---|---|---|---|
| Lightning Arc (basic attack) | Aim+Hold/Channel | Line | Damage | Instant | Hitscan |
| Tempest Hurl | Aim+Release | Aimed Point | Damage | Instant | Hitscan |
| Thunder Clap | Instant/Tap | Proximity/Radius (self) | Damage | Instant | Hitscan |
| Storm Eye | Aim+Release (placement) | Zone/Field | Damage tick + random lightning-strike bursts | Continuous/Ticking | Hitscan (placed zone) |

### New Engine Capabilities Required (Implementation-Ready Themes)

- **Player status-effect system** (buffs/debuffs with duration) — blocks Iron Skin, Tremor Stomp's slow, Dark Pact's buff, Warding Cry, Storm Eye's tick
- **Mixed-faction target resolution** (heal ally / damage enemy in one query) — blocks Ancestor's Voice, Spirit Nova
- **Projectile physics bodies with collision** — blocks Blood Spike, Void Pulse
- **Persistent Zone/Field entities with tick logic** — blocks Storm Eye, Void Pulse's vacuum
- **Displacement/pull physics force** — blocks Stone Wall, Void Pulse
- **Self-Cost (HP-as-resource) mechanic** — blocks Blood Spike
- **Spirit-targeting + remote revive interaction** — blocks Soul Mend (largest, most novel lift)

### Breakthrough Concepts

- **Soul Mend's ranged spirit-revive** — a wholly new interaction type, not a stat variation, directly extending the existing revive/spirit-form systems (Epics 3.5/3.6)
- **Displacement/Pull as a reusable primitive** — discovered independently for Stone Wall and Void Pulse, confirming it's a genuine building block
- **Self-Cost economy for Souldrinker** — flat HP costs (not scaling) make the class's own damage buffs more valuable, tying Blood Spike, Crimson Lash, and Dark Pact into one coherent risk loop
- **Mixed-faction cone resolution** for Spiritcaller — one ability, one query, effect chosen by target faction, avoiding bespoke separate ally/enemy logic paths

## Session Summary and Insights

**Key Achievements:**
- Established a reusable 5-dimension ability taxonomy (Input × Effect × Shape × Duration × Delivery) plus 2 new primitives (Self-Cost, Displacement)
- Fully specified fantasy + mechanics for all 16 abilities across 4 classes — fixed 7 placeholders, 1 mislabeled ability, and added lifesteal to Blood Draw/Spike, and additionally reworked 6 more "working" abilities that had weak identities
- Identified 7 concrete engine capabilities not yet built, giving a clear scope map for follow-up implementation planning

**Session Reflections:**
The session worked well because Morphological Analysis front-loaded a shared vocabulary before any ability got discussed, which meant Role Playing could move fast without re-deriving mechanical concepts each time — new primitives (Self-Cost, Displacement, Expanding Radius) surfaced naturally from class fantasy rather than being forced. SCAMPER's convergence pass was short because Phase 2 already produced concrete, implementable specs rather than vague candidates — the main value there was catching input-type mismatches (7 of them) and 3 real edge cases before they became implementation bugs.

**Next Steps (per user request, not yet executed):**
1. Do **not** edit `packages/shared-types/src/class-definitions.ts` or `packages/game-rules/src/balance.ts` directly from this session — the new mechanics require new engine subsystems and cross ownership boundaries (`packages/shared-types`, `packages/game-rules`, `apps/simulation-server`) per this repo's `CLAUDE.md`.
2. Route this spec into `bmad-create-epics-and-stories` or `bmad-create-story` to scope the 7 new engine capabilities + 16 ability updates into properly bounded, ownership-clean implementation tasks with acceptance criteria.
