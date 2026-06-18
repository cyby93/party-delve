# Party Delve — GDD Decision Log

## Session: 2026-06-13

### Confirmed Decisions

| # | Decision | Detail | Source |
|---|---|---|---|
| 1 | Game type | Co-op action roguelike | Discovery |
| 2 | Perspective | Isometric 3/4 view (PixelLab high-top-down) | Designer |
| 3 | Player count | 3–8 players | Designer |
| 4 | Setting | Tribal spirit-nature fantasy; powers from spirits, nature, animal aspects | Designer |
| 5 | Controller layout | Mobile: left half = movement joystick, right half = 4 ability slots | Designer |
| 6 | Death model | Per-player escalating revive timer: 60/40/20/10/5/2s | Designer |
| 7 | Expired timer state | Spirit form — player short-handed but alive with minor contribution | Designer |
| 8 | Session start | Frictionless: QR code scan → instant join, no registration required | Designer |
| 9 | Player model | Guest (instant play) + Registered (persistent progression: skills, enhancements, skins) | Designer |
| 10 | Hub world | Tribe village pre-run hub (campfire, NPCs, buildings, ability dummies) | Designer |
| 11 | Level generation | Procedural (at least partial / modular) | Designer |
| 12 | Teamplay axis | Synergies between abilities, minor level puzzles, boss mechanics merging prior mechanics | Designer |
| 13 | Pillar 1 | High-Frequency Action — 1–2s ability cycles, reaction time is a real skill | Designer |
| 14 | Pillar 2 | Radical Class Asymmetry — no shared archetypes, distinct roles and power fantasies | Designer |
| 15 | Pillar 3 | Boss as Climax — every boss synthesizes prior level mechanics | Designer |
| 16 | Pillar 4 | Zero Barrier to Together — QR scan to play, frictionless social entry | Designer |
| 17 | Core gameplay loop | Hub → Queue (vote) → Dungeon levels → Boss level → Victory → Hub | Designer |
| 18 | Replay driver 1 | Registered progression changes how runs play (not just numbers) | Designer |
| 19 | Replay driver 2 | Per-biome achievements | Designer |
| 20 | Replay driver 3 | Ability mastery (usage-count milestones) | Designer |
| 21 | Mastery rewards | Cosmetic + ability variants only; equal power level, different feel/visual | Designer |
| 22 | Ability input types | Joystick-AutoFire, Joystick-Release, Tap — any mix per class, not standardized | Designer |
| 23 | Cooldown philosophy | Class-specific; every class has ≥1 ability ≤3s (Pillar 1 floor) | Designer |
| 24 | Full class roster | All 10 classes ship at v1.0 | Designer |
| 25 | Spirit Bond System | Accumulating bonds (1 per level); always positive + always has a price | Designer |
| 26 | Bond accumulation | 3 bonds active by boss fight; bonds from prior levels persist | Designer |
| 27 | Run structure detail | Nothing between levels by default; Spirit Bond assigned as the transition moment | Designer |
| 28 | Core lore premise | The Corruption — ancestral spirits corrupted; warriors purify territories | Designer |
| 29 | Hub village meaning | Last uncorrupted sanctuary; campfire is a ward; warriors prepare and return here | Designer |
| 30 | Launch biomes | Grassland (v1 alpha) + Ancient Forest (v1.0 launch) | Designer |
| 31 | Narrative flag | Full lore (names, mythology, corruption origin) deferred to gds-create-narrative session | Designer |
| 32 | Currency | Spirit Essence — single in-run currency; spent in hub on skins and enhancements | Designer |
| 33 | Mastery variant power | REVISED from #21: mastery variants have minimal but felt power increase (not equal power) | Designer |
| 34 | Registered progression | Skins (cosmetic) + Enhancements (slight power) + Mastery variants (usage-count unlocked) | Designer |
| 35 | Guest vs registered balance | Guests have full class access; registered players have slight mastery edge; structural parity maintained | Designer |
| 36 | Difficulty tiers | Easy / Normal / Hard at launch | Designer |
| 37 | Enemy count scaling | Scales with player count (not difficulty) | Designer |
| 38 | Difficulty approach | Behavior-tiered: each difficulty tier adds enemy behaviors, not just stat inflation | Designer |
| 39 | Revive timer reset | Per run (not per level) — carries through all 3 levels | Designer |
| 40 | Art palette | Warm and earthy — ochres, deep greens, firelight oranges | Designer |
| 41 | Corruption aesthetic | Soul Cracks — void fractures with glowing eyes and cracks; wrong-colored glow (purple/acid/red) | Designer |
| 42 | Audio direction | Ambient nature baseline; tribal drums/chanting; combat eerie-dark but not horror; boss has distinct signature | Designer |
| 43 | PC/keyboard input | Permanently out of scope — phones are the only controllers, by design | Designer |
| 44 | Out of scope confirmed | Online MP, biomes >2, classes >10, difficulty tiers >3, consumables, campaign, PvP, input remapping | Designer |
| 45 | Spirit Bond host display | Visual tether with distinct colors per bond; simplify to aura/HUD if particle budget requires | Designer |
| 46 | Alpha prototype scope | 4 classes (Stonehide, Spiritcaller, Souldrinker, Stormcaller); GDD supersedes prior 2-archetype spec | Designer |
| 47 | Seed determinism scope | All procedural decisions (layout, rooms, enemies, bonds) derived from single shared run seed | Facilitator |
| 48 | Online/Remote Mode | Explicitly Phase 5 future target (prediction, reconciliation, region-aware deployment) | Facilitator |

---

## Finalization — 2026-06-15

GDD facilitative session complete. All major sections authored. Open items documented (OI-2, OI-6, partial reward rules, multi-bond rule). Epics.md created (E1–E10). Narrative flag set — gds-create-narrative recommended for world-building.

**Artifacts:**
- `gdd.md` — complete
- `epics.md` — placeholder (detailed in gds-create-epics-and-stories)
- `decision-log.md` — 48 decisions logged

### Open Items

| # | Item | Notes |
|---|---|---|
| OI-1 | Revive timer reset scope | Per run? Per room? |
| OI-2 | Spirit form abilities | What can a permanently downed player do? |
| OI-3 | Number of character classes | Total roster size |
| OI-4 | Run / session length | Target minutes for a full run |
| OI-5 | Ghost ability specifics | Needs definition in mechanics |
| OI-6 | World/lore name | Name for the world, factions, spirits |

---

## Corrections — 2026-06-18

| # | Decision | Detail | Source |
|---|---|---|---|
| C1 | Ability slot layout | CORRECTED: fixed 2×2 grid, standardized across all classes — only cell contents differ per class (prior text said "class-specific layout, not standardized") | UX session |
| C2 | Join flow authority | SUPERSEDED: §Platform-Specific Details join flow text replaced by reference to `EXPERIENCE.md` (ux-party-delve-2026-06-16), which is now the authoritative source for phone and host join flow UX | UX session |

---

*Entries added as decisions are made during facilitative session.*
