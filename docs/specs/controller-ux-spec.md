# Controller UX Specification

## Purpose

Define the phone controller experience so it stays fast, readable, and secondary to the host screen.

## Core Principles

- The controller is an input surface first.
- The phone should not steal attention from the host screen.
- Inputs must be hard to miss and easy to repeat under pressure.
- Reconnect and sleep recovery must be explicit and forgiving.

## Required Screens

- join screen
- controller ready screen
- in-run controller screen
- reconnect screen
- post-run result acknowledgment screen

## Required Inputs

- movement joystick
- 2 to 4 skill buttons
- optional aim or special input zone
- interact input when needed

## Minimal HUD

Allowed:
- HP or resource mini bar
- cooldown indicators
- reconnect status
- role or character marker

Avoid:
- world map
- full combat log
- dense text
- host-only information

## Accessibility Goals

- clear touch targets
- strong contrast
- portrait-first layout unless proven otherwise
- low reading requirement during gameplay

## Error Handling

- show clear network status
- allow fast rejoin
- preserve player identity during short disconnects
- avoid forcing the player through long flows after sleep/background recovery
