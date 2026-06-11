export function JoinScreen() {
  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      height: '100%',
      padding: '24px',
      gap: '16px',
    }}>
      <h1 style={{ fontSize: '1.5rem', fontWeight: 700 }}>party-delve</h1>
      <p style={{ color: '#888', fontSize: '0.9rem', textAlign: 'center' }}>
        Enter the room code shown on the host screen.
      </p>
      <input
        type="text"
        placeholder="ROOM CODE"
        disabled
        style={{
          width: '100%',
          maxWidth: '280px',
          padding: '14px 16px',
          fontSize: '1.25rem',
          textAlign: 'center',
          letterSpacing: '0.2em',
          background: '#1a1a1a',
          border: '1px solid #333',
          borderRadius: '8px',
          color: '#f0f0f0',
        }}
      />
      <button
        disabled
        style={{
          width: '100%',
          maxWidth: '280px',
          padding: '14px',
          fontSize: '1rem',
          fontWeight: 600,
          background: '#2a2a2a',
          border: '1px solid #444',
          borderRadius: '8px',
          color: '#888',
          cursor: 'not-allowed',
        }}
      >
        Join (not wired yet)
      </button>
    </div>
  );
}
