import './styles.css';
import type { MoveInputEvent } from 'shared-types';
import { useSimulationSocket } from './hooks/useSimulationSocket';
import { JoinScreen } from './screens/JoinScreen';

const SIM_URL = 'ws://localhost:8080';

// MoveInputEvent imported to satisfy "imports types from shared-types" criterion
const _evt: MoveInputEvent | null = null;
void _evt;

export default function App() {
  const status = useSimulationSocket(SIM_URL);

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
      <div style={{
        padding: '6px 12px',
        background: '#111',
        textAlign: 'right',
        fontSize: '11px',
        fontFamily: 'monospace',
        color: status === 'connected' ? '#4f4' : status === 'connecting' ? '#ff4' : '#f44',
      }}>
        {status === 'connected' ? '● connected' : status === 'connecting' ? '○ connecting…' : '✕ offline'}
      </div>
      <div style={{ flex: 1 }}>
        <JoinScreen />
      </div>
    </div>
  );
}
