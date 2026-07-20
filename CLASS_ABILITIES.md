# Class Abilities — Test Reference

All 4 classes are implemented with a full 4-ability kit. Every player starts at **100 HP** (flat, no per-class variance). Source of truth: `packages/shared-types/src/class-definitions.ts` (names/input types) and `packages/game-rules/src/balance.ts` (numbers).

## How to test on the controller

Each class has 4 ability cells bound to one of these input types — how you touch the cell on the phone determines how it fires:

| Input type | How to trigger | Notes |
|---|---|---|
| `TAP` | Tap the cell once | Fires instantly at the player's position/facing, no aim drag |
| `RELEASE` | Press, drag to aim, lift finger to fire | Fires once, in the direction you were dragging when you released |
| `AUTO` | Press and hold, drag to aim | Fires repeatedly (every 33ms while held) — cooldown gates how often it actually lands server-side |
| `AIM_CAST` | Press and hold on target | Channels — used by Soul Mend to hold-cast a revive on a downed ally |

Cooldown ring on the cell shows time remaining. All 4 classes also get a 5th "Spirit" cell — only usable while your character is downed/ghosted — it's currently a visual-only cosmetic effect (`Earthen Vigil` / `Soul Tether` / `Void Drain` / `Storm Echo`, 5s cooldown), not a combat ability, so don't expect gameplay impact from it yet.

---

## Stonehide — Tank · Frontline Anchor
*"Called from the mountain clans, where endurance is prayer."*

| # | Ability | Input | Cooldown | Damage | Effect |
|---|---|---|---|---|---|
| 1 | Stone Wall | RELEASE | 2.0s | 15 | Pulls hit enemies toward the caster (displacement) |
| 2 | Tremor Stomp | TAP | 4.0s | 35 (AoE) | Slows enemies in zone 40% for 2s |
| 3 | Iron Skin | TAP | 6.0s | — (self buff) | 30% damage reduction on self for 3s |
| 4 | Avalanche | AUTO | 1.0s | 50 | Largest single hit in the kit; aim + hold |

## Spiritcaller — Burst Healer · Revive Support
*"Calls on the dead to protect the living. Timing is everything."*

| # | Ability | Input | Cooldown | Damage | Effect |
|---|---|---|---|---|---|
| 1 | Ancestor's Voice | AUTO | 1.5s | 15 dmg / 10 heal | Mixed-faction: hits enemies, heals allies caught in the same cone |
| 2 | Spirit Nova | TAP | 5.0s | 40 dmg / 30 heal | Expanding-radius sweep (grows to 220px over 600ms), mixed-faction |
| 3 | Soul Mend | AIM_CAST | 4.0s | — | Hold-to-channel full revive on a downed ally; 2.5s channel, cancels if you stop aiming/holding |
| 4 | Warding Cry | TAP | 6.0s | — (ally buff) | Shields allies in zone for 30 HP, 4s duration |

## Souldrinker — Drain DPS · Risk-Reward
*"The Bloodrite trade in sacrifice and return. Pain is currency."*

| # | Ability | Input | Cooldown | Damage | Effect |
|---|---|---|---|---|---|
| 1 | Blood Spike | AUTO | 1.0s | 12 (projectile) | Costs 10 HP to cast (capped at 1 HP floor), 50% lifesteal on hit |
| 2 | Crimson Lash | RELEASE | 3.0s | 30 base | Deals up to +100% more damage the lower your current HP is |
| 3 | Dark Pact | RELEASE | 5.0s | — | Drains 10% of a targeted ally's HP to grant self +25% damage for 4s (needs an ally in the forward cone to trigger) |
| 4 | Void Pulse | RELEASE | 4.0s | 25 (projectile) | On hit, spawns a pulling zone (150px radius, 2s duration) that drags enemies in |

**Test note:** to see Crimson Lash's low-HP scaling or Dark Pact's drain, you'll want a second player nearby and/or god mode toggled to control your own HP (see dev debug tools).

## Stormcaller — Zone DPS · Area Pressure
*"Where the shaman walks, the sky cracks open."*

| # | Ability | Input | Cooldown | Damage | Effect |
|---|---|---|---|---|---|
| 1 | Lightning Arc | AUTO | 1.0s | 18 | Basic aimed poke |
| 2 | Tempest Hurl | RELEASE | 3.0s | 40 | Longest range in the kit (200px) |
| 3 | Thunder Clap | TAP | 5.0s | 45 (AoE) | Self-centered burst |
| 4 | Storm Eye | RELEASE | 2.0s | — | Places a persistent zone (150px radius, 5s duration): 10 dmg tick every 0.5s + a bonus 30 dmg lightning strike every 1.5s |

---

## Quick manual test checklist
- [ ] Each ability fires on its correct input gesture (tap vs. hold-drag-release vs. hold-and-aim)
- [ ] Cooldown ring blocks re-fire until it completes
- [ ] Stonehide: Stone Wall visibly pulls an enemy in; Iron Skin visibly reduces incoming damage
- [ ] Spiritcaller: Ancestor's Voice/Spirit Nova heal allies caught in the same swing that hits enemies; Soul Mend actually revives a downed ally after the full channel
- [ ] Souldrinker: Blood Spike never drops you below 1 HP; Crimson Lash hits harder at low HP; Dark Pact requires an ally target
- [ ] Stormcaller: Storm Eye leaves a damage zone on the ground that ticks independently of the bonus strikes
