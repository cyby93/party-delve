import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';
import type { Vec2 } from 'shared-types';

export interface PlayerSlot {
  playerId: string;
  socket: WebSocket;
  reconnectToken: string;
  position: Vec2;
  pendingDirection: Vec2;
  connected: boolean;
}

export interface Session {
  sessionId: string;
  roomCode: string;
  hostSocket: WebSocket;
  players: Map<string, PlayerSlot>; // playerId → slot
}

export class SessionStore {
  private byRoomCode = new Map<string, Session>();
  private byHostSocket = new Map<WebSocket, Session>();
  // Stores { playerId, session } — NOT a copy of the slot, so handlers can mutate the live slot.
  private byPlayerSocket = new Map<WebSocket, { playerId: string; session: Session }>();

  createSession(hostSocket: WebSocket): Session {
    const sessionId = randomUUID();
    const roomCode = this.generateRoomCode();
    const session: Session = { sessionId, roomCode, hostSocket, players: new Map() };
    this.byRoomCode.set(roomCode, session);
    this.byHostSocket.set(hostSocket, session);
    return session;
  }

  findByRoomCode(roomCode: string): Session | undefined {
    return this.byRoomCode.get(roomCode.toUpperCase());
  }

  addPlayer(session: Session, playerSocket: WebSocket): PlayerSlot {
    const playerId = randomUUID();
    const reconnectToken = randomUUID();
    const slot: PlayerSlot = {
      playerId,
      socket: playerSocket,
      reconnectToken,
      position: { x: 0, y: 0 },
      pendingDirection: { x: 0, y: 0 },
      connected: true,
    };
    session.players.set(playerId, slot);
    this.byPlayerSocket.set(playerSocket, { playerId, session });
    return slot;
  }

  /** Returns the live PlayerSlot reference and its session for the given WebSocket. */
  findSlotBySocket(socket: WebSocket): { slot: PlayerSlot; session: Session } | undefined {
    const entry = this.byPlayerSocket.get(socket);
    if (!entry) return undefined;
    const slot = entry.session.players.get(entry.playerId);
    return slot ? { slot, session: entry.session } : undefined;
  }

  /** All active sessions — used by the movement tick. */
  allSessions(): Session[] {
    return Array.from(this.byRoomCode.values());
  }

  removeSocket(
    socket: WebSocket,
  ): { session: Session; role: 'host' | 'player'; playerId?: string } | undefined {
    const hostSession = this.byHostSocket.get(socket);
    if (hostSession) {
      this.byHostSocket.delete(socket);
      this.byRoomCode.delete(hostSession.roomCode);
      for (const slot of hostSession.players.values()) {
        this.byPlayerSocket.delete(slot.socket);
      }
      return { session: hostSession, role: 'host' };
    }
    const playerEntry = this.byPlayerSocket.get(socket);
    if (playerEntry) {
      const { playerId, session } = playerEntry;
      // Freeze the slot — keep it in session.players so the host canvas retains the dot.
      const slot = session.players.get(playerId);
      if (slot) {
        slot.connected = false;
        slot.pendingDirection = { x: 0, y: 0 };
      }
      this.byPlayerSocket.delete(socket);
      return { session, role: 'player', playerId };
    }
    return undefined;
  }

  allSockets(session: Session): WebSocket[] {
    return [
      session.hostSocket,
      ...Array.from(session.players.values()).map((p) => p.socket),
    ];
  }

  get sessionCount(): number {
    return this.byRoomCode.size;
  }

  private generateRoomCode(): string {
    // No O/0/I/1 to avoid visual confusion
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code: string;
    do {
      code = Array.from(
        { length: 4 },
        () => chars[Math.floor(Math.random() * chars.length)],
      ).join('');
    } while (this.byRoomCode.has(code));
    return code;
  }
}
