import QRCode from 'react-qr-code';
import { useState, useEffect } from 'react';
import type { GameState } from 'shared-types';
import { PlayerSlot } from '../components/PlayerSlot';

const SIM_URL = import.meta.env['VITE_SIM_URL'] ?? 'ws://localhost:2567';
const SIM_HTTP = SIM_URL.replace(/^ws(s?):\/\//, 'http$1://');
const MOBILE_PORT = import.meta.env['VITE_MOBILE_PORT'] ?? '5174';

interface LobbyScreenProps {
  roomId: string;
  gameState: GameState | null;
  onStartGame: () => void;
}

export function LobbyScreen({ roomId, gameState, onStartGame }: LobbyScreenProps) {
  const [mobileHost, setMobileHost] = useState<string | null>(null);
  useEffect(() => {
    fetch(`${SIM_HTTP}/local-ip`)
      .then(r => r.json())
      .then((d: { localIp: string }) => setMobileHost(d.localIp))
      .catch(() => {});
  }, []);

  const baseUrl = mobileHost
    ? `http://${mobileHost}:${MOBILE_PORT}`
    : (import.meta.env['VITE_MOBILE_URL'] ?? `http://localhost:${MOBILE_PORT}`);
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
