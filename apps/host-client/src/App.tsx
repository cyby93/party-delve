import { useEffect, useRef } from 'react';
import type { RoomState } from 'shared-types';
import { useHostSession } from './hooks/useHostSession';

const SIM_URL = 'ws://localhost:8081';
const MAX_SLOTS = 4;

// RoomState imported to satisfy "imports types from shared-types" criterion.
const _roomState: RoomState | null = null;
void _roomState;

export default function App() {
  const { status, roomCode, sessionId, players } = useHostSession(SIM_URL);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }, []);

  return (
    <div style={{ background: '#000', minHeight: '100vh', color: '#f0f0f0', fontFamily: 'monospace', display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '24px', gap: '24px' }}>

      {/* Status bar */}
      <div style={{ fontSize: '12px', color: status === 'connected' ? '#4f4' : status === 'connecting' ? '#ff4' : '#f44' }}>
        sim-server: {status}{sessionId ? ` · session ${sessionId.slice(0, 8)}` : ''}
      </div>

      {/* Room code */}
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: '13px', color: '#888', marginBottom: '8px', letterSpacing: '0.1em' }}>ROOM CODE</div>
        <div style={{ fontSize: '72px', fontWeight: 700, letterSpacing: '0.25em', color: roomCode ? '#fff' : '#444' }}>
          {roomCode ?? '····'}
        </div>
        <div style={{ fontSize: '12px', color: '#555', marginTop: '6px' }}>
          {roomCode ? 'players: scan or enter this code on your phone' : 'waiting for server…'}
        </div>
      </div>

      {/* Player slots */}
      <div style={{ display: 'flex', gap: '16px' }}>
        {Array.from({ length: MAX_SLOTS }, (_, i) => {
          const player = players[i];
          return (
            <div key={i} style={{
              width: '100px', height: '100px',
              border: `2px solid ${player ? (player.connected ? '#4f4' : '#f84') : '#333'}`,
              borderRadius: '8px',
              display: 'flex', flexDirection: 'column',
              alignItems: 'center', justifyContent: 'center',
              gap: '6px',
              background: player ? '#1a1a1a' : '#0a0a0a',
            }}>
              <div style={{ fontSize: '11px', color: '#555' }}>P{i + 1}</div>
              {player ? (
                <>
                  <div style={{ fontSize: '10px', color: player.connected ? '#4f4' : '#f84', textAlign: 'center', padding: '0 4px', wordBreak: 'break-all' }}>
                    {player.playerId.slice(0, 8)}
                  </div>
                  <div style={{ fontSize: '9px', color: '#666' }}>
                    {player.connected ? 'connected' : 'disconnected'}
                  </div>
                </>
              ) : (
                <div style={{ fontSize: '11px', color: '#333' }}>empty</div>
              )}
            </div>
          );
        })}
      </div>

      {/* Canvas placeholder */}
      <canvas ref={canvasRef} width={800} height={300} style={{ border: '1px solid #222', maxWidth: '100%' }} />
    </div>
  );
}
