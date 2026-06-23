import type { MobileSession } from '../session/mobile-session';
import type { GameState } from 'shared-types';

interface ControllerScreenProps {
  session: MobileSession | null;
  gameState: GameState | null;
}

export function ControllerScreen({ session: _session, gameState: _gameState }: ControllerScreenProps) {
  return (
    <div
      style={{
        height: '100%',
        background: 'var(--bg-base)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <p
        style={{
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-base)',
          color: 'var(--text-primary)',
          textAlign: 'center',
        }}
      >
        Hub World — Controller coming in Story 1.5
      </p>
    </div>
  );
}
