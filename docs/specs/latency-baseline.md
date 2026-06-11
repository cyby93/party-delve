# Latency Baseline Specification

## Purpose

Perceived input responsiveness is the primary quality signal for a couch co-op dungeon crawler. If a player moves the joystick and their character does not visibly react within roughly one display frame, the game feels broken. This document guards that contract by defining exactly what is measured, what the acceptable thresholds are, and how the measurement is captured in both manual test runs and in CI. The targets established here feed directly into the core KPIs tracked in `docs/specs/telemetry-spec.md` and serve as the acceptance gate for any change to the networking or simulation layers that could affect input processing latency.

---

## What Is Measured

The measurement is the round-trip time (RTT) from when a `MoveInputEvent` is sent by the mobile controller to when a `PlayerStateSnapshot` reflecting that input is received back by the same mobile controller for its own player.

**Matching mechanism**

1. When the mobile controller fires a `MoveInputEvent`, it records the event's `timestamp` field (client-local milliseconds at input capture) keyed by the event's `sequenceNumber`. Call this `send_timestamp_ms`.
2. The simulation server processes the input during the tick in which the event is received, then emits a `PlayerStateSnapshot` keyed by the authoritative `tick` number.
3. When the mobile controller receives a `PlayerStateSnapshot` whose `tick` is the first authoritative tick on or after the server processed the input carrying that `sequenceNumber`, RTT is computed as:

   ```
   rtt_ms = receive_timestamp_ms - send_timestamp_ms
   ```

   where `receive_timestamp_ms` is the local clock at the moment the snapshot message is received by the mobile controller — not a server-provided timestamp.

**Clock note:** Because `send_timestamp_ms` and `receive_timestamp_ms` are both local to the mobile controller, the measurement includes propagation delay in both directions but is free of server-clock skew. It does not attempt to isolate one-way latency. This is intentional for Phase 0 simplicity; if asymmetric analysis is needed in Phase 5 (Online Mode), a separate NTP-aligned measurement approach should be specified at that time.

**Tick-latency note:** The simulation runs at an initial target of 20 Hz (50 ms per tick). A `MoveInputEvent` that arrives mid-tick will not be processed until the next tick boundary. This introduces up to 50 ms of tick-processing latency before network latency. The RTT targets below include this tick latency. They are end-to-end player experience targets, not pure network targets.

---

## Measurement Approach

Three approaches are acceptable. Phase 1 implementation chooses which to build first; all three are valid long-term tools.

### Approach 1 — Built-in timestamp logging (preferred for production)

The mobile controller records `send_timestamp_ms` values in a local map keyed by `sequenceNumber`. When a `PlayerStateSnapshot` arrives for the local player, the controller looks up the matching send timestamp, computes `rtt_ms`, and emits an `input_rtt_sampled` telemetry event (see `docs/specs/telemetry-spec.md`). The map entry is then removed.

This approach runs entirely inside the app, requires no extra tooling, and works in real sessions on real devices. It is the normative production path. The sampling rate (see below) prevents it from saturating the telemetry pipeline.

Entries that never receive a matching snapshot (due to packet loss or session end) should be discarded after a configurable timeout (suggested: 5 seconds). Do not emit `input_rtt_sampled` for unmatched entries.

### Approach 2 — Manual probe script

A standalone Node.js script at `tools/latency-probe/` connects to a running simulation server as a simulated mobile controller and a simulated host client. It sends a stream of `MoveInputEvent` messages, records send timestamps, waits for matching `PlayerStateSnapshot` messages, and prints RTT percentiles to stdout.

This is useful for pre-release checks and for measuring latency on a clean server process without requiring a browser or physical device. It can also be run ad hoc during development to sanity-check a new transport or serialization change.

### Approach 3 — Test harness (required for CI gate in Phase 1)

An integration test that:
1. Starts `apps/simulation-server` on localhost in test mode.
2. Connects a mock mobile controller and a mock host client over loopback WebSocket.
3. Sends N `MoveInputEvent` messages at the 20 Hz tick rate over a defined window.
4. Collects matching `PlayerStateSnapshot` messages and computes RTT percentiles.
5. Asserts that the computed percentiles pass the targets defined in the Targets section below.

This approach does not emit `input_rtt_sampled` telemetry events; it asserts directly on computed RTT values. It is required as a CI gate starting in Phase 1 (dependency: P1-6 / P1-7). When running on loopback, network latency is near zero, so the test primarily validates that tick processing and message dispatch do not introduce unexpected latency.

---

## Targets

These targets apply to **local mode** (host and phones on the same LAN or WiFi network). Remote / online mode targets are out of scope here and must be defined separately in Phase 5 when client-side prediction is in scope.

