## extras
- I need a button which can exits the actual run and puts everyone back into the hub
- I need a training dummy poi in the HUB scene which can be used to test out abilities without starting an actual run -> currently if i want to test something i always have to jump in a run. 
- Currently i know of 3 POI: class selector, run selector and a third which is named 'train'. the 'train' can be removed because it has no use since abilities can be used freely in the HUB
- I can use abilities in the HUB, but cannot see any ability vfx
## controller
- when selecting a class, the ability preview section (at the bottom of the screen) the content overflows on the x axis: the 'pick selected class' does not fit into the view -> the button could be stretched in its wrapper on the x and y axis as well, plus the button text could be wrapped by each word OR it can be one word only: 'Select'

## VFX
We need to create some extra vfx to complete the baseline vfx bundle:
- the abilities which needs aiming should be render an aiming direction arrow or something. Thus, the user can see the actual aiming direction where the ability will be released (or fired automatically)
- we should develop further the vfx system to provide 'preview' for abilities that are aimed at a certain point or zone. for example, if i am playing stormcaller, i'd like to see the storm's eye ability destination -> where will be placed if I release the ability. Same should be achieved with other similar abilities like Stormhide's stone wall, souldrinker's dark pack and crimson lash


## class ability mechanical fixes to align with expectation
I want a new hit geometry type: CONE. hit every target in a cone shape in a targeted direction (the cone length and degree would be configurable).
Also, i'd like to update the current abilities a bit.

Stormhide:
- Stone wall: 
    - currently: this hits every enemy at a single point in a specific radius (configurable: the circle radius and its distance from the caster)
    - should be: CONE
- Avalance: hits in a point in a specific distance with a radius, but it should also hit in a CONE just like stone wall

Spiritcaller:
- ancestral voice: its hit shape should be CONE

Souldrinker:
- crimson lash: It should be a CONE shape

Stormcaller:
- Lightning Arc: This abilit currently hits at a specific point -> i want it to find the first target in the aimed direction and hit directly the first eligibe target. (basically a lightning struck the first enemy). Also, when an enemy is hit the lightning arc should bounce to additional enemies near its first hit (basically a chain lightning on enemies near to each other)
- Tempest hurl: It should be a projectile which fires a relative bigger projectile ball and moves relatively slowly and explodes when hitting an enemy (if its radius x, the blas should hit radius*2 area)
- Storm eye: The position should be configurable so i can tune wheter the area will be placed further from the character or closer (right now)