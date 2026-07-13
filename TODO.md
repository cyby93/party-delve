## known issues
- (controller) after joining a session, the phone does not force the user to rotate his phone -> after the the user joins a session the game should be played only while the phone rotated
- (host) on the hub, there should be no limitations for using the abilities -> currently, abilities can be used ONLY next to the trainer POI, but it is inproper. that poi will be used for something else. Players should be freely use any ability in the hub
- (controller) When the dungeon run proposal popup is displayed, the users does not have any rsponse whether the 'accept' button was already hit (it has no submitted state or anything like that) -> i'd like some state for the accept button when it is already pressed by the player
- (host) the boss does not take any damage from players
- (host) the boss does not have any floating damage numbers

## missing features
- (controller) the users should have the capability to put the game fullscreen on phone (so they have much more spae for the controller) -> it can be automatically set to fullscreen after the player joined a session and also there should be a button on the header bar that can be used to toggle the fullscreen mode
- (core) I need some debug feature where i can control a much more stronger character than in a base game in order to properly fight the boss alone or kill enemies with 1-2 players only. Unofrtunately, currently i die from 3-4 enemy alone and the boss almost 1-hits me -> I want a game state where the players are invincible and deals much more damage so i can test everything thats in the game. I can accept any other suggestion for this feature as well
- (host) I want the player health points to be restored to full on level transitions
- Before we advance to the last four epics, but before i start to create the actual sprites for anything, i would really need some more placeholder vfx for the abilities, in order to 

## features that are not working as intended
- the player's alive and spirit state is wrongly implemented: The players alive state is perfect, but when they downed their downed 'body' and their 'spirit' should be two distinct entity -> when a player downed, their body should stay in place and spawn it's spirit which will be controlled by the player. In that way the other players has to reach the body, in order to revive the downed player, BUT it's spirit can freely move regardless of the body position. so basically every player can have two related identity on the map: body and spirit, but only one can be controlled (spirit if available, else the body)