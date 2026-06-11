import { useState } from 'react';

interface Props {
  connectionStatus: 'connecting' | 'connected' | 'offline';
  joinStatus: 'idle' | 'joining' | 'joined' | 'error';
  joinError: string | null;
  onJoin: (roomCode: string) => void;
}

export function JoinScreen({ connectionStatus, joinStatus, joinError, onJoin }: Props) {
  const [code, setCode] = useState('');
  const canJoin =
    connectionStatus === 'connected' && joinStatus !== 'joining' && code.length === 4;

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
        padding: '24px',
        gap: '16px',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>party-delve</h1>
      <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
        Enter the room code shown on the host screen.
      </p>
      <input
        type="text"
        placeholder="ROOM CODE"
        maxLength={4}
        value={code}
        onChange={(e) =>
          setCode(e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, ''))
        }
        style={{
          width: '100%',
          maxWidth: '280px',
          padding: '14px 16px',
          fontSize: '1.5rem',
          textAlign: 'center',
          letterSpacing: '0.3em',
          background: '#1a1a1a',
          border: `1px solid ${joinError ? '#f44' : '#333'}`,
          borderRadius: '8px',
          color: '#f0f0f0',
        }}
      />
      {joinError && (
        <div style={{ color: '#f44', fontSize: '0.85rem', textAlign: 'center' }}>
          {joinError}
        </div>
      )}
      <button
        disabled={!canJoin}
        onClick={() => onJoin(code)}
        style={{
          width: '100%',
          maxWidth: '280px',
          padding: '14px',
          fontSize: '1rem',
          fontWeight: 600,
          borderRadius: '8px',
          background: canJoin ? '#2a6' : '#2a2a2a',
          border: `1px solid ${canJoin ? '#3b7' : '#444'}`,
          color: canJoin ? '#fff' : '#888',
          cursor: canJoin ? 'pointer' : 'not-allowed',
        }}
      >
        {joinStatus === 'joining' ? 'Joining…' : 'Join'}
      </button>
    </div>
  );
}
