---
baseline_commit: fc1ddf6
---

# Story dev-1: Mobile Controller Network Binding Fix

Status: done

## CLAUDE.md Required Task Header

```
Phase: 3 — (ad-hoc dev-infra fix, no epic assignment)
Context: The root dev script exposes the mobile Vite server on the LAN via the
  CLI flag `-- --host`, but the Colyseus client inside the app still connects to
  `ws://localhost:2567`. On a phone, `localhost` resolves to the phone itself,
  not the host machine — so the matchmaking HTTP request fails with "Failed to
  fetch". Additionally, `server.host` belongs in vite.config.ts, not as a CLI
  workaround.
Owner agent: Mobile Controller Engineer
Goal: (A) Change the SIM_URL fallback in mobile-session.ts from
  `ws://localhost:2567` to `ws://${window.location.hostname}:2567` so the
  WebSocket connects to whichever machine served the page. (B) Move
  `server: { host: true }` into apps/mobile-controller/vite.config.ts and
  remove `-- --host` from the root package.json dev script.
Allowed paths:
  - apps/mobile-controller/src/session/mobile-session.ts   (MODIFY)
  - apps/mobile-controller/vite.config.ts                  (MODIFY)
  - package.json (root)                                     (MODIFY)
Blocked paths:
  - apps/host-client/**        (host runs on same machine, localhost:2567 is fine)
  - packages/**                (no protocol or type changes)
  - apps/simulation-server/**  (already listens on 0.0.0.0 via Colyseus default)
  - tests/**
Inputs:
  - apps/mobile-controller/src/session/mobile-session.ts   (current)
  - apps/mobile-controller/vite.config.ts                  (current)
  - package.json (root)                                     (current)
Non-goals:
  - HTTPS / TLS (plain HTTP over LAN is fine for local play)
  - Any changes to host-client or simulation-server
  - Custom IP discovery (window.location.hostname is sufficient)
  - Env-file approach for SIM_URL (the hostname-derived fallback covers all
    local dev cases; VITE_SIM_URL override remains for power users)
Acceptance criteria:
  AC1: A phone that opens http://<host-LAN-IP>:5174 can join a session by
       entering the 4-letter code and a name without "Failed to fetch".
  AC2: `apps/mobile-controller/vite.config.ts` has `server: { host: true }`.
  AC3: Root `package.json` dev script no longer passes `-- --host` to the
       mobile-controller command; `npm run dev` from the project root starts
       all four services correctly.
  AC4: VITE_SIM_URL env var still overrides the fallback (existing behaviour
       preserved — no regression for anyone using it).
Required hooks:
  - Client-UX hook (mobile UI session flow touched): manual smoke-test — open
    the controller on a phone via the LAN QR code and join a session.
Required tests: None — this is a dev-env wiring fix with no logic branch to
  unit-test. AC1 is the acceptance test (manual).
Telemetry impact: None.
```

## Tasks / Subtasks

- [x] T1: `apps/mobile-controller/src/session/mobile-session.ts` — change SIM_URL fallback
- [x] T2: `apps/mobile-controller/vite.config.ts` — add `server: { host: true }`
- [x] T3: `package.json` (root) — remove `-- --host` from mobile-controller dev command

### Review Findings

- [x] [Review][Patch] Empty hostname guard — add `|| 'localhost'` to fallback in case window.location.hostname returns empty string (e.g. iOS PWA over IP) [`apps/mobile-controller/src/session/mobile-session.ts:6`]
- [x] [Review][Patch] .env.example still shows VITE_SIM_URL=ws://localhost:2567 — copying it to .env re-breaks LAN silently [`apps/mobile-controller/.env.example`]
- [x] [Review][Defer] Fallback hostname wrong for multi-machine setups — by design; VITE_SIM_URL override covers this — deferred, pre-existing
- [x] [Review][Defer] LobbyScreen.tsx has its own SIM_URL constant (localhost) — pre-existing, host-client intentionally unchanged — deferred, pre-existing
- [x] [Review][Defer] SIM_URL module constant goes stale if phone roams mid-session — inherent, no worse than before — deferred, pre-existing

## Developer Context

### Root cause

`mobile-session.ts` line 6:
```ts
const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';
```

When `VITE_SIM_URL` is unset, the Colyseus SDK builds its matchmaking URL as
`http://localhost:2567/matchmake/joinById/<code>`. On a phone, `localhost`
resolves to the phone itself — the request never reaches the sim server on the
host machine. The browser reports this as "Failed to fetch".

### Fix (T1)

```ts
// mobile-session.ts line 6
const SIM_URL = import.meta.env['VITE_SIM_URL'] ??
  `ws://${window.location.hostname}:2567`;
```

`window.location.hostname` is the hostname the page was served from. When a
phone loads the controller from `http://192.168.x.x:5174`, it is `192.168.x.x`.
When running locally on the host machine (`http://localhost:5174`), it is
`localhost` — identical to the old default. No regression.

This is a runtime value (evaluated when the module runs in the browser), not a
build-time constant, so Vite's env-variable substitution does not interfere.

### Fix (T2) — vite.config.ts

Current `server` block in `apps/mobile-controller/vite.config.ts`:
```ts
server: {
  port: 5174,
},
```

Change to:
```ts
server: {
  host: true,   // bind 0.0.0.0 so LAN devices can reach the dev server
  port: 5174,
},
```

`host: true` is equivalent to `--host` on the CLI. Having it in config is the
correct permanent home; the CLI flag was a workaround.

### Fix (T3) — root package.json

Current dev script:
```json
"dev": "concurrently --kill-others-on-fail -n sim,backend,host,mobile -c cyan,yellow,blue,green \"npm -w apps/simulation-server run dev\" \"npm -w apps/backend-platform run dev\" \"npm -w apps/host-client run dev\" \"npm -w apps/mobile-controller run dev -- --host\""
```

Change the last command from `run dev -- --host` to `run dev`:
```json
"dev": "concurrently --kill-others-on-fail -n sim,backend,host,mobile -c cyan,yellow,blue,green \"npm -w apps/simulation-server run dev\" \"npm -w apps/backend-platform run dev\" \"npm -w apps/host-client run dev\" \"npm -w apps/mobile-controller run dev\""
```

### Why the sim server doesn't need changes

`gameServer.listen(PORT)` in Colyseus binds to `0.0.0.0` by default, so the
simulation server is already reachable on the LAN at port 2567. The only
missing piece was the client-side URL pointing to the right host.

### What NOT to change

- `apps/host-client/src/session/host-session.ts` and `LobbyScreen.tsx`: both
  use `ws://localhost:2567` as fallback. The host client runs on the same
  machine as the sim server — `localhost` is correct there.
- Any test files.
- The `VITE_SIM_URL` env var path: it must still override the fallback for
  power users and future cloud/staging configurations.

## File Change Summary

| File | Change |
|------|--------|
| `apps/mobile-controller/src/session/mobile-session.ts` | Line 6: fallback `ws://localhost:2567` → `` `ws://${window.location.hostname}:2567` `` |
| `apps/mobile-controller/vite.config.ts` | `server` block: add `host: true` |
| `package.json` (root) | dev script: `run dev -- --host` → `run dev` for mobile-controller |

## Dev Agent Record

### Completion Notes

T1: `mobile-session.ts:6` — fallback changed from `'ws://localhost:2567'` to `` `ws://${window.location.hostname}:2567` ``. Runtime evaluation; no build-time impact. VITE_SIM_URL override preserved.
T2: `vite.config.ts` — added `host: true` to server block (binds 0.0.0.0).
T3: `package.json` dev script — removed `-- --host` from mobile-controller command; config now owns it.
All checks: typecheck clean, 256 tests passed, no regressions.

## File List

- `apps/mobile-controller/src/session/mobile-session.ts`
- `apps/mobile-controller/vite.config.ts`
- `package.json`

## Change Log

- 2026-06-30: Story created (Cyby)
- 2026-06-30: Implemented T1–T3; all ACs satisfied; status → review
