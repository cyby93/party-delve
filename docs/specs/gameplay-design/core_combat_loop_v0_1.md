# Core Combat Loop v0.1

## Purpose
This document defines the current combat loop for the couch co-op dungeon crawler prototype. It is intentionally lightweight and focuses on the smallest loop that can already validate fun, readability, co-op tension, and technical stability.

## Design Goals
- Fast, readable combat on the host screen.
- Simple mobile controller usage with a 2x2 skill grid.
- Strong co-op decisions through positioning, cooldown sync, and revive timing.
- Clear encounter failure state so team coordination matters.
- A combat system that is easy to prototype and easy to iterate.

## Combat Fantasy
Players are a coordinated party fighting through dungeon encounters where movement, skill timing, and team positioning matter more than raw combo complexity. Each character has four special skills, and these skills define the character’s role in combat.

## Core Loop
1. The party enters an encounter space.
2. Players move into position and read the enemy or objective state from the host screen.
3. Players use special skills to pressure enemies, support allies, or interact with encounter mechanics.
4. Enemies telegraph their actions before committing to attacks or area effects.
5. Players respond by moving, rotating, splitting, or synchronizing high-impact skills.
6. Key map positions become important for buffs, debuffs, or boss-specific mechanics.
7. If a player is downed, another player can revive them by staying next to them for 2 seconds.
8. If all players are downed at once, the encounter fails.
9. On success, the encounter resolves and the team receives progress or reward.

## Player Verbs
Every character shares the same baseline interaction rules.
- Movement.
- Revive: stand next to a downed ally for 2 seconds.
- Four special skills mapped to the 2x2 mobile skill grid.

There is no universal requirement that every character must have a basic attack, dodge, or standard defense skill. Those ideas can exist inside individual character kits only if they support the intended role.

## Skill System Rules
- Every character has exactly 4 special skills in the prototype.
- Skills may have different cooldown lengths.
- Some skills can be frequent and lightweight.
- Some skills can be high-impact, long-cooldown moments that require team timing.
- Skill identity should come from function, timing, and synergy, not from adding unnecessary controller complexity.

## Team Decision Rules
Combat should create decisions beyond direct enemy pressure.
- Players may need to occupy important map locations for buffs or debuffs.
- Some mechanics may require splitting into smaller groups.
- Some mechanics may reward grouping and synchronized skill use.
- Encounters should regularly ask the team to choose between safety, damage, revive, and objective control.

## Enemy Set For MVP
For the current prototype, the enemy roster can stay very small.
- 1 melee enemy.
- 1 ranged enemy.
- 1 miniboss.

That is enough to validate spacing, target priority, and encounter pacing.

## Telegraph Rules
Enemy telegraph means the enemy clearly shows an action before it becomes dangerous. This can be done with animation, sound, color, warning markers, or ground indicators. Telegraphing is important because players need time to read threats from the host screen and react without looking at their phones.

## Mobile Controller Layout
The current mobile control concept is valid for this combat loop.
- Thin header with exit/menu and similar session controls.
- Large control wrapper below it.
- Left side: movement joystick only.
- Right side: 2x2 skill grid.
- Each skill cell maps to one of the character’s four special abilities.

This layout supports quick input while keeping the player focused on the shared screen.

## Prototype Scope
The current combat prototype should include:
- Movement.
- 4 special skills per character.
- Downed state.
- 2-second revive interaction.
- 1 melee enemy.
- 1 ranged enemy.
- 1 miniboss.
- Basic telegraphing.
- At least 1 encounter that requires a team decision on map position.

## Non-Goals For v0.1
- Full progression system.
- Large enemy roster.
- Complex status effect systems.
- Deep buildcraft or itemization.
- Multiple combat modes.
- Advanced UI polish.

## Questions To Answer In The Next Version
- What exactly is the fantasy of each character role?
- How do the 4 skills differ between archetypes?
- Which encounters require splitting the team, and which reward stacking together?
- What are the exact rules for revive interruption, cancellation, or protection?
- What is the minimum amount of telegraph variety needed for readability?
- How do buffs and debuffs on map locations work?
- What makes the miniboss encounter distinct from normal rooms?

## Next Version Should Include
- Character archetype definitions and role identities.
- Exact skill kit templates for each archetype.
- Enemy behavior patterns for melee, ranged, and miniboss.
- Revive edge cases and interruption rules.
- Map objective types that force team positioning decisions.
- Cooldown philosophy for frequent skills vs. high-impact skills.
- Encounter pacing rules for early, mid, and late fight beats.
- UI feedback rules for skill readiness, downed state, and objective control.
