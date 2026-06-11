# Telemetry Specification

## Purpose

Define what must be measured from the beginning so the team can validate usability, reliability, and session quality.

## Principles

- Every major user flow should produce telemetry.
- Telemetry must support both product and engineering decisions.
- Local and remote modes should be comparable where possible.
- Telemetry should never block the gameplay loop in local mode.

## Core KPIs

Track at minimum:
- session start success rate
- QR join success rate
- time to join
- p50 input RTT
- p95 input RTT
- reconnect success rate
- average session length
- run completion rate
- local vs remote quality delta

## Event Requirements

Each telemetry event should define:
- event name
- trigger point
- required payload fields
- success or failure category
- associated KPI

## Recommended Initial Events

### Session Funnel
- `session_create_started`
- `session_create_succeeded`
- `session_create_failed`
- `qr_presented`
- `join_attempt_started`
- `join_attempt_succeeded`
- `join_attempt_failed`

### Network Quality
- `input_rtt_sampled`
- `reconnect_started`
- `reconnect_succeeded`
- `reconnect_failed`
- `network_quality_changed`

### Gameplay
- `run_started`
- `run_completed`
- `run_abandoned`
- `player_downed`
- `player_revived`

### Stability
- `client_error`
- `simulation_error`
- `crash_reported`

## Payload Schemas

### Base event (all events extend this)

```ts
interface TelemetryBaseEvent {
  event: string;           // snake_case event name
  timestamp: number;       // Unix epoch ms (Date.now())
  session_id: string;      // UUID, assigned at session creation
  build_version: string;   // semver string, e.g. "0.1.0"
  mode: "local" | "remote";
  region: string | null;   // null in local mode
  platform: "host" | "mobile" | "server";
}
```

### Session Funnel

```ts
interface SessionCreateStarted extends TelemetryBaseEvent {
  event: "session_create_started";
  // no additional fields — session_id is the only identifier needed
}

interface SessionCreateSucceeded extends TelemetryBaseEvent {
  event: "session_create_succeeded";
  room_code: string;       // the code displayed to players
  duration_ms: number;     // time from create_started to this event
}

interface SessionCreateFailed extends TelemetryBaseEvent {
  event: "session_create_failed";
  error_code: string;      // e.g. "WEBSOCKET_REFUSED", "TIMEOUT"
  duration_ms: number;
}

interface QrPresented extends TelemetryBaseEvent {
  event: "qr_presented";
  room_code: string;
}

interface JoinAttemptStarted extends TelemetryBaseEvent {
  event: "join_attempt_started";
  player_id: string;       // UUID assigned client-side before join completes
  room_code: string;
}

interface JoinAttemptSucceeded extends TelemetryBaseEvent {
  event: "join_attempt_succeeded";
  player_id: string;
  slot_index: number;      // 0–3, assigned by server
  duration_ms: number;     // time from join_attempt_started to this event
}

interface JoinAttemptFailed extends TelemetryBaseEvent {
  event: "join_attempt_failed";
  player_id: string;
  room_code: string;
  error_code: string;      // e.g. "ROOM_FULL", "ROOM_NOT_FOUND", "TIMEOUT"
  duration_ms: number;
}
```

### Network Quality

```ts
interface InputRttSampled extends TelemetryBaseEvent {
  event: "input_rtt_sampled";
  player_id: string;
  rtt_ms: number;          // round trip: input sent → state reflecting input received
  sample_index: number;    // monotonically increasing per session
}

interface ReconnectStarted extends TelemetryBaseEvent {
  event: "reconnect_started";
  player_id: string;
  slot_index: number;
  disconnect_duration_ms: number; // how long the player was disconnected before attempting
}

interface ReconnectSucceeded extends TelemetryBaseEvent {
  event: "reconnect_succeeded";
  player_id: string;
  slot_index: number;
  reconnect_duration_ms: number;
}

interface ReconnectFailed extends TelemetryBaseEvent {
  event: "reconnect_failed";
  player_id: string;
  slot_index: number;
  error_code: string;      // e.g. "SESSION_ENDED", "MAX_RETRIES_EXCEEDED"
}

interface NetworkQualityChanged extends TelemetryBaseEvent {
  event: "network_quality_changed";
  player_id: string;
  previous_quality: "good" | "degraded" | "poor";
  current_quality: "good" | "degraded" | "poor";
  rtt_ms: number;          // current RTT at time of change
}
```

### Gameplay

```ts
interface RunStarted extends TelemetryBaseEvent {
  event: "run_started";
  player_count: number;
  archetype_ids: string[]; // e.g. ["warrior", "rogue"]
}

interface RunCompleted extends TelemetryBaseEvent {
  event: "run_completed";
  duration_ms: number;
  player_count: number;
  outcome: "victory" | "all_downed";
}

interface RunAbandoned extends TelemetryBaseEvent {
  event: "run_abandoned";
  duration_ms: number;
  player_count: number;
  reason: "host_quit" | "all_disconnected" | "unknown";
}

interface PlayerDowned extends TelemetryBaseEvent {
  event: "player_downed";
  player_id: string;
  run_time_ms: number;     // time into the run when downed
}

interface PlayerRevived extends TelemetryBaseEvent {
  event: "player_revived";
  player_id: string;
  reviver_player_id: string;
  downed_duration_ms: number;
}
```

### Stability

```ts
interface ClientError extends TelemetryBaseEvent {
  event: "client_error";
  player_id: string | null;
  error_message: string;
  stack_trace: string | null;
}

interface SimulationError extends TelemetryBaseEvent {
  event: "simulation_error";
  error_message: string;
  tick_number: number;
}

interface CrashReported extends TelemetryBaseEvent {
  event: "crash_reported";
  player_id: string | null;
  error_message: string;
  crash_type: "unhandled_exception" | "websocket_close" | "oom" | "unknown";
}
```

## Payload Guidelines

Preferred common fields (already in `TelemetryBaseEvent`):
- `session_id`
- `mode`
- `build_version`
- `region`
- `platform`
- `timestamp`

Player-scoped events additionally include:
- `player_id`

## Dashboard Priorities

Build first dashboards for:
- join funnel
- reconnect funnel
- latency percentiles
- session duration
- completion rate

## Review Rule

Any new user flow should ship with telemetry or an explicit explanation of why telemetry is deferred.
