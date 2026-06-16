# Tribal Fantasy Class Workshop

This document expands the tribal fantasy class roster into a design-ready class workshop for future implementation. The class work is grounded in the existing project goals: clear role identities, strong co-op readability, four special skills per character in the prototype, and a controller scheme centered on movement plus a 2x2 skill grid [1][2]. The project also prioritizes team coordination, revive tension, readable host-screen combat, and a staged vertical-slice approach rather than fully solving all progression and content questions up front [3][4][2].

## Design frame

The current class roster already defines ten tribal fantasy archetypes with clear role buckets and co-op hooks, which makes it a strong foundation for detailed class development [1]. The next useful step is not final balancing, but a structured brainstorming layer that locks down fantasy identity, gameplay loop, skill direction, and narrative texture for each class before implementation starts [3][2].

The prototype combat model assumes that each character has exactly four special skills, that revive is a shared team action, and that readability on the host screen matters more than complex button combinations [2]. Because of that, every class concept below is designed around short readable verbs, distinct team purpose, and an identity that can be visually understood at a glance on a shared display [4][1][2].

## Brainstorming method

A practical multi-step class pipeline for this project is:

1. Lock the fantasy promise of the class, meaning what a player should feel when choosing it.
2. Define the battlefield job, meaning what problem the class solves for the team.
3. Define the class rhythm, meaning whether it plays as proactive, reactive, setup-based, burst-based, or sustain-based.
4. Sketch four ability slots that fit the mobile control layout and support readable host-screen action [2].
5. Add a short cultural or mythic backstory so the class belongs to the same world as the rest of the roster [1].
6. Only after that move into numbers, cooldowns, and content pipeline implementation [4].

This order fits the broader project plan because class identity work is supposed to feed later gameplay specs, content definitions, and prototype validation rather than getting lost in premature balance tuning [3][4].

## Shared world assumptions

All ten classes should feel like they come from related tribes, rites, or ancestral traditions rather than from ten unrelated fantasy schools. That means materials, silhouettes, masks, feathers, bones, drums, carved stone, spirit paint, and animal-totem motifs should repeat across the roster, while each class still owns a clear visual language of its own [1].

The game also benefits from classes that are legible at distance, because players are meant to watch the host display rather than the phone controller [4]. In practice, each class should therefore have one instantly recognizable movement pattern, one obvious effect language, and one obvious contribution to team play, such as anchoring, recovery, zoning, flanking, or rescue [4][1][2].

## Roster overview

| Class | Primary role | Core play rhythm | Team function |
|---|---|---|---|
| Stonehide | Guardian | Slow, committed, space-holding | Anchor frontline and absorb pressure [1] |
| Sunwarden | Guardian / Healer | Reactive protection | Prevent collapse and stabilize allies [1] |
| Spiritcaller | Healer | Reactive recovery | Burst heal, revive, and recovery safety net [1] |
| Wildshaper | Healer / Support | Adaptive stance play | Fill gaps and reshape local fight flow [1] |
| Songweaver | Support | Timing and tempo | Synchronize team power windows [1] |
| Trailhunter | Damage / Utility | Setup and pickoff | Mark targets and control safe engagements [1] |
| Shadowstalker | Damage / Control | Burst and reposition | Remove priority threats and open windows [1] |
| Stormcaller | Damage / Control | Area pressure | Zone enemies and reshape encounter space [1] |
| Souldrinker | Damage | Risk-reward sustain | Convert danger into offense through drain [1] |
| Windwalker | Utility / Support | Fast reactive intervention | Rescue, interrupt, and reposition allies [1] |

## Stonehide

### Class fantasy
Stonehide is the living image of endurance, a warrior who carries the patience and weight of the great horned beast. Choosing Stonehide should feel like becoming the center of gravity in a chaotic fight, the one character who says, in gameplay terms, "stand behind me and hold" [1].

### Small backstory
Stonehide warriors are said to undertake a season of isolation among the wind-cut plains, where they learn to listen to the footfall of the herd and the silence before a charge. Those who return are marked with stone ash and horn carvings, and serve as the first wall between their people and the darkness beyond the fireline.

### Playstyle
Stonehide should be low-panic, high-commitment, and easy to read. The player is rewarded for stepping into danger early, owning space, and turning enemy attention away from more fragile allies. This is a class for players who like certainty, positional leadership, and visible team value.

