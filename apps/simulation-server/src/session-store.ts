import { randomUUID } from 'node:crypto';
import type { WebSocket } from 'ws';

export interface PlayerSlot {
  playerId: string;
  socket: WebSocket;
  reconnectToken: string;
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
  private byPlayerSocket = new Map<WebSocket, PlayerSlot & { session: Session }>();

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
    const slot: PlayerSlot = { playerId, socket: playerSocket, reconnectToken };
    session.players.set(playerId, slot);
    this.byPlayerSocket.set(playerSocket, { ...slot, session });
    return slot;
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
      const { session, playerId } = playerEntry;
      session.players.delete(playerId);
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
