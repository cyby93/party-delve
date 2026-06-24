import { useState } from 'react';
import { clearPersistedSession } from '../session/mobile-session';

interface ReconnectScreenProps {
  roomId: string;
  onReconnect: () => Promise<void>;
  onGiveUp: () => void;
}

export function ReconnectScreen({ roomId, onReconnect, onGiveUp }: ReconnectScreenProps) {
  const [status, setStatus] = useState<'idle' | 'connecting' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleRejoin = async () => {
    setStatus('connecting');
    setErrorMsg(null);
    try {
      await onReconnect();
      // on success, App.tsx sets screen to 'controller' — this component unmounts
    } catch {
      clearPersistedSession();
      setStatus('error');
      setErrorMsg('Session expired. You can rejoin as a new player.');
    }
  };

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 24,
        background: 'var(--bg-base)',
        padding: 24,
        boxSizing: 'border-box',
      }}
    >
      {/* Network status indicator */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          color: 'var(--text-secondary)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-sm)',
        }}
      >
        <span
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background:
              status === 'error'
                ? 'var(--corruption-blood)'
                : status === 'connecting'
                  ? 'var(--accent-spirit)'
                  : 'var(--accent-warm)',
            flexShrink: 0,
          }}
        />
        {status === 'idle' && 'Connection lost'}
        {status === 'connecting' && 'Reconnecting…'}
        {status === 'error' && 'Session expired'}
      </div>

      {/* Session code display */}
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            marginBottom: 8,
          }}
        >
          Session Code
        </div>
        <div
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 40,
            fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: 4,
          }}
        >
          {roomId}
        </div>
      </div>

      {/* Error message */}
      {errorMsg !== null && (
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--corruption-blood)',
            textAlign: 'center',
            margin: 0,
          }}
        >
          {errorMsg}
        </p>
      )}

      {/* CTA */}
      {status !== 'error' ? (
        <button
          onClick={() => { void handleRejoin(); }}
          disabled={status === 'connecting'}
          style={{
            width: '100%',
            minHeight: 44,
            background: status === 'connecting' ? 'var(--bg-subtle)' : 'var(--interactive)',
            border: '1px solid var(--interactive)',
            borderRadius: 6,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
            cursor: status === 'connecting' ? 'not-allowed' : 'pointer',
          }}
        >
          {status === 'connecting' ? 'Reconnecting…' : 'Rejoin Session'}
        </button>
      ) : (
        <button
          onClick={onGiveUp}
          style={{
            width: '100%',
            minHeight: 44,
            background: 'var(--bg-subtle)',
            border: '1px solid var(--border)',
            borderRadius: 6,
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-base)',
            color: 'var(--text-primary)',
            cursor: 'pointer',
          }}
        >
          Rejoin as New Player
        </button>
      )}
    </div>
  );
}

