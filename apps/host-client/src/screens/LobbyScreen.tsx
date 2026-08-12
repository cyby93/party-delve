import QRCode from 'react-qr-code';
import { useState, useEffect } from 'react';
import type { GameState } from 'shared-types';
import { PlayerSlot } from '../components/PlayerSlot';
import { SIM_HTTP } from '../session/sim-url';

const MOBILE_PORT = import.meta.env['VITE_MOBILE_PORT'] || '5174';
const MOBILE_URL_OVERRIDE = import.meta.env['VITE_MOBILE_URL'] || null;

// Whatever address the operator used to reach this page is, by construction, an address
// that works on this network — so prefer it over the server's own interface guess
// (`/local-ip` picks the first non-internal IPv4, which on WSL2 is an unroutable NAT
// address). Loopback is the one case where the page hostname tells us nothing about
// what a phone can reach, and that is where the server probe still earns its keep.
const LOOPBACK = /^(localhost|127\.\d+\.\d+\.\d+|\[?::1\]?|0\.0\.0\.0)$/i;

function pageHost(): string | null {
  if (typeof window === 'undefined') return null;
  const h = window.location.hostname;
  return h && !LOOPBACK.test(h) ? h : null;
}

interface LobbyScreenProps {
  roomId: string;
  gameState: GameState | null;
  onStartGame: () => void;
}

export function LobbyScreen({ roomId, gameState, onStartGame }: LobbyScreenProps) {
  const originHost = pageHost();
  const [probedHost, setProbedHost] = useState<string | null>(null);

  useEffect(() => {
    // Only ask the server which interface it thinks it is when the page hostname can't
    // answer that for us. Skipping the probe also avoids a pointless request per lobby.
    if (originHost || MOBILE_URL_OVERRIDE) return;
    let cancelled = false;
    fetch(`${SIM_HTTP}/local-ip`)
      .then(r => r.json())
      .then((d: { localIp: string }) => { if (!cancelled) setProbedHost(d.localIp); })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [originHost]);

  // An explicit operator override outranks both auto-detection paths.
  const mobileHost = originHost ?? probedHost;
  const baseUrl =
    MOBILE_URL_OVERRIDE ??
    `http://${mobileHost ?? 'localhost'}:${MOBILE_PORT}`;
  const mobileJoinUrl = `${baseUrl}/?session=${roomId}`;

  const handleKick = (playerId: string) => {
    // Kick message requires KICK_PLAYER EventName + server handler (not yet implemented).
    // Server-side coordination: net-protocol (Protocol Architect) + GameRoom (Simulation Engineer).
    // Do NOT silently ignore — log visibly so this is trackable:
    console.warn('[host] kick requested for', playerId, '— server handler deferred, see deferred-work.md');
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div
        style={{
          background: 'var(--bg-surface)',
          borderRadius: 8,
          padding: 'var(--spacing-4)',
          width: '100%',
          maxWidth: 500,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 'var(--spacing-3)',
        }}
      >
        <h2
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--text-primary)',
            fontWeight: 400,
            margin: 0,
          }}
        >
          Party Delve
        </h2>

        <QRCode
          value={mobileJoinUrl}
          size={256}
          bgColor="#0f0e10"
          fgColor="#d8d0e8"
          style={{ display: 'block' }}
        />

        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-xl)',
            fontWeight: 700,
            color: 'var(--text-primary)',
            margin: 0,
            letterSpacing: '0.1em',
          }}
        >
          {roomId}
        </p>

        {/* P6: always show player section so AC2 "initially empty" state is visible */}
        <div style={{ width: '100%' }}>
          <p
            style={{
              fontFamily: 'var(--font-body)',
              fontSize: 'var(--text-sm)',
              color: 'var(--text-secondary)',
              margin: '0 0 var(--spacing-1) 0',
            }}
          >
            Players:
          </p>
          {gameState && gameState.players.length > 0 ? (
            gameState.players.map(p => (
              <PlayerSlot key={p.id} player={p} onKick={handleKick} />
            ))
          ) : (
            <p
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                margin: 0,
                fontStyle: 'italic',
              }}
            >
              Waiting for players…
            </p>
          )}
        </div>

        <button
          onClick={onStartGame}
          onMouseEnter={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--interactive-hover)';
          }}
          onMouseLeave={e => {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--interactive)';
          }}
          style={{
            background: 'var(--interactive)',
            color: 'var(--bg-base)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-md)',
            fontWeight: 700,
            borderRadius: '8px',
            minHeight: '44px',
            border: 'none',
            padding: '0 var(--spacing-4)',
            cursor: 'pointer',
            width: '100%',
          }}
        >
          Start Game
        </button>
      </div>
    </div>
  );
}
