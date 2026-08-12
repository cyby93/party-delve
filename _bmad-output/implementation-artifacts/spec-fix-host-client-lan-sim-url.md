m ---
title: 'Host-client LAN sim-server URL derivation'
type: 'bugfix'
created: '2026-08-12'
status: 'done'
route: 'one-shot'
---

# Host-client LAN sim-server URL derivation

## Intent

**Problem:** After `apps/host-client/vite.config.ts` gained `server.host: true`, opening the host app over the LAN (`http://192.168.x.x:5173`) failed session creation with `MatchMakeError: Failed to fetch` — the client hardcoded `ws://localhost:2567` in two places, so Colyseus matchmaking targeted the *viewing* device's localhost rather than the machine running the simulation server.

**Approach:** Extract a single `sim-url.ts` module for the host client that derives both hostname and protocol from the page origin (mirroring `mobile-session.ts`), with `VITE_SIM_URL` / `VITE_SIM_PORT` overrides, a non-DOM guard, and an empty-env guard. Both former call sites now import from it. A follow-up commit applies the same principle to the QR join URL, which had been trusting the server's `/local-ip` interface guess.

**Known limitation:** this fixes address *derivation*, not network *reachability*. Under WSL2's default NAT networking the host page is reachable only at `localhost:5173` (Windows forwards loopback into WSL but not the LAN IP), which is exactly the case where the page hostname cannot identify a phone-reachable address. Run the dev servers outside WSL, or set `networkingMode=mirrored` in `.wslconfig`.

## Suggested Review Order

**Address derivation (the fix)**

- Entry point: page-origin derivation replaces hardcoded localhost, plus TLS-aware protocol.
  [`sim-url.ts:12`](../../apps/host-client/src/session/sim-url.ts#L12)

- `||` not `??` so an empty `VITE_SIM_URL=` falls back instead of yielding `''`.
  [`sim-url.ts:20`](../../apps/host-client/src/session/sim-url.ts#L20)

- Port override kept symmetric with the existing `VITE_MOBILE_PORT` idiom.
  [`sim-url.ts:10`](../../apps/host-client/src/session/sim-url.ts#L10)

- Case-insensitive ws→http with trailing slashes stripped; feeds only the `/local-ip` probe.
  [`sim-url.ts:24`](../../apps/host-client/src/session/sim-url.ts#L24)

**Call sites de-duplicated**

- The failing path: Colyseus matchmaking now resolves to the LAN host.
  [`host-session.ts:27`](../../apps/host-client/src/session/host-session.ts#L27)

- QR `/local-ip` probe now reaches the server over the LAN too.
  [`LobbyScreen.tsx:18`](../../apps/host-client/src/screens/LobbyScreen.tsx#L18)

**Peripherals**

- `.env.example` files were silently gitignored; negation makes them shippable.
  [`.gitignore:5`](../../.gitignore#L5)

- Override guidance corrected — no pinned LAN IP example to re-break DHCP.
  [`.env.example:1`](../../apps/host-client/.env.example#L1)

- D19's "localhost is correct for host client" decision closed as disproven; three new entries.
  [`deferred-work.md`](./deferred-work.md)

**QR join URL (follow-up commit)**

- Page hostname preferred over the server's interface guess — reachable by construction.
  [`LobbyScreen.tsx:17`](../../apps/host-client/src/screens/LobbyScreen.tsx#L17)

- Loopback is the one hostname that says nothing about phone reachability.
  [`LobbyScreen.tsx:15`](../../apps/host-client/src/screens/LobbyScreen.tsx#L15)

- Explicit `VITE_MOBILE_URL` now outranks both auto-detection paths.
  [`LobbyScreen.tsx:44`](../../apps/host-client/src/screens/LobbyScreen.tsx#L44)

- Probe skipped when unnecessary; cancel flag prevents a post-unmount setState.
  [`LobbyScreen.tsx:32`](../../apps/host-client/src/screens/LobbyScreen.tsx#L32)