### Ability direction
- A taunt or challenge tool that forces enemy attention.
- A damage reduction or guard stance that rewards timing against telegraphed attacks.
- A ground slam or horn surge that interrupts or displaces nearby enemies.
- A territory skill that creates a defensive zone allies want to stand near.

### Co-op role
Stonehide is the team’s anchor. It makes revives safer, lets ranged or support classes operate more freely, and turns messy fights into readable fronts [1][2].

### Design notes
Stonehide should probably be among the first prototype classes because it expresses positioning, telegraph response, and group safety very clearly in a vertical slice [4][1].

## Sunwarden

### Class fantasy
Sunwarden is a protector marked by heat, radiance, and ritual duty. The fantasy is not a priest standing behind the line, but a luminous guardian who walks into danger and answers corruption with warmth, cleansing, and warding light [1].

### Small backstory
Sunwardens are chosen during the longest day, when elders test who can carry a burning sigil across sacred ground without letting it fall dark. Their masks are painted in dawn colors, and they are taught that light is not mercy alone, but the discipline to remain standing when others falter.

### Playstyle
Sunwarden sits between tank and support. The class should reward players who enjoy protecting one ally at the exact right moment, peeling pressure off teammates, and keeping the team stable without surrendering frontline presence.

### Ability direction
- A targeted ward that reduces incoming damage on an ally.
- A short-range cleansing flare that removes a debuff or hostile mark.
- A solar pulse that damages enemies while lightly healing nearby allies.
- A high-impact radiant bastion or consecrated ground ultimate-like cooldown.

### Co-op role
Sunwarden is a collapse-prevention class. It covers mistakes, helps revive windows succeed, and gives less coordinated groups a forgiving layer of protection [1][2].

### Design notes
Sunwarden should visually contrast Stonehide: less mass, more light, more ceremonial geometry. That helps role readability on the host screen [4][1].

## Spiritcaller

### Class fantasy
Spiritcaller is the voice between the living and the ancestral dead. This class should feel calm in moments when the fight becomes desperate, with the fantasy centered on guidance, remembrance, and the refusal to let allies vanish before their time [1].

### Small backstory
When a tribe survives a famine, war, or long migration, one child is often raised among the memory keepers to learn the names of the lost. These children become Spiritcallers, carrying strings of tokens and ash-charms so that the ancestors may still speak when fear drowns out the living.

### Playstyle
Spiritcaller is reactive and timing-heavy. It should not dominate through damage, but through clutch intervention, healing spikes, and recovery sequencing. This is a class for players who enjoy awareness, triage, and saving failed situations.

### Ability direction
- A direct burst heal for a single ally or tight cluster.
- A spirit tether that softens incoming damage or redirects a fraction of harm.
- A revive-support skill that speeds, shields, or secures revive attempts.
- A major ancestral blessing with strong recovery impact and long cooldown.

### Co-op role
Spiritcaller is the team’s safety net and morale engine. In a game built around downed states and revive tension, that role is highly valuable in both testing and live balance [2].

### Design notes
Because revive and recovery are central parts of the combat loop, Spiritcaller is an excellent prototype candidate for validating whether support gameplay feels active rather than passive [4][2].

## Wildshaper

### Class fantasy
Wildshaper is not a druid in the classic robe-and-staff sense, but a person whose body and spirit move with the moods of the wild. The fantasy is about adaptation, partial transformation, and using the living world as both shelter and weapon [1].

### Small backstory
Wildshapers leave their tribe for a season and return changed by what accepted them in the deep places: claw marks that never fade, bark-like scars, luminous eyes, or voices that echo with birds and beasts. They are respected and mistrusted in equal measure, because no one is ever certain where the person ends and the wilderness begins.

### Playstyle
Wildshaper should feel flexible and expressive. It can answer pressure with sustained healing, answer chaos with roots or brush, or briefly take on a bestial stance to solve an immediate problem. This class is ideal for players who like improvisation over fixed execution.

### Ability direction
- A heal-over-time effect tied to growth, vines, spores, or renewal.
- A rooting or slowing zone that changes local movement patterns.
- A temporary form-shift for escape, support, or control.
- A terrain-linked ability that becomes stronger when placed well.

### Co-op role
Wildshaper is the adaptable glue class. It is especially useful in runs where the team composition is imperfect, because it can cover several secondary needs without replacing a specialist [1].

### Design notes
Wildshaper needs strict readability rules so shapeshift ideas do not become visually noisy on the shared screen. The shift should alter purpose clearly, not just cosmetics [4][2].

