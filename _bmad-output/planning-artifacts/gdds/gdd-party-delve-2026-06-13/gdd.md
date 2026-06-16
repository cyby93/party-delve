---
title: Party Delve
game_type: co-op action roguelike
platforms: [PC (host screen), Mobile (iOS/Android — controller)]
created: 2026-06-13
updated: 2026-06-13
status: in-progress
---

# Party Delve - Game Design Document

**Author:** Cyby
**Game Type:** Co-op Action Roguelike
**Target Platform(s):** PC (host/TV screen) + Mobile (iOS/Android as controllers)

---

## Executive Summary

### Core Concept

Party Delve is a couch co-op action roguelike for 3–8 players. A group sits down in front of a shared screen, scans a QR code on their phones, and within seconds they are warriors of a tribal spirit-world, sent to purify corrupted ancestral territories. Each player controls one of 10 radically asymmetric classes — drawn from nature, animal, and spirit archetypes — and fights through procedurally generated dungeon levels that escalate toward a memorable boss encounter. The session runs ~30 minutes. No registration required to play; registered players earn persistent mastery and cosmetic progression across runs. The phone is the only controller. The TV is the only screen that matters.

### Target Audience

**Primary:** Groups of 3–8 friends or family members who want to play together on a shared screen with minimal setup friction. Casual-to-intermediate gamers comfortable with mobile touch input. No prior gaming expertise required to join and have fun.

**Secondary:** Registered players who want to build a persistent character identity across sessions — mastery-driven, class-committed players who return for depth and completionism.

**Not targeting:** Competitive/PvP players, solo players, players seeking deep narrative story beats in v1.0.

### Unique Selling Points (USPs)

1. **Zero-friction session start** — scan a QR code and you're in. No app store required for guests, no account setup, no lobby wait. The game starts as fast as the group can raise their phones.
2. **Tribal spirit fantasy** — not swords and sorcery. Nature, animals, corruption, ancestral power. A setting that feels genuinely different from the dungeon crawler genre default.
3. **Radical class asymmetry** — 10 classes that feel nothing alike. Songweaver times team rhythm windows; Souldrinker converts its own health into offense; Windwalker repositions teammates mid-fight. No reskins.
4. **Spirit Bond System** — after each level, new player pairs are bonded by the spirits. Every bond is a buff with a price. By the boss, three bonds are active simultaneously — creating emergent team dynamics every run.
5. **Behavior-tiered difficulty** — harder difficulties add new enemy behaviors, not just inflated stats. The game teaches its enemies, then makes them more dangerous.

---

## Goals and Context

### Project Goals

1. Deliver a complete, playable local co-op dungeon crawler that a group of 3–8 people can start playing within 10 seconds of sitting down together.
2. Validate the hybrid architecture: authoritative simulation server + shared host screen + phone controllers.
3. Ship 10 radically asymmetric classes with the Spirit Bond system fully functional.
4. Prove the tribal spirit fantasy setting as a distinct and coherent aesthetic.
5. Establish the replayability foundation: procedural levels, biome achievements, and ability mastery.

### Background and Rationale

**The Corruption — core lore premise:**

The tribe's ancestral spirits — the animals, the nature forces, the guardians of the land — have been corrupted by a dark force bleeding into the spirit world. Corrupted spirits now manifest in the mortal world as hostile, twisted versions of what they once were. The hub village is the last uncorrupted sanctuary, protected by the sacred campfire.

Warriors are sent into corrupted territories not to kill, but to *purify* — to face the twisted spirits and cleanse them. The most powerful corrupted spirit in each territory is the boss: defeating it purifies that zone and pushes the corruption back.

The corruption spreads into new territories over time, which is why warriors return run after run. Each biome is a different territory, home to different ancestral spirits — each corrupted in its own way.

**Narrative note:** Full world-building (territory names, faction lore, spirit mythology, corruption origin) to be developed in a dedicated narrative session (`gds-create-narrative`).

---

## Core Gameplay

### Game Pillars

**Pillar 1 — High-Frequency Action**
Core abilities fire on 1–2 second cycles; the combat tempo never lets the player breathe; reaction time is a real skill. A slow deliberate-cast game is not this game.

