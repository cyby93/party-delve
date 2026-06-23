import { useRef, useState, useCallback, useEffect } from 'react';
import type { PlayerState } from 'shared-types';
import { PlayerClass } from 'shared-types';

const HOLD_MS = 1500;

interface KickButtonProps {
  playerId: string;
  onKick: (id: string) => void;
}

function KickButton({ playerId, onKick }: KickButtonProps) {
  const [progress, setProgress] = useState(0);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const cancelHold = useCallback(() => {
    if (timerRef.current !== null) clearTimeout(timerRef.current);
    if (intervalRef.current !== null) clearInterval(intervalRef.current);
    timerRef.current = null;
    intervalRef.current = null;
    setProgress(0);
  }, []);

  // P2: clean up timers on unmount
  useEffect(() => () => cancelHold(), [cancelHold]);

  const startHold = useCallback(() => {
    // P5: prevent stacking timers on rapid pointer-down
    if (timerRef.current !== null) return;
    const startTime = Date.now();
    intervalRef.current = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.min((elapsed / HOLD_MS) * 100, 100));
    }, 30);
    timerRef.current = setTimeout(() => {
      cancelHold();
      onKick(playerId);
    }, HOLD_MS);
  }, [playerId, onKick, cancelHold]);

  return (
    <button
      onPointerDown={startHold}
      onPointerUp={cancelHold}
      onPointerLeave={cancelHold}
      aria-label="Kick player"
      style={{
        width: 32,
        height: 32,
        borderRadius: '50%',
        border: '1px solid var(--border)',
        background: `conic-gradient(var(--corruption-blood) ${progress}%, var(--bg-subtle) ${progress}%)`,
        color: 'var(--text-secondary)',
        cursor: 'pointer',
        fontSize: 16,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      ×
    </button>
  );
}

interface PlayerSlotProps {
  player: PlayerState;
  onKick: (id: string) => void;
}

export function PlayerSlot({ player, onKick }: PlayerSlotProps) {
  const classLabel =
    player.class === PlayerClass.STONEHIDE ? 'Class TBD' : player.class;

  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 'var(--spacing-1) 0',
        borderBottom: '1px solid var(--border)',
      }}
    >
      {/* P7: spacing token instead of raw pixel */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--spacing-1)' }}>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-base)',
            fontWeight: 700,
            color: 'var(--text-primary)',
          }}
        >
          {player.displayName}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            fontWeight: 400,
            color: 'var(--text-secondary)',
          }}
        >
          {classLabel}
        </span>
      </div>
      <KickButton playerId={player.id} onKick={onKick} />
    </div>
  );
}
