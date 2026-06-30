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
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId
            ? { ...p, isDown: true, downCount: evt.downCount, reviveTimerExpiresAt: Date.now() + evt.reviveWindowMs }
            : p
        ),
      };
    }
    case 'player:revived': {
      if (!state.players.some(p => p.id === evt.playerId)) return state;
      return {
        ...state,
        players: state.players.map(p =>
          p.id === evt.playerId ? { ...p, isDown: false, reviveTimerExpiresAt: 0 } : p
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
      return state;  // ponytail: AoE slow applied in Story 3.5+
    case 'enemy:moved': {
      if (!state.enemies.some(e => e.id === evt.enemyId)) return state;
      const enemies = state.enemies.map(e =>
        e.id === evt.enemyId ? { ...e, x: evt.x, y: evt.y } : e
      );
      return { ...state, enemies };
    }
    case 'bond:assigned':
      return state;  // ponytail: bond display in Story 3.6
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
    default: {
      // Exhaustiveness guard: adding a new DeltaEventMsg variant without a case here causes a TS error.
      const _exhaustive: never = evt;
      void _exhaustive;
      return state;
    }
  }
}
