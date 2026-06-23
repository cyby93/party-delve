interface AuthChoiceScreenProps {
  onGuestContinue: () => void;
}

export function AuthChoiceScreen({ onGuestContinue }: AuthChoiceScreenProps) {
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
          padding: '0 24px',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
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

        <button
          onClick={onGuestContinue}
          style={{
            width: '100%',
            minHeight: 52,
            background: 'var(--interactive)',
            color: 'var(--bg-base)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            border: 'none',
            borderRadius: 8,
            cursor: 'pointer',
          }}
        >
          Continue as Guest
        </button>

        <button
          disabled
          style={{
            width: '100%',
            minHeight: 52,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'not-allowed',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        >
          Sign In
        </button>

        <button
          disabled
          style={{
            width: '100%',
            minHeight: 52,
            background: 'var(--bg-surface)',
            color: 'var(--text-primary)',
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            cursor: 'not-allowed',
            opacity: 0.4,
            pointerEvents: 'none',
          }}
        >
          Sign Up
        </button>
      </div>
    </div>
  );
}
