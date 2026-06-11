# Content Pipeline Specification

## Purpose

Define how abilities, enemies, rooms, and content configurations are authored and versioned.

## Principles

- Content should be data-driven where practical.
- Shared definitions should be reusable across local and remote modes.
- Versioning should support compatibility and rollback.

## Content Types

- character archetypes
- abilities
- enemies
- rooms
- encounter compositions
- rewards and progression stubs

## Requirements

- define a canonical source format
- store version metadata
- support validation before runtime use
- separate content data from simulation engine code where practical

## Initial Deliverables

- ability definition schema
- enemy definition schema
- room metadata schema
- validation strategy
