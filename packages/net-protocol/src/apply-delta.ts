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
    case 'enemy:stomped':
      return state;  // ponytail: AoE slow applied in Story 3.4 combat system
    default:
      return state;
  }
}
