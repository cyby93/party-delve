# Party Delve — Development Epics

*Detailed epic and story breakdown. Summary sequence lives in `gdd.md`.*

*Status: placeholder — to be detailed in `gds-create-epics-and-stories` session.*

---

## E1 — Foundation Platform

**Goal:** Host client, mobile controller client, and simulation server all running and connected. Players can join via QR code and appear in a placeholder hub.

**In scope:**
- Host rendering client (shared screen)
- Mobile controller client (QR join + guest/registered flow)
- Simulation server (authoritative tick loop)
- QR code session creation and join
- Placeholder hub (blank scene, players can move)

**Out of scope:** Art, classes, enemies, any gameplay mechanics

**Playable deliverable:** 3+ players join via QR code and see each other move on a shared host screen

**Dependencies:** None

---

## E2 — Hub World

**Goal:** Tribe village hub with all POIs functional.

**In scope:**
- Hub village art and layout (campfire, NPCs, buildings)
- Class selection POI (shows all 4 alpha classes)
- Training dummies (ability sandbox)
- Skin/cosmetics station (stub)
- Dungeon entrance POI (biome/difficulty selection + all-accept vote)

**Playable deliverable:** Players explore the hub village, pick a class, try abilities on dummies, vote to enter dungeon

**Dependencies:** E1

---

## E3 — Core Combat (4 Alpha Classes)

**Goal:** 4 classes fully playable with all abilities; basic enemy types; Clear objective functional.

**In scope:**
- Stonehide, Spiritcaller, Souldrinker, Stormcaller — all 4 abilities each
- 2–3 basic enemy types (Grassland biome)
- Enemy behavior tier: Easy only
- Clear objective (kill all enemies → level complete)
- Per-player revive timer (60s on first down)
- Spirit form state (stub contribution)

**Playable deliverable:** Team of 3–4 fights through a single room with the 4 alpha classes

**Dependencies:** E1, E2

---

## E4 — Procedural Dungeon

**Goal:** 3-level procedural run structure with room pool.

**In scope:**
- Procedural floor layout generator (deterministic seed)
- Handcrafted room pool (minimum 8 rooms per biome tier)
- 3-level escalation (enemy count/tier increases)
- Survive the Waves objective type
- Level transition flow (level complete → Spirit Bond assignment screen → next level load)

**Playable deliverable:** Full 3-level run with procedural maps and both objective types

**Dependencies:** E3

---

## E5 — Spirit Bond System

**Goal:** Spirit Bonds assigned at level end; host screen tether display; minimum 3 bond types.

**In scope:**
- Bond assignment logic (random pair selection per level)
- 3 bond types with buff + price mechanics
- Visual tether on host screen (colored per bond)
- Bond HUD indicators on mobile (which player am I bonded to, what's the bond)
- Accumulation: 1 bond after level 1, 2 after level 2, 3 at boss

**Playable deliverable:** Full run with all 3 bonds active at boss; bonds are visible and felt

**Dependencies:** E4

---

## E6 — Boss Encounter

**Goal:** Grassland biome boss; behavior-tiered across all 3 difficulties; synthesizes E3 mechanics.

**In scope:**
- Grassland boss design and implementation
- Boss behavior on Easy / Normal / Hard (behavior-tiered)
- Boss arena (handcrafted)
- Victory sequence (reward reveal, run summary screen)
- Partial rewards on run failure

**Playable deliverable:** Complete 30-minute run from hub to boss defeat to hub return

**Dependencies:** E5

---

## E7 — Progression and Meta

**Goal:** Spirit Essence economy, mastery counters, hub shop, guest vs registered distinction.

**In scope:**
- Spirit Essence drop and accumulation
- Mastery counter per ability per class
- First mastery milestones (2–3 per alpha class)
- Hub shop (skins, enhancements)
- Guest vs registered session flow
- Account creation and persistence

**Playable deliverable:** Registered player completes 5 runs and has visible progression; guest plays alongside with no disadvantage

**Dependencies:** E6

---

## E8 — Full Class Roster

**Goal:** Remaining 6 classes playable; all 10 available at class selection POI.

**In scope:**
- Sunwarden, Wildshaper, Songweaver, Trailhunter, Shadowstalker, Windwalker — all abilities
- Mastery counters for all 10 classes
- Class selection UI updated for full roster

**Playable deliverable:** Any team composition from 10 classes works in a full run

**Dependencies:** E7

---

## E9 — Ancient Forest Biome

**Goal:** Second biome fully playable with its own enemy pool, boss, and achievements.

**In scope:**
- Ancient Forest visual assets and room pool
- Forest-specific enemy types (3+)
- Forest boss (behavior-tiered)
- Per-biome achievement sets (Grassland + Forest)
- Biome selection at dungeon entrance functional for both

**Playable deliverable:** Full run in Ancient Forest biome with achievements tracking

**Dependencies:** E8

---

## E10 — Polish and Metrics

**Goal:** Tuned difficulty, telemetry instrumented, UX polished, success metrics measurable.

**In scope:**
- Difficulty balance pass (all 3 tiers across both biomes)
- Telemetry instrumentation (session events, down/revive, bond assignments, completion time)
- Host screen readability pass
- Mobile UX polish (ability feedback, bond tether clarity)
- Input latency measurement and optimization to ≤100ms
- Session join time measurement and optimization to ≤10s

**Playable deliverable:** Launch-ready build passing all success metric targets

**Dependencies:** E9
