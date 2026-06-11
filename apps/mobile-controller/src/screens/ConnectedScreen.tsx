interface Props {
  playerId: string;
  sessionId: string;
}

export function ConnectedScreen({ playerId, sessionId }: Props) {
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
      <div style={{ fontSize: '2.5rem' }}>✓</div>
      <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Connected!</h2>
      <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center' }}>
        Watch the host screen.<br />
        Game controls will appear when the run starts.
      </p>
      <div
        style={{
          marginTop: '16px',
          padding: '12px 16px',
          background: '#1a1a1a',
          borderRadius: '8px',
          fontSize: '11px',
          color: '#555',
          fontFamily: 'monospace',
          textAlign: 'center',
        }}
      >
        session {sessionId.slice(0, 8)}<br />
        player {playerId.slice(0, 8)}
      </div>
    </div>
  );
}
