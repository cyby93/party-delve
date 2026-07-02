import type { GameState } from 'shared-types';
import { CLASS_DEFINITIONS } from 'shared-types';

interface PostRunSummaryScreenProps {
  gameState: GameState;
  runOutcome: 'complete' | 'failed';
}

export function PostRunSummaryScreen({ gameState, runOutcome }: PostRunSummaryScreenProps) {
  const isVictory = runOutcome === 'complete';
  const totalEssence = gameState.players.reduce((s, p) => s + p.essenceTotal, 0);
  const headline = isVictory
    ? 'Purified. The campfire noticed.'
    : 'Tonight, the forest held its ground.';

  return (
    <div style={{
      position: 'absolute',
      inset: 0,
      background: 'var(--bg-base)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 24,
      padding: '0 32px',
      boxSizing: 'border-box',
    }}>
      <div style={{
        fontFamily: 'var(--font-display)',
        fontSize: 40,
        color: isVictory ? 'var(--accent-spirit)' : 'var(--text-secondary)',
        textAlign: 'center',
        maxWidth: 800,
      }}>
        {headline}
      </div>

      <div style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 700,
        fontSize: 'var(--text-lg)',
        color: 'var(--accent-warm)',
        opacity: isVictory ? 1 : 0.5,
      }}>
        Spirit Essence earned: {totalEssence}
      </div>

      <div style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
        width: '100%',
        maxWidth: 640,
      }}>
        {gameState.players.map(player => {
          const className = player.class
            ? (CLASS_DEFINITIONS[player.class]?.displayName ?? player.class)
            : '—';
          const dimmed = !isVictory;
          return (
            <div key={player.id} style={{
              background: 'var(--bg-surface)',
              border: '1px solid var(--border)',
              borderRadius: 6,
              padding: '10px 16px',
              display: 'flex',
              alignItems: 'center',
              gap: 16,
            }}>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-base)',
                color: dimmed ? 'var(--text-secondary)' : 'var(--text-primary)',
                minWidth: 100,
              }}>
                {player.displayName}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                flex: 1,
              }}>
                {className}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 400,
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                minWidth: 80,
                textAlign: 'center',
              }}>
                Downed ×{player.downCount}
              </span>
              <span style={{
                fontFamily: 'var(--font-body)',
                fontWeight: 700,
                fontSize: 'var(--text-base)',
                color: 'var(--accent-warm)',
                minWidth: 60,
                textAlign: 'right',
              }}>
                {player.essenceTotal}
              </span>
            </div>
          );
        })}
      </div>

      <div style={{
        fontFamily: 'var(--font-body)',
        fontWeight: 400,
        fontSize: 'var(--text-sm)',
        color: 'var(--text-muted)',
        textAlign: 'center',
      }}>
        Return to Camp on your phone to continue
      </div>
    </div>
  );
}
