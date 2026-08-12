// Single source of truth for the simulation-server address.
//
// The fallback derives BOTH host and protocol from the page origin, so the host app
// works when opened over the LAN (e.g. http://192.168.x.x:5173) or behind TLS. A
// hardcoded `ws://localhost` would point at the *viewing* device, where nothing
// listens — that was the `MatchMakeError: Failed to fetch` bug. Mirrors mobile-session.ts.
//
// Overrides: VITE_SIM_URL pins the entire URL (cloud deploys); VITE_SIM_PORT changes
// only the port while keeping host/protocol derivation intact.
const SIM_PORT = import.meta.env['VITE_SIM_PORT'] || '2567';

function defaultSimUrl(): string {
  // Guarded for non-DOM environments (vitest runs host-client in the `node` environment).
  if (typeof window === 'undefined') return `ws://localhost:${SIM_PORT}`;
  const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
  return `${wsProtocol}//${window.location.hostname || 'localhost'}:${SIM_PORT}`;
}

// `||` rather than `??`: an empty `VITE_SIM_URL=` in a .env file must fall back, not yield ''.
export const SIM_URL = import.meta.env['VITE_SIM_URL'] || defaultSimUrl();

// Only consumer is the /local-ip probe — Colyseus derives its own matchmaking URL from SIM_URL.
// Case-insensitive, and trailing slashes stripped so `${SIM_HTTP}/local-ip` stays well-formed.
export const SIM_HTTP = SIM_URL
  .replace(/^ws(s?):\/\//i, (_m: string, s: string) => (s ? 'https://' : 'http://'))
  .replace(/\/+$/, '');
