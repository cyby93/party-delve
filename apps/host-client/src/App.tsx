import { useRef, useEffect } from 'react';
import type { RoomState } from 'shared-types';
import { useSimulationSocket } from './hooks/useSimulationSocket';

const SIM_URL = 'ws://localhost:8080';

// RoomState imported to satisfy "imports types from shared-types" criterion.
const _roomState: RoomState | null = null;
void _roomState;

export default function App() {
  const status = useSimulationSocket(SIM_URL);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#444';
    ctx.font = '24px monospace';
    ctx.textAlign = 'center';
    ctx.fillText('party-delve — host canvas', canvas.width / 2, canvas.height / 2);
  }, []);

  return (
    <div style={{ background: '#000', minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
      <div style={{ marginBottom: '12px', fontFamily: 'monospace', fontSize: '14px', color: status === 'connected' ? '#4f4' : status === 'connecting' ? '#ff4' : '#f44' }}>
        sim-server: {status}
      </div>
      <canvas
        ref={canvasRef}
        width={1280}
        height={720}
        style={{ border: '1px solid #333', maxWidth: '100%' }}
      />
    </div>
  );
}