**Pillar 2 — Radical Class Asymmetry**
No two classes share an ability archetype; each class has a distinct mechanical role and power fantasy; a team missing a role is a weaker team. Classes are not skins of each other.

**Pillar 3 — Boss as Climax**
Every boss synthesizes the mechanics introduced in preceding levels; bosses are the most complex and memorable encounters in the game; the path to the boss is preparation for it. A boss that could appear anywhere is not this game's boss.

**Pillar 4 — Zero Barrier to Together**
The game starts the moment everyone can scan a code; no one is left out; no friction exists between "let's play" and playing. The social moment is the product itself.

### Core Gameplay Loop

**The closed cycle:**

1. **Hub** — Players free-roam the tribe village: pick class at class-selection POI, test abilities on training dummies, swap skins, explore (campfire, NPCs, buildings).
2. **Queue** — Group approaches dungeon entrance POI. One player proposes biome + difficulty. All phones receive an accept/decline popup. Run loads on unanimous accept.
3. **Dungeon levels** — Objectives displayed on host screen. Players fight, solve light puzzles, and revive each other across a sequence of escalating levels. Each level is harder than the last.
4. **Boss level** — Dedicated room. Boss synthesizes mechanics introduced in preceding levels. Team coordination and synergy required. Optional adds.
5. **Victory** — Reward reveal (loot chest, spirit manifestation). Run summary screen shown on host.
6. **Return to Hub** — Rewards applied. Unlocks available. Players ready for next run.

