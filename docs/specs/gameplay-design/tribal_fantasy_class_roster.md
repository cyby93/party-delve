# Tribal Fantasy Class Roster

## Design Goals
- Create a readable 8-10 class roster for a local couch co-op fantasy dungeon crawler.
- Use a tribal, animal, and totem-inspired aesthetic instead of a classic high-fantasy class set.
- Ensure each class has a clear combat role, a strong fantasy identity, and a distinct co-op hook.
- Keep roles easy to understand on a shared host screen and easy to support in future balancing.

## Role Buckets
- **Guardian**: absorbs pressure, protects allies, holds space.
- **Healer**: restores health, revives, cleanses, and maintains team sustain.
- **Support**: buffs, debuffs, tempo control, and team-wide utility.
- **Damage Dealer**: focused single-target or sustained damage.
- **Damage Dealer / Control**: damage with strong area control, disruption, or zoning.
- **Utility / Support**: movement, interrupts, repositioning, and tactical assistance.

## Final Class Roster

| Class | Role | Identity | Combat Fantasy | Co-op Hook |
|---|---|---|---|---|
| Stonehide | Guardian | A buffalo-spirit frontline warrior who endures through raw resilience. | Hold the line, taunt enemies, and protect the team from burst damage. | Creates safe space for fragile allies and anchors positioning in fights. |
| Sunwarden | Guardian / Healer | A sun-spirit protector who shields allies with radiant rites. | Provide defense, small heals, and cleansing support while staying on the front edge. | Stabilizes the team during dangerous moments and prevents wipe states. |
| Spiritcaller | Healer | A keeper of ancestral spirits who channels the dead for protection and renewal. | Burst heal, revive, and blessing-based support. | The emergency recovery specialist who keeps runs alive after mistakes. |
| Wildshaper | Healer / Support | A nature-bound shapeshifter who adapts to the battlefield. | Heal-over-time, zone control, and form-based utility. | Flexible responder who can fill gaps in team needs mid-run. |
| Songweaver | Support | A tribal singer or drum-keeper who bends morale and rhythm. | Buff allies, weaken enemies, and manipulate combat tempo. | Makes the whole party stronger when players coordinate timing well. |
| Trailhunter | Damage Dealer / Utility | A tracker and hunter who reads the land and stalks prey. | Ranged damage, traps, scouting, and target marking. | Helps the team with vision, safe pulls, and controlled engagements. |
| Shadowstalker | Damage Dealer / Control | A night predator inspired by panther, wolf, or owl energy. | Burst damage, flank attacks, and enemy weakening. | Excels at picking off key targets and creating openings for the team. |
| Stormcaller | Damage Dealer / Control | A storm-shaman who commands wind, lightning, and terrain pressure. | Area damage, elemental control, and battlefield denial. | Shifts encounter space and helps the team manage enemy clusters. |
| Souldrinker | Damage Dealer | A ritual predator who steals essence and grows stronger by consuming life force. | Risk-reward damage dealer with self-sustain through drain mechanics. | Trades safety for power and rewards coordinated aggression and timing. |
| Windwalker | Utility / Support | A swift tribal skirmisher who moves like the wind and interrupts danger. | Mobility, interrupts, ally repositioning, and rescue utility. | Helps the team recover from bad positioning and react to threats quickly. |

## Class Design Notes

### Stonehide
Stonehide should feel like the safest first-class pick for players who want to stand in front and make the fight easier for everyone else. The fantasy should communicate bulk, endurance, and animal strength, not just armor. In play, this class should excel at holding aggro, body-blocking, and absorbing dangerous enemy pressure.

### Sunwarden
Sunwarden sits between tank and support, which makes it ideal for players who want to protect others without becoming a pure healer. Its identity should feel warm, protective, and sacred rather than aggressive. The class can use sun symbols, masks, feathers, or totems to create a bright tribal protector aesthetic.

### Spiritcaller
Spiritcaller is the most direct revive-and-recovery class in the roster. The fantasy should lean into ancestor communication, ritual chants, and spirit companions rather than standard cleric imagery. This class should be the most reliable source of burst healing and ally recovery in emergencies.

### Wildshaper
Wildshaper should feel adaptable and organic, almost like a living extension of the wilderness. It can shift between healing, support, and battlefield shaping depending on ability choices. This class is strongest when it reacts to changing situations rather than following a fixed rotation.

### Songweaver
Songweaver is the team’s rhythm engine, and its fantasy should be strongly tied to drums, chants, and ceremonial performance. Instead of raw numbers, it should reward timing, coordination, and group synergy. This makes it a perfect support class for a couch co-op game where players can feel each other’s pacing.

### Trailhunter
Trailhunter should be readable as a smart ranged hunter, not a generic archer. The class fantasy can use tracking marks, traps, feathers, and beast companions or animal-inspired totems. Its role is to create safe, deliberate fights by revealing threats and controlling approach paths.

### Shadowstalker
Shadowstalker should deliver fast, decisive bursts with a predatory silhouette. The fantasy can lean into nocturnal animals, silent movement, and sudden strike behavior. It should reward players who can find the right angle and punish isolated targets.

### Stormcaller
Stormcaller should feel dramatic and dangerous, with large visual language around wind, thunder, lightning, and pressure zones. This is the class for players who want to control space and impact multiple enemies at once. It should be one of the strongest classes for crowd management and encounter shaping.

### Souldrinker
Souldrinker is the risk-reward damage class built around draining vitality and empowering itself through stolen essence. The fantasy should not be blood-goth; it should feel more like a ritual predator or spirit siphoner within the tribal world. This class should be powerful when played aggressively, but dangerous if the player misjudges survival windows.

### Windwalker
Windwalker should be the fastest and most reactive class in the roster. It can support the team through movement, interrupts, and quick saves rather than passive buffs. The class should make players feel like they are always in the right place at the right time, just before disaster happens.

## Implementation Notes
- Keep each class visually distinct using silhouette, color, and material language.
- Build a one-sentence identity, one-sentence role, and one co-op hook for each class in UI and design docs.
- Ensure role overlap is intentional and small, so every class feels unique in team composition.
- Use the roster as the basis for ability kits, unlock trees, and tutorial messaging.
- For the first vertical slice, consider starting with two classes that strongly contrast each other, such as Stonehide and Spiritcaller, or Stonehide and Souldrinker.

## Recommended First Slice Pairing
A strong first prototype pair would be:
- **Stonehide** for the defender/tank fantasy.
- **Spiritcaller** for recovery and revive support.

If you want a more aggressive contrast, use:
- **Stonehide** for stability.
- **Souldrinker** for risk-reward offense.

This gives the first playable slice a clear tactical identity and makes team cooperation immediately understandable.
