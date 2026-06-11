# shared-types

Types-only TypeScript package that defines the shared domain contracts for party-delve. It exports the core types used across all apps and packages: input events (`MoveInputEvent`, `SkillInputEvent`, `InputEvent`), player domain types (`PlayerState`, `PlayerStateSnapshot`), and session lifecycle types (`SessionState`, `SessionStateEvent`, `RoomState`). This package has no runtime dependencies and must never gain any; it is the single source of truth for the event contract described in `docs/specs/networking-spec.md`.