| Metric | Target | Rationale |
|--------|--------|-----------|
| p50 RTT | < 16 ms | One frame at 60 fps — imperceptible to most players |
| p95 RTT | < 50 ms | Three frames at 60 fps — acceptable outer bound for couch co-op |
| p99 RTT | < 100 ms | Occasional spike tolerance; above this, the controller feels disconnected |

**CI loopback assertion:** Because the test harness (Approach 3) runs on localhost with near-zero network latency, the CI assertion uses a stricter threshold: p95 < 30 ms. If the p95 on loopback exceeds 30 ms, that is a processing regression in the simulation server or message dispatch layer, not a network issue, and the build must fail.

**Target rationale and tick interaction:** At 20 Hz, one tick is 50 ms. A `MoveInputEvent` sent at the worst case (immediately after a tick boundary) waits up to one full tick before being processed, contributing up to 50 ms to RTT before any network latency is added. The p50 < 16 ms target is achievable only when input arrives early in a tick window combined with low-latency WiFi. The p95 < 50 ms target is achievable on a clean local network even accounting for worst-case tick timing. These targets may be revisited if the tick rate is adjusted after latency benchmarking (see `docs/specs/networking-spec.md`, Tick Model).

---

## Sampling Rate

Emit `input_rtt_sampled` once every 20 `MoveInputEvent` messages per player (approximately every 1 second at typical joystick polling rates). This rate:

- Provides enough samples for percentile calculation within a 30-second session (approximately 30 samples per player).
- Prevents telemetry from saturating the WebSocket connection during active gameplay.
- Gives the dashboard enough granularity to detect a latency spike mid-session.

The `sample_index` field in `input_rtt_sampled` is monotonically increasing per session, which allows samples to be ordered correctly even if delivery is out of order.

---

## Baseline Capture

### Manual test run

1. Start `apps/simulation-server` locally.
2. Connect two devices to the same WiFi network as the host.
3. Play normally for at least 60 seconds to accumulate samples.
4. Filter `input_rtt_sampled` events from the console or telemetry log.
5. Compute p50 and p95 from the collected `rtt_ms` values.
6. Record the results in `docs/planning/latency-results.md` when first measured. Include: date, host hardware, WiFi type, number of connected players, number of samples, p50, p95, and p99.

No `latency-results.md` file exists yet; create it when the first measurement is taken in Phase 1.

### CI gate (Phase 1)

The test harness (Approach 3 above) runs as part of `pnpm test` in CI. Requirements:

- Start a local simulation server process on a free port.
- Connect one mock mobile controller and one mock host client over loopback WebSocket.
- Send 200 `MoveInputEvent` messages at 20 Hz (10 seconds of input).
- Collect matching `PlayerStateSnapshot` messages.
- Assert: p95 RTT < 30 ms (loopback threshold).
- Assert: p99 RTT < 60 ms (loopback spike tolerance).
- Tear down the server process cleanly; fail the test if teardown hangs beyond 5 seconds.

The CI test is a **processing regression gate**, not a network quality gate. A failure indicates that simulation tick processing, event dispatch, or message serialization has regressed, not that the WiFi is slow.

CI test stub name (to be created in Phase 1): `"latency: p95 RTT < 50ms on loopback"` — dependency: P1-6 / P1-7.

---

## Relationship to Telemetry

The `input_rtt_sampled` event defined in `docs/specs/telemetry-spec.md` is the production vehicle for this measurement. No new telemetry events are required by this specification.

KPI mapping:

| `input_rtt_sampled` field | Core KPI |
|---------------------------|----------|
| `rtt_ms` (p50 aggregate) | **p50 input RTT** |
| `rtt_ms` (p95 aggregate) | **p95 input RTT** |

Both KPIs are listed in `docs/specs/telemetry-spec.md` under Core KPIs. Dashboard priority: latency percentiles (see Dashboard Priorities section in telemetry spec).

The latency CI test (Approach 3) uses the same measurement method — `receive_timestamp_ms - send_timestamp_ms` on the mock controller — but does not emit `input_rtt_sampled` events; it asserts directly on computed RTT values to keep CI output clean and avoid polluting telemetry with synthetic data.

---

## Hooks Triggered by This Document

- **Telemetry hook:** This spec maps to the existing `input_rtt_sampled` event. No new events are introduced. KPI mapping confirmed above.
- **Ownership hook:** This document is owned by QA + Telemetry Engineer. It references but does not modify `docs/specs/networking-spec.md` or `docs/specs/telemetry-spec.md`.

---

*Last updated: Phase 0, P0-8. Next revision expected when Phase 1 CI gate is implemented (P1-6/P1-7) or when tick rate is adjusted.*
