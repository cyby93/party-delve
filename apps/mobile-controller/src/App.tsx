import { usePlayerSession } from './hooks/usePlayerSession';
import { ConnectedScreen } from './screens/ConnectedScreen';
import { JoinScreen } from './screens/JoinScreen';
import './styles.css';

const SIM_URL = 'ws://localhost:8081';

export default function App() {
  const session = usePlayerSession(SIM_URL);

  const statusColor =
    session.connectionStatus === 'connected'
      ? '#4f4'
      : session.connectionStatus === 'connecting'
        ? '#ff4'
        : '#f44';

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div
        style={{
          padding: '6px 12px',
          background: '#111',
          textAlign: 'right',
          fontSize: '11px',
          fontFamily: 'monospace',
          color: statusColor,
        }}
      >
        {session.connectionStatus === 'connected'
          ? '● connected'
          : session.connectionStatus === 'connecting'
            ? '○ connecting…'
            : '✕ offline'}
      </div>
      <div style={{ flex: 1, overflow: 'hidden' }}>
        {session.joinStatus === 'joined' &&
        session.playerId &&
        session.sessionId ? (
          <ConnectedScreen
            playerId={session.playerId}
            sessionId={session.sessionId}
          />
        ) : (
          <JoinScreen
            connectionStatus={session.connectionStatus}
            joinStatus={session.joinStatus}
            joinError={session.joinError}
            onJoin={session.join}
          />
        )}
      </div>
    </div>
  );
}
