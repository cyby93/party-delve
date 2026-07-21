import { useEffect } from 'react';

interface OrientationPromptScreenProps {
  onDismiss: () => void;
}

export function OrientationPromptScreen({ onDismiss }: OrientationPromptScreenProps) {
  useEffect(() => {
    const mq = window.matchMedia('(orientation: landscape)');
    if (mq.matches) { onDismiss(); return; }
    const handler = (e: MediaQueryListEvent) => { if (e.matches) onDismiss(); };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, [onDismiss]);

  return (
    // safe-area-wrapper on the outer shell (no inline padding here) so env() insets are not overridden
    <div
      className="safe-area-wrapper"
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg-base)',
      }}
    >
      <div
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 'var(--spacing-3)',
        }}
      >
        <span style={{ fontSize: 64, animation: 'rotate-hint 2s ease-in-out infinite' }}>
          📱
        </span>
        <p
          style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-md)',
            color: 'var(--text-primary)',
            textAlign: 'center',
            marginTop: 'var(--spacing-3)',
          }}
        >
          Rotate your phone to landscape to play
        </p>
      </div>
    </div>
  );
}
