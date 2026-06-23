interface MainMenuScreenProps {
  onCreateSession: () => void;
  error: string | null;
  isCreating: boolean;
}

export function MainMenuScreen({ onCreateSession, error, isCreating }: MainMenuScreenProps) {
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 'var(--spacing-4)',
      }}
    >
      <h1
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-xxl)',
          color: 'var(--text-primary)',
          fontWeight: 400,
          margin: 0,
        }}
      >
        Party Delve
      </h1>

      <button
        onClick={onCreateSession}
        disabled={isCreating}
        onMouseEnter={e => {
          if (!isCreating) {
            (e.currentTarget as HTMLButtonElement).style.background = 'var(--interactive-hover)';
          }
        }}
        onMouseLeave={e => {
          (e.currentTarget as HTMLButtonElement).style.background = isCreating
            ? 'var(--text-secondary)'
            : 'var(--interactive)';
        }}
        style={{
          background: isCreating ? 'var(--text-secondary)' : 'var(--interactive)',
          color: 'var(--bg-base)',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-md)',
          fontWeight: 700,
          borderRadius: '8px',
          minHeight: '44px',
          border: 'none',
          padding: '0 var(--spacing-4)',
          cursor: isCreating ? 'not-allowed' : 'pointer',
          opacity: isCreating ? 0.7 : 1,
        }}
      >
        {isCreating ? 'Creating…' : 'Create Session'}
      </button>

      {error !== null && (
        <p
          style={{
            color: 'var(--corruption-blood)',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            margin: 0,
          }}
        >
          {error}
        </p>
      )}
    </div>
  );
}