**Replay drivers (why run #100?):**

- **Registered progression** — Unlocked abilities, enhancements, and passive traits change how a run plays, not just the numbers.
- **Biome achievements** — Per-biome challenge sets pull players back to specific contexts (e.g., complete X in Forest biome, achieve Y in Cave biome).
- **Ability mastery** — Usage-count milestones reward class commitment. Example: cast Fireball 1,000 times → unlock alternate sound + visual variant. Rewards are cosmetic + ability variants only (equal power level, different feel). Thematic framing: deepening bond with your spirit.

### Win/Loss Conditions

**Run victory:** All 3 dungeon levels cleared and the boss defeated. Triggers reward reveal and run summary screen. Team returns to hub with Spirit Essence and mastery progress.

**Run failure:** All players enter spirit form simultaneously — no living warrior remains. Run ends immediately. Partial Spirit Essence reward applied (rules TBD). Team returns to hub.

**Individual loss (not run-ending):** Player's revive timer expires → enters spirit form. Continues to contribute in a reduced capacity. Run continues short-handed. Spirit form contribution rules TBD.

---

## Game Mechanics

### Primary Mechanics

#### Spirit Bond System

After each dungeon level is completed, one new Spirit Bond is assigned to a random player pair. Bonds accumulate — they do not replace each other. All bonds active at level start remain active through the boss fight.

**Bond accumulation per run (3 levels + boss):**
- After Level 1: 1 bond active
- After Level 2: 2 bonds active
- After Level 3: 3 bonds active
- Boss fight: 3 bonds simultaneously in play

**Bond design rules:**
- Every bond grants a positive effect — always a buff, always tribal/spirit-flavored
- Every bond carries a price — a condition, timer, or consequence that demands coordination
- No purely negative bonds exist

**Example bond types:**
- *Proximity bond:* both players deal +20% damage when within range of each other, but after 20s in range they begin to drain each other's health
- *Fate bond:* both players gain +20% movement speed, but if one is downed the other is instantly downed too
- [Additional bond types TBD during balance]

**Open:** Can a player appear in multiple bonds simultaneously? Required with small teams (3 players, 3 bonds). Rules TBD.

**Host screen Spirit Bond display:** Visual tether — a colored line or particle trail connecting each bonded pair on the host screen. Each active bond uses a distinct color. [NOTE FOR DESIGNER: particle count TBD based on full game rendering budget; simplify to aura or HUD if needed.]

### Controls and Input

**Mobile Controller Layout:**
- Left half of screen: single analog joystick (movement)
- Right half of screen: 4 ability slots — class-specific layout, not standardized across classes

**Ability input types (three types, any mix per class):**
- **Joystick-AutoFire** — hold and aim; ability fires continuously in the aimed direction (e.g., bow volley, lightning stream)
- **Joystick-Release** — hold to charge or set direction, fires on thumb-lift (e.g., dash, pounce, charged shot)
- **Tap** — instant cast, no directional input required (e.g., burst heal, taunt, self-buff, mushroom drop)

**Cooldown philosophy:** Class-specific cooldowns; no global tiers. Every class has at least one ability that fires within ≤3 seconds (the Pillar 1 floor). Classes may break this rule only with strong design justification.

**Player Count:** 3–8 players

**Death Model (per-player escalating revive timer):**
- Revive windows per player (consecutive downs): 60s → 40s → 20s → 10s → 5s → 2s
- If timer expires: player enters spirit form (short-handed but still contributes)
- Timer resets: **per run** (a player downed in level 1 carries a shorter window into level 2)

---

## Roguelike Specific Design

### Run Structure

**Structure per run:** 3 dungeon levels + 1 boss level

**Target session length:** ~30 minutes for a full successful run

**Level objectives (Mixed):**
- v1.0: **Clear** (defeat all enemies in area) and **Survive the Waves** (hold out for N waves)
- Post-launch: additional objective types (escort, shrine activation, exploration, etc.)

**Difficulty scaling per run:** Each level is harder than the last — enemy count, enemy variety, and encounter complexity increase. Specific scaling values TBD during balance.

**Victory condition:** Defeat the boss on level 4. Team returns to hub with run rewards.

**Failure condition:** All players enter spirit form simultaneously — run ends, partial rewards apply. [TBD: partial reward rules]

### Procedural Generation

**Approach:** Procedural layout with handcrafted room content.
- Floor plan (room positions, corridor connections, exit placement) is generated per run
- Room interiors (enemy composition, prop placement, puzzle triggers) are curated pools — rooms are hand-designed, but which rooms appear and in what order is random
- Boss room is always handcrafted and fixed per biome

**Biome rollout:**
- v1 alpha: 1 biome — **Grassland** (herd-animal and plains spirits, open sightlines, fast enemies)
- v1.0 launch: 2 biomes — Grassland + **Ancient Forest** (predator and tree spirits, dense corridors, ambush enemies)
- Post-launch: additional biomes (wetlands, underground caves, volcanic highland, etc.)

**Each biome features:**
- Distinct corrupted enemy pool (spirit-animals native to that territory)
- Unique corrupted boss (the dominant spirit of that territory)
- Biome-specific achievement set
- Distinct visual identity (art palette, props, corruption aesthetic)

**Seed system:** Each run uses a shared deterministic seed (required for co-op synchronization across host and all mobile clients). All procedural decisions — floor layout, room selection, enemy spawns, Spirit Bond assignments — are derived from this single seed. Seed is not player-visible in v1.0. [NOTE FOR DESIGNER: seeded runs enable future features — daily challenge seeds, run sharing, replay validation.]

**Enemy placement:** Drawn from biome-specific enemy pools per room tier (early room vs. late room vs. pre-boss room). Specific placement rules TBD during level design.

### Permadeath and Progression

**Death model:** No true permadeath. Players enter spirit form when revive timer expires — run continues short-handed. Run ends only if all players enter spirit form simultaneously.

**What persists between runs (registered players):**
- Spirit Essence (accumulated)
- Mastery counters (per ability, per class)
- Unlocked skins and enhancements
- Achievement progress (per biome)

**What resets each run:**
- Player health
- Spirit Bonds (new bonds assigned each run)
- Enemy and room layout (procedurally regenerated)
- Run-specific state

### Item and Upgrade System

**In-run drops:** Spirit Essence only. Enemies drop Spirit Essence on death; collected automatically or via proximity. No mid-run item pickups in v1.0.

**Post-run rewards:** Spirit Essence + mastery progress. Boss defeat yields a reward reveal (loot chest / spirit manifestation visual) — contents are Spirit Essence and mastery milestone triggers, not inventory items.

**Between-run spending (hub):** Spirit Essence spent on skins and enhancements at hub POIs.

**Post-launch:** Consumable mid-run drops (healing berry, speed totem, etc.) considered as a later addition.

### Character Selection

**Full launch roster — 10 classes:**

| Class | Spirit/Animal | Role | Play Rhythm |
|---|---|---|---|
| Stonehide | Great horned beast | Tank / Frontline anchor | Slow, committed, space-holding |
| Sunwarden | Radiance / heat | Guardian healer | Reactive protection |
| Spiritcaller | Ancestral communion | Burst healer / Revive support | Timing-heavy, reactive |
| Wildshaper | Wild beast | Adaptive support | Stance play |
| Songweaver | Ceremony / drum / chant | Team sync support | Timing and tempo |
| Trailhunter | Tracker / hunter | Setup DPS | Mark and pickoff |
| Shadowstalker | Panther / owl / night totem | Assassin | Burst and reposition |
| Stormcaller | Lightning shaman | Zone control DPS | Area pressure |
| Souldrinker | Ritual predator | Drain / sustain DPS | Risk-reward sustain |
| Windwalker | Wind scout | Mobility / rescue utility | Fast reactive intervention |

**v1 alpha prototype scope:** Stonehide, Spiritcaller, Souldrinker, Stormcaller (frontline, healer, sustain DPS, zone DPS). These 4 classes are the alpha target. Remaining 6 classes ship at v1.0 launch. This GDD supersedes the prior gameplay spec definition of a 2-archetype alpha slice.

**Ability structure per class:** 4 abilities per character. Mix of joystick-directional and tap inputs on the right half of the mobile screen. Specifics TBD per class.

### Difficulty Modifiers

**Difficulty tiers at launch:** Easy / Normal / Hard (additional tiers post-launch)

**Enemy count scaling:** Scales with player count, not difficulty. A 3-player run faces fewer enemies than an 8-player run at the same difficulty tier. Ensures appropriate pressure at all team sizes.

**Behavior-Tiered Enemy Difficulty:**
Difficulty changes enemy *behavior and abilities*, not just health or damage values. Each enemy type has a behavior set that expands with difficulty.

Example — basic corrupted enemy:
- **Easy:** follows player, melee attack
- **Normal:** + occasional telegraphed charge
- **Hard:** + ground stomp (AoE slow, telegraphed)

All enemy types follow this pattern: each difficulty tier adds one or more new behaviors. Higher difficulties require players to recognize and react to an expanded enemy behavior vocabulary.

**Lore framing:** Higher difficulty = the corruption has deepened; corrupted spirits manifest with greater power and aggression.

**Boss difficulty:** Boss encounters also follow behavior-tiered scaling — Hard bosses have additional phases or abilities absent on Easy. Defined per boss during detailed design.

---

## Progression and Balance

### Player Progression

**Two-tier player model:**
- **Guests** — full access to all classes and base abilities; no persistent progression; no registration required
- **Registered players** — same base experience as guests + persistent progression across runs

**Currency: Spirit Essence**
- Single in-run currency; dropped by enemies and bosses
- Accumulated across runs for registered players
- Spent in the hub on cosmetics and enhancements

**Registered progression layers:**

| Layer | What it is | How unlocked | Power impact |
|---|---|---|---|
| Skins | Character visual variants | Purchased with Spirit Essence | None |
| Enhancements | Ability variants with slight power increase | Purchased with Spirit Essence and/or mastery milestones | Minimal but felt |
| Mastery variants | Ability versions unlocked by usage count (e.g. 1,000 casts) | Automatic via mastery milestones | Minimal but felt (e.g. faster, wider, or splash fireball) |

**Mastery system:**
- Each ability has a usage counter tracked per registered player
- Milestones unlock ability variants: alternate sound, alternate visual, and slight mechanical improvement
- Variant examples: Fireball → faster projectile / wider cone / adds splash damage radius
- Power delta is intentionally small — the reward is the *feeling* of mastery, not a competitive edge over guests
- Guests and registered players can compete in the same run without structural disadvantage

**What 20 runs of experience looks like:**
- Cooler skin reflecting the player's spirit identity
- 1–2 mastered abilities feeling distinctly their own
- Tactical advantage from familiarity with class and synergies — not from raw stat inflation

### Difficulty Curve

<!-- TBD -->

### Economy and Resources

<!-- TBD -->

---

## Level Design Framework

### Level Types

**Hub village** — Free-roam pre-run space. Handcrafted. POIs: class selection, training dummies (ability sandbox), skin/cosmetics station, dungeon entrance. Campfire at center. No enemies. Persistent between runs.

**Dungeon levels (1–3)** — Procedurally generated floor layout with handcrafted room pool. Each level contains multiple rooms. Objective displayed on host screen (v1.0: Clear or Survive the Waves, randomly assigned). Enemies drawn from biome-specific pool for that level tier (early/mid/late). Spirit Bond assigned at level completion.

**Boss level (level 4)** — Fully handcrafted. Single large arena. One boss enemy (the dominant corrupted spirit of the biome) with optional adds. Boss synthesizes mechanics from the preceding three levels. All 3 Spirit Bonds active simultaneously.

### Level Progression

**Within a run:**
- Level 1 → Level 2 → Level 3 → Boss level
- Enemy count scales with player count at all levels
- Enemy behavior tier matches selected difficulty (Easy/Normal/Hard) throughout the run
- Room complexity increases level by level — early rooms are simpler, later rooms introduce more enemies and tighter layouts
- Spirit Bond accumulates: 0 bonds entering level 1 → 1 bond entering level 2 → 2 bonds entering level 3 → 3 bonds on boss

**Between runs:**
- Procedural seed regenerated — different layout and room sequence each run
- Same biome and difficulty retained unless player changes selection at dungeon entrance

---

## Art and Audio Direction

### Art Style

**Perspective:** Isometric 3/4 view (pixel art, generated via PixelLab MCP)

**Color palette:** Warm and earthy — ochres, deep greens, firelight oranges. The world feels alive, grounded, and inhabited. The hub village radiates warmth; corrupted territories are still earthy but dimmed and cracked.

**Corruption aesthetic — Soul Cracks:**
Corrupted enemies and environments show dark void fractures spreading across their surface (soul cracks), with the corrupt essence glowing through. Eyes glow. Cracks glow. The corruption is visible as wrong-colored light (sickly purple, acid green, or blood red) leaking through broken spirit-form. Readable from across the isometric screen at a glance.

**Hub village feel:** Cosy, warm, firelit. Safe. Campfire at the center. Handcrafted buildings and NPCs with strong tribal silhouettes.

**Biome visual identity:**
- Grassland: open, golden, long sightlines; herd-animal spirit motifs; corruption spreads as dark patches across the savanna
- Ancient Forest: dense, canopied, deep greens and shadow; predator and tree spirit motifs; corruption as soul-cracked bark and void-eyed predators

**Enemy readability:** Corrupted enemies must be visually distinguishable from each other and from the players at isometric scale. Soul crack glow is the universal corrupted-state marker.

**No visual references provided** — [NOTE FOR DESIGNER: reference images recommended before art production begins. Consider: Hades (isometric pixel readability), Ancestor's Legacy (tribal + corrupted aesthetic), or PixelLab portfolio samples for the art style.]

### Audio and Music

**Baseline:** Ambient natural sounds — wind, fire crackling, birdsong, insect chorus. The world breathes.

**Hub village:** Warm ambient nature + light tribal percussion and occasional chanting. Peaceful, restorative, cosy. Players feel safe here.

**Dungeon levels:** Ambient nature shifts darker and more sparse; tribal drums become more urgent and rhythmic; eerie undertones emerge without crossing into horror. Tense, not terrifying.

**Combat:** Eerie and atmospheric — darker percussion, discordant spirit-sound accents, reactive audio that escalates with enemy count. Darker in feel but not creepy-dark; the goal is adrenaline and urgency, not dread.

**Boss encounter:** Distinct audio signature per boss; fully composed moment, not generative. Should feel like an event.

---

## Technical Specifications

### Performance Requirements

**Input latency:** ≤100ms from mobile controller input to visible response on host screen. Reaction time must feel instant — this is a hard requirement for Pillar 1.

**Session join time:** ≤10 seconds from QR code scan (or session code entry) to player appearing in the hub, assuming the player has already selected guest or is signed in.

**Frame rate:** [NOTE FOR DESIGNER: no specific target set. Rough hardware guideline — host PC/laptop no older than ~4 years; mobile device no older than ~4 years. Concrete FPS targets to be established during architecture and performance testing.]

### Platform-Specific Details

**Host screen:** PC / laptop running the host client, displayed on a TV or monitor. Single shared screen for all players to watch.

**Mobile controllers:** iOS and Android. Each player joins via QR code scan or session code. The mobile client is a controller UI only — no game state rendered on phone beyond ability cooldowns and player status.

**Join flow:** Guest option or account sign-in → QR scan or manual session code → immediate entry into hub.

### Asset Requirements

**Art pipeline:** Pixel art assets generated via PixelLab MCP (isometric 3/4 view). Asset budgets and resolution targets TBD during architecture phase.

---

## Development Epics

### Epic Structure

Full epic and story breakdown in `epics.md`. Summary sequence:

| # | Epic | Deliverable |
|---|---|---|
| E1 | Foundation Platform | Host + mobile + simulation server running; QR join flow; hub world (empty) |
| E2 | Hub World | Tribe village with POIs, class selection, training dummies, dungeon entrance |
| E3 | Core Combat (4 classes) | Stonehide, Spiritcaller, Souldrinker, Stormcaller playable; basic enemies; Clear objective |
| E4 | Procedural Dungeon | Generated floor layout; handcrafted room pool; 3-level run structure |
| E5 | Spirit Bond System | Bond assignment at level end; tether display on host; 2 bond types |
| E6 | Boss Encounter | Grassland biome boss; behavior-tiered; synthesizes E3 mechanics |
| E7 | Progression & Meta | Spirit Essence economy; mastery counters; hub shop; guest vs registered |
| E8 | Full Class Roster | Remaining 6 classes; all 10 playable |
| E9 | Ancient Forest Biome | Second biome; enemy pool; boss; achievements |
| E10 | Polish & Metrics | Difficulty tuning; telemetry; UX pass; success metric instrumentation |

---

## Success Metrics

### Telemetry Baseline (v1 alpha)

Minimum telemetry instrumentation required for first playable:
- Session start / end events (with player count, biome, difficulty, outcome)
- Player down / revived events (with down count, revive window remaining)
- Spirit Bond assignments (which pairs, which bond type)
- Run completion time
- Spirit Essence earned per run

Full telemetry strategy to be defined by QA + Telemetry Engineer.

### Technical Metrics

| Metric | Target | Measurement method |
|---|---|---|
| Input latency | ≤100ms p95 | Mobile input event → host screen frame render |
| Session join time | ≤10s | QR scan / code entry → player visible in hub |
| Host frame rate | 60 FPS stable | Measured during 8-player combat on target hardware |
| Crash rate | 0 crashes per completed run | Automated run completion tracking |

### Gameplay Metrics

| Metric | Target | What it tells you |
|---|---|---|
| Run completion rate | ≥60% of started runs reach the boss | Run length and difficulty are calibrated |
| Same-session return rate | ≥50% of groups start a second run | Core loop is working |
| Class distribution | No single class selected >40% of runs | Pillar 2 (class asymmetry) is landing |
| Abilities used per minute | TBD baseline — measured in playtesting | Pillar 1 (high-frequency action) validation |
| Spirit Bond acknowledgement | Players visually react to bond assignment (move toward/away from bonded partner) | Bond system is readable and understood |

[NOTE FOR DESIGNER: Spirit Bond acknowledgement requires observational playtesting — not instrumentable automatically. Include in first playtest session script.]

---

## Out of Scope

### Permanently out of scope (not planned for any version)

- **PC controller or keyboard as player input** — mobile phones are the only controllers; this is a core design constraint, not a missing feature. The join flow, QR code model, and Pillar 4 depend on it.

### Deferred to post-launch

- **Online / remote multiplayer** — Local Party Mode only at launch; Online/Remote Mode is a planned future phase (Phase 5 in the project roadmap), requiring region-aware deployment, prediction, reconciliation, and reconnect recovery
- **More than 2 biomes** — Grassland and Ancient Forest at launch; additional biomes are post-launch content
- **Additional character classes** — 10 classes ship at launch; new classes are post-launch
- **Additional difficulty tiers** — Easy / Normal / Hard only; further tiers post-launch
- **Consumable mid-run item drops** — Spirit Essence only in v1.0; consumables considered post-launch
- **Narrative campaign / story mode** — lore exists and is documented, but no authored story progression or cutscene sequences in v1.0
- **PvP / competitive modes** — pure co-op only
- **Additional level objective types** — v1.0 ships with Clear and Survive the Waves only
- **Controller input remapping** — ability layout is fixed per class; no custom remapping in v1.0

---

## Assumptions and Dependencies

<!-- TBD -->
