import type { GameState } from 'shared-types';
import type { DeltaEventMsg } from './messages/server-to-host.js';

export function applyDelta(state: GameState, evt: DeltaEventMsg): GameState {
  switch (evt.type) {
    case 'player:moved': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      const players = state.players.map(p =>
        p.id === evt.playerId ? { ...p, x: evt.x, y: evt.y } : p
      );
      return { ...state, players };
    }
    case 'player:left': {
      return { ...state, players: state.players.filter(p => p.id !== evt.playerId) };
    }
    case 'player:disconnected': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, isFrozen: true } : p
        ),
      };
    }
    case 'player:reconnected': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, isFrozen: false } : p
        ),
      };
    }
    case 'player:poi-entered': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, nearPoiId: evt.poiId } : p
        ),
      };
    }
    case 'player:poi-exited': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, nearPoiId: null } : p
        ),
      };
    }
    case 'player:class-updated': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      const players = state.players.map(p =>
        p.id === evt.playerId ? { ...p, class: evt.class } : p
      );
      return { ...state, players };
    }
    case 'player:downed': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      // bodyX/bodyY fall back together (both-or-neither), never one fresh + one
      // stale — a delta carrying only one axis would otherwise mix coordinates.
      // (Narrowing must stay inline per-field — hoisting the check into a shared
      // boolean loses TS's connection to evt.bodyX/evt.bodyY's own narrowing.)
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId
            ? {
                ...p,
                isDown: true,
                bodyX: evt.bodyX !== undefined && evt.bodyY !== undefined ? evt.bodyX : p.x,
                bodyY: evt.bodyX !== undefined && evt.bodyY !== undefined ? evt.bodyY : p.y,
                downCount: evt.downCount,
                reviveTimerExpiresAt: Date.now() + evt.reviveWindowMs,
              }
            : p
        ),
      };
    }
    case 'player:revived': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, isDown: false, reviveTimerExpiresAt: 0, channelingAbility: null } : p
        ),
      };
    }
    case 'player:hp-updated': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, hp: evt.hp } : p
        ),
      };
    }
    case 'player:spirit': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, isSpirit: true, isDown: false, reviveTimerExpiresAt: 0 } : p
        ),
      };
    }
    case 'enemy:damaged': {
      return {
        ...state,
        enemies: state.enemies.map(e =>
          e.id === evt.enemyId ? { ...e, hp: evt.remainingHp, isAlive: evt.remainingHp > 0 } : e
        ),
      };
    }
    case 'enemy:killed': {
      return { ...state, enemies: state.enemies.filter(e => e.id !== evt.enemyId) };
    }
    case 'essence:dropped': {
      return { ...state, essenceDrops: [...state.essenceDrops, evt.drop] };
    }
    case 'essence:collected': {
      return {
        ...state,
        essenceDrops: state.essenceDrops.filter(d => d.id !== evt.dropId),
        players: state.players.map(p =>
          p.id === evt.byPlayerId ? { ...p, essenceTotal: evt.newTotal } : p
        ),
      };
    }
    case 'enemy:stomped':
      return state;  // ponytail: event still fires from StompLayer but has no host visual today (pre-existing — DungeonScreen never rendered it); no-op like ability:fired
    case 'enemy:moved': {
      if (!state.enemies.some(e => e.id === evt.enemyId)) return state;
      const enemies = state.enemies.map(e =>
        e.id === evt.enemyId ? { ...e, x: evt.x, y: evt.y } : e
      );
      return { ...state, enemies };
    }
    case 'bond:assigned':
      if (state.activeBonds.some(b => b.playerA === evt.playerA && b.playerB === evt.playerB)) return state;
      return {
        ...state,
        activeBonds: [
          ...state.activeBonds,
          { playerA: evt.playerA, playerB: evt.playerB, type: evt.bondType, color: evt.bondColor },
        ],
      };
    case 'bond:price-active':
      return state; // ponytail: visual indicator only; HP changes come via separate player:hp-updated deltas
    case 'ability:fired':
      return state;  // ponytail: no-op on state — visual effect only; DungeonScreen reads raw delta
    case 'spirit-ability:fired':
      return state;  // ponytail: visual only — no GameState mutation
    case 'run:failed':
      return { ...state, session: { ...state.session, phase: 'post-run' } };
    case 'level:complete':
      return state;  // ponytail: visual only — canvas flash handled in DungeonScreen on event receipt
    case 'run:complete':
      return { ...state, session: { ...state.session, phase: 'post-run' } };
    case 'run:proposed':
      return { ...state, runProposal: { biome: evt.biome, difficulty: evt.difficulty, proposedBy: evt.proposedBy } };
    case 'run:starting':
      return { ...state, runProposal: null, session: { ...state.session, phase: 'dungeon', difficulty: evt.difficulty } };
    case 'wave:started':
      return { ...state, session: { ...state.session, waveIndex: evt.waveIndex, totalWaves: evt.totalWaves } };
    case 'wave:complete':
      return state;  // ponytail: transient; next wave:started updates waveIndex; snapshot reconciles
    case 'boss:damaged': {
      if (!state.boss) return state;
      return { ...state, boss: { ...state.boss, hp: evt.newHp } };
    }
    case 'boss:phaseChanged': {
      if (!state.boss) return state;
      return { ...state, boss: { ...state.boss, phase: evt.newPhase } };
    }
    case 'boss:defeated': {
      if (!state.boss) return state;
      return { ...state, boss: { ...state.boss, isDefeated: true } };
    }
    case 'boss:moved': {
      if (!state.boss) return state;
      return { ...state, boss: { ...state.boss, position: { x: evt.x, y: evt.y } } };
    }
    case 'boss:stomped':
      return state;  // ponytail: visual only; DungeonScreen reads raw delta
    case 'add:spawned':
      return state;  // ponytail: GrasslandAdds arrive via snapshot broadcast
    case 'status:applied': {
      if (state.players.some(p => p.id === evt.targetId)) {
        return {
          ...state,
          players: state.players.map(p =>
            p.id === evt.targetId
              ? {
                  ...p,
                  statusEffects: [
                    ...p.statusEffects.filter(se => se.type !== evt.effectType),
                    { type: evt.effectType, magnitude: evt.magnitude, expiresAtMs: evt.expiresAtMs },
                  ],
                }
              : p
          ),
        };
      }
      if (state.enemies.some(e => e.id === evt.targetId)) {
        return {
          ...state,
          enemies: state.enemies.map(e =>
            e.id === evt.targetId
              ? {
                  ...e,
                  statusEffects: [
                    ...e.statusEffects.filter(se => se.type !== evt.effectType),
                    { type: evt.effectType, magnitude: evt.magnitude, expiresAtMs: evt.expiresAtMs },
                  ],
                }
              : e
          ),
        };
      }
      return state;
    }
    case 'status:expired': {
      if (state.players.some(p => p.id === evt.targetId)) {
        return {
          ...state,
          players: state.players.map(p =>
            p.id === evt.targetId
              ? { ...p, statusEffects: p.statusEffects.filter(se => se.type !== evt.effectType) }
              : p
          ),
        };
      }
      if (state.enemies.some(e => e.id === evt.targetId)) {
        return {
          ...state,
          enemies: state.enemies.map(e =>
            e.id === evt.targetId
              ? { ...e, statusEffects: e.statusEffects.filter(se => se.type !== evt.effectType) }
              : e
          ),
        };
      }
      return state;
    }
    case 'projectile:moved': {
      if (!state.projectiles.some(p => p.id === evt.projectileId)) return state;
      const projectiles = state.projectiles.map(p =>
        p.id === evt.projectileId ? { ...p, x: evt.x, y: evt.y } : p
      );
      return { ...state, projectiles };
    }
    case 'projectile:hit': {
      return { ...state, projectiles: state.projectiles.filter(p => p.id !== evt.projectileId) };
    }
    case 'projectile:expired': {
      return { ...state, projectiles: state.projectiles.filter(p => p.id !== evt.projectileId) };
    }
    case 'zone:tick':
      return state;  // ponytail: effect reapplication comes via separate player:hp-updated/enemy:damaged deltas
    case 'zone:expired': {
      return { ...state, zones: state.zones.filter(z => z.id !== evt.zoneId) };
    }
    case 'zone:strike':
      return state;  // ponytail: visual-only, HP change comes via a separate enemy:damaged/enemy:killed delta
    case 'cast:started': {
      if (!state.players.some(p => p.id === evt.casterId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.casterId
            ? { ...p, channelingAbility: { abilityIndex: evt.abilityIndex, targetPlayerId: evt.targetPlayerId, startedAt: evt.startedAt, durationMs: evt.durationMs } }
            : p
        ),
      };
    }
    case 'cast:cancelled': {
      if (!state.players.some(p => p.id === evt.casterId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.casterId ? { ...p, channelingAbility: null } : p
        ),
      };
    }
    case 'cast:completed': {
      if (!state.players.some(p => p.id === evt.casterId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.casterId ? { ...p, channelingAbility: null } : p
        ),
      };
    }
    default: {
      // Exhaustiveness guard: adding a new DeltaEventMsg variant without a case here causes a TS error.
      const _exhaustive: never = evt;
      void _exhaustive;
      return state;
    }
  }
}