## Songweaver

### Class fantasy
Songweaver channels ceremony into combat through chant, drum, and pulse. The class should feel like the keeper of collective momentum, someone who turns a group of individuals into a coordinated force through rhythm and shared timing [1].

### Small backstory
Songweavers memorize not only songs of celebration, but songs used to cross storms, bury the fallen, call hunters home, and challenge enemies before battle. In war, they do not stand apart from danger; they shape the heartbeat by which the whole tribe moves.

### Playstyle
Songweaver is a tempo class. Rather than providing only background buffs, it should encourage players to align actions with beats, windows, crescendos, or marked moments. This class is most fun when the team can feel the timing together in real space.

### Ability direction
- A quick buff pulse that rewards allies near the Songweaver.
- A debuff chant that weakens enemy damage or resistance.
- A rhythm marker that creates a brief synchronized power window.
- A large ceremonial performance ability that swings the pace of the encounter.

### Co-op role
Songweaver amplifies the entire party and gives team coordination a satisfying structure. It is one of the best classes for expressing couch co-op synergy as a core fantasy [3][1][2].

### Design notes
If timing mechanics are used, they should remain generous and readable. The goal is shared energy, not rhythm-game punishment [4][2].

## Trailhunter

### Class fantasy
Trailhunter is the patient reader of signs, a hunter who sees the path of danger before others do. This class should feel clever, precise, and deliberate, with a focus on setting terms for the fight rather than simply reacting after chaos begins [1].

### Small backstory
Trailhunters are taught to read broken grass, strange scents, disturbed birds, and the wrong kind of silence. When monsters began crossing old borders, these hunters became more than providers; they became the first to know what was coming, and often the last to leave a wounded trailmate behind.

### Playstyle
Trailhunter is a ranged setup class. The player should enjoy planning shots, placing traps, marking targets, and helping the team pick favorable engagements. It is ideal for players who prefer control through preparation rather than pure speed.

### Ability direction
- A marked shot that makes one target easier for the team to pressure.
- A trap or snare that controls movement routes.
- A scouting reveal or threat-sense pulse.
- A committed kill-shot or volley with strong payoff if setup succeeds.

### Co-op role
Trailhunter helps the team choose how fights begin and which targets matter first. That improves encounter readability and supports strategic target priority in the MVP enemy set [1][2].

### Design notes
Trailhunter should not feel like a generic ranger. The totemic tracking fantasy is more important than conventional fantasy archery tropes [1].

## Shadowstalker

### Class fantasy
Shadowstalker is the tribe’s silent answer to monsters that must die quickly. The class should feel like predatory instinct sharpened into ritual, whether the inspiration is panther, owl, wolf, or another night-born totem [1].

### Small backstory
Some hunts are never spoken of around the fire. Those who return from them are said to have learned the language of stillness, the patience to wait with the night itself, and the mercy of ending a threat before it reaches the camp. Shadowstalkers are honored, but rarely understood.

### Playstyle
Shadowstalker is an opportunistic burst class. It thrives on angle-finding, timing, and striking when the enemy is exposed, isolated, or marked. This class is perfect for players who want agency, aggression, and quick decisive moments.

### Ability direction
- A pounce, blink, or shadow-dash initiation.
- A finisher that rewards striking a weakened or exposed target.
- A fear, disorient, or vulnerability application.
- A stealth-adjacent or misdirection tool that enables re-engage windows.

### Co-op role
Shadowstalker converts team-created openings into kills. It synergizes naturally with Trailhunter marks, Stonehide control, and Stormcaller zones [1][2].

### Design notes
The class should be dangerous but readable. Full invisibility may be harder to support in a host-screen game than brief concealment or silhouette fading [4][2].

## Stormcaller

### Class fantasy
Stormcaller is a battlefield shaman whose presence feels like pressure in the air before lightning breaks. This class should embody elemental force, spectacle, and the ability to tell enemies where they are allowed to stand [1].

### Small backstory
Stormcallers are initiated on exposed heights where thunder is said to answer only those who do not flinch. They return marked by static scars and feathered charms, and are asked to guide the tribe when weather, omens, and war all say the same terrible thing.

### Playstyle
Stormcaller is a control-focused damage dealer. The class is strongest when enemies are clustered, routed into zones, or forced to respect dangerous ground. This is for players who enjoy shaping the whole encounter instead of only one target.

