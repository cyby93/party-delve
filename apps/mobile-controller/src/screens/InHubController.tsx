import { useRef } from 'react';
import { VirtualJoystick } from '../components/VirtualJoystick';

interface Props {
  playerId: string;
  sessionId: string;
  sendMessage: (envelope: object) => void;
}

export function InHubController({ playerId, sessionId, sendMessage }: Props) {
  const seqRef = useRef(0);

  function sendMove(x: number, y: number) {
    sendMessage({
      v: 1,
      t: 'MoveInputEvent',
      p: {
        playerId,
        direction: { x, y },
        sequenceNumber: ++seqRef.current,
        timestamp: Date.now(),
      },
    });
  }

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        background: '#0d0d0d',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Minimal status bar */}
      <div
        style={{
          padding: '6px 12px',
          background: '#111',
          fontSize: '10px',
          fontFamily: 'monospace',
          color: '#555',
          display: 'flex',
          gap: '16px',
        }}
      >
        <span>session {sessionId.slice(0, 8)}</span>
        <span>player {playerId.slice(0, 8)}</span>
      </div>

      {/* Main area — players watch the host screen */}
      <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <span style={{ color: '#333', fontSize: '12px', fontFamily: 'monospace' }}>
          watch the host screen
        </span>
      </div>

      {/* Joystick anchored bottom-left */}
      <div
        style={{
          position: 'absolute',
          bottom: '32px',
          left: '32px',
        }}
      >
        <VirtualJoystick
          onDirectionChange={({ x, y }) => sendMove(x, y)}
          onRelease={() => sendMove(0, 0)}
        />
      </div>
    </div>
  );
}
