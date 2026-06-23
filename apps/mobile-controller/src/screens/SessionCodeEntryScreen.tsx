import { useState, useRef } from 'react';

function ThreeDots() {
  return (
    <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}>
      {[0, 1, 2].map(i => (
        <span
          key={i}
          style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: 'var(--bg-base)',
            animation: `dot-pulse 1.2s ${i * 0.2}s ease-in-out infinite`,
          }}
        />
      ))}
    </span>
  );
}

interface SessionCodeEntryScreenProps {
  onJoin: (roomId: string, playerName: string) => Promise<void>;
}

export function SessionCodeEntryScreen({ onJoin }: SessionCodeEntryScreenProps) {
  const urlCode = new URLSearchParams(window.location.search).get('session') ?? '';
  const [sessionCode, setSessionCode] = useState(urlCode);
  const [playerName, setPlayerName] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const isSubmittingRef = useRef(false);

  const isDisabled = sessionCode.trim().length === 0 || playerName.trim().length === 0 || isLoading || isSuccess;

  const handleJoinClick = async () => {
    if (isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    setIsLoading(true);
    setIsSuccess(false);
    setErrorMessage(null);
    try {
      await onJoin(sessionCode.trim(), playerName.trim());
      setIsLoading(false);
      setIsSuccess(true);
    } catch (err) {
      setIsLoading(false);
      setIsSuccess(false);
      setErrorMessage(err instanceof Error ? err.message : 'Could not join session. Check the code and try again.');
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const codeFieldStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 44,
    padding: '0 var(--spacing-2)',
    background: 'var(--bg-surface)',
    border: `1px solid ${errorMessage ? 'var(--corruption-blood)' : 'var(--border)'}`,
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const nameFieldStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 44,
    padding: '0 var(--spacing-2)',
    background: 'var(--bg-surface)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    fontFamily: 'var(--font-body)',
    fontSize: 'var(--text-base)',
    color: 'var(--text-primary)',
    outline: 'none',
    boxSizing: 'border-box',
  };

  const btnStyle: React.CSSProperties = {
    width: '100%',
    minHeight: 52,
    background: isSuccess ? 'var(--accent-purify)' : 'var(--interactive)',
    color: 'var(--bg-base)',
    fontFamily: 'var(--font-body)',
    fontWeight: 700,
    fontSize: 'var(--text-md)',
    border: 'none',
    borderRadius: 8,
    cursor: isDisabled ? 'not-allowed' : 'pointer',
    opacity: isDisabled && !isLoading ? 0.6 : 1,
    pointerEvents: isDisabled ? 'none' : 'auto',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  };

  return (
    // safe-area-wrapper on the outer shell (no inline padding here) so env() insets are not overridden
    <div
      className="safe-area-wrapper"
      style={{
        height: '100%',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 380,
          padding: '0 var(--spacing-3)',
          display: 'flex',
          flexDirection: 'column',
          gap: 'var(--spacing-2)',
        }}
      >
        <h1
          style={{
            fontFamily: 'var(--font-display)',
            fontSize: 'var(--text-lg)',
            color: 'var(--text-primary)',
            fontWeight: 400,
            margin: 0,
            textAlign: 'center',
          }}
        >
          Party Delve
        </h1>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            color: 'var(--text-secondary)',
            margin: 0,
            textAlign: 'center',
          }}
        >
          Join Session
        </p>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <input
            id="session-code-field"
            style={codeFieldStyle}
            value={sessionCode}
            onChange={e => setSessionCode(e.target.value)}
            placeholder="Session code"
            autoComplete="off"
          />
          {errorMessage && (
            <span
              style={{
                display: 'block',
                marginTop: 8,
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
              }}
            >
              {errorMessage}
            </span>
          )}
        </div>

        <input
          style={nameFieldStyle}
          value={playerName}
          onChange={e => setPlayerName(e.target.value)}
          placeholder="Your name"
          required
          autoComplete="off"
        />

        <button
          id="join-button"
          onClick={handleJoinClick}
          style={btnStyle}
        >
          {isLoading ? <ThreeDots /> : 'Join'}
        </button>
      </div>
    </div>
  );
}