### Ability direction
- A lightning strike or chain effect for grouped enemies.
- A wind wall, storm field, or hazardous zone.
- A displacement gust or pull that changes enemy placement.
- A dramatic storm rite cooldown that creates a major control window.

### Co-op role
Stormcaller creates structure inside chaos. It helps the whole team read where pressure is highest and makes area denial an explicit tactical tool [1][2].

### Design notes
Because the class is highly visual, effect clarity matters. The spectacle must support readability, not overwhelm it on the host display [4][2].

## Souldrinker

### Class fantasy
Souldrinker is a ritual predator who turns stolen essence into survival and strength. The class should feel dangerous, hungry, and a little taboo within the world, but still rooted in tribal spirituality rather than in imported gothic horror [1].

### Small backstory
Among some tribes there are rites forbidden in daylight, rites performed only when a hunter must survive what should have killed them. Those who return carrying the mark of essence-hunger are never fully celebrated, yet when the old protections fail, it is often the Souldrinker who walks willingly into the place others fear to touch.

### Playstyle
Souldrinker is the most explicit risk-reward class in the roster. It should spend health, expose itself, or operate near danger in order to scale damage and then reclaim safety through draining life force. This class is for players who enjoy controlled greed and clutch self-recovery.

### Ability direction
- A drain beam, tether, bite, or siphon strike.
- A self-sacrifice buff that converts health into offensive power.
- An execution or harvest tool that spikes on weakened targets.
- A survival skill that turns stolen essence into shielding, healing, or temporary invulnerability.

### Co-op role
Souldrinker rewards aggressive team coordination. Other classes create windows, hold enemies in place, or protect the Souldrinker long enough for it to cash in on its dangerous power cycle [1][2].

### Design notes
This class needs careful tuning later, but the design fantasy is already strong. For a prototype, its health-for-power mechanics should be dramatic enough to feel unique but simple enough to read without extra HUD burden [4][2].

## Windwalker

### Class fantasy
Windwalker is the fast-moving rescuer, scout, and interrupter whose strength lies in arriving exactly where the team needs help. The fantasy is speed with purpose, not speed for its own sake [1].

### Small backstory
Windwalkers train on cliff paths, river stones, and rope bridges where a single missed step means falling. They carry little armor and few trophies, because their duty is not to stand glorious in battle, but to cross impossible distance before someone else dies.

### Playstyle
Windwalker is reactive, mobile, and supportive. The player should dart between threats, save allies from bad positions, interrupt key enemy actions, and convert near-failures into recoverable states. It is ideal for players who enjoy awareness and movement mastery.

### Ability direction
- A fast dash or traversal tool that ignores minor obstacles.
- An interrupt kick, gust, or disarm.
- An ally pull, escort, or reposition effect.
- A rescue-field or movement-boosting team utility skill.

### Co-op role
Windwalker is the team’s answer to distance and timing problems. In encounter design terms, it helps the group survive split mechanics, risky revives, and sudden boss telegraphs [1][2].

### Design notes
Windwalker should remain readable even at high speed. Trails, silhouettes, and destination clarity are important in a shared-screen game [4].

## First-pass ability template rules

To keep prototype implementation efficient, every class should use a similar internal ability template structure even if the fantasy differs [4][2]. A useful first-pass structure is:

- Slot 1: low-cooldown identity skill.
- Slot 2: situational control or utility skill.
- Slot 3: stronger signature playmaker.
- Slot 4: long-cooldown class-defining moment.

This supports the existing 2x2 controller layout and helps teams learn classes quickly in early playtests [2].

## Recommended next brainstorming passes

The next best way to continue is a staged workshop rather than trying to fully finalize all ten classes at once [3][4]. A productive sequence would be:

1. Define one-line fantasy promise and one-line gameplay promise for all ten classes.
2. Lock each class’s four skill slot purposes before naming the exact abilities.
3. Identify major synergy pairs, such as Stonehide plus Spiritcaller or Trailhunter plus Shadowstalker [1][2].
4. Write a short backstory paragraph and visual motif sheet for each class.
5. Convert the best two to four classes into prototype-ready skill kits for the vertical slice [4][2].
6. Only then expand the remaining roster to full implementation detail.

## Prototype recommendation

For the first implementation-friendly pass, the strongest classes to detail next are Stonehide, Spiritcaller, Souldrinker, and Stormcaller. Together they test frontline anchoring, recovery, risk-reward offense, and area control, which covers a broad range of the combat loop’s most important team decisions [4][1][2].