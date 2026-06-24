import { Room, Client, CloseCode } from 'colyseus';
import type { GameState, PlayerState } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor } from 'shared-types';
import { EventNames } from 'net-protocol';
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import { logger } from '../logger.js';

// Distinct session colors assigned per player slot index
const SESSION_COLORS: ReadonlyArray<SessionColor> = [
  SessionColor.RED, SessionColor.BLUE, SessionColor.GREEN, SessionColor.YELLOW,
  SessionColor.PURPLE, SessionColor.ORANGE, SessionColor.PINK, SessionColor.TEAL,
];

// Hub world spawn positions in virtual 1920×1080 pixel space
const SPAWN_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 960, y: 540 }, { x: 880, y: 540 }, { x: 1040, y: 540 }, { x: 920, y: 480 },
  { x: 1000, y: 480 }, { x: 880, y: 600 }, { x: 960, y: 600 }, { x: 1040, y: 600 },
];

function createEmptyGameState(roomId: string): GameState {
  return {
    session: {
      roomId,
      hostId: '',
      phase: 'lobby',
      playerCount: 0,
      maxPlayers: 8,
      runSeed: 0,
      levelIndex: 0,
    },
    players: [],
    enemies: [],
    bonds: [],
    essenceDrops: [],
    tick: 0,
  };
}

function createPlayer(id: string, displayName: string, slotIndex: number): PlayerState {
  const spawn = SPAWN_POSITIONS[slotIndex] ?? { x: 960, y: 540 };
  return {
    id,
    displayName,
    class: PlayerClass.STONEHIDE,
    x: spawn.x,
    y: spawn.y,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SESSION_COLORS[slotIndex % SESSION_COLORS.length] ?? SessionColor.RED,
    downCount: 0,
  };
}

export class GameRoom extends Room {
  private gameState!: GameState;
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private inputQueue: Array<{ clientId: string; msg: InputEventMsg }> = [];
  private nextSlotIndex = 0;

  async onCreate(_options: unknown): Promise<void> {
    this.maxClients = MAX_PLAYERS + 1; // +1 for the host client slot
    this.gameState = createEmptyGameState(this.roomId);
    // Placeholder seed — replaced by xoshiro128++ in Story 3.1
    this.gameState.session.runSeed = (Math.random() * 0xffff_ffff) | 0;

    // host:start has no server-side effect yet (deferred to Story 3.x) — register a no-op
    // so Colyseus does not close the host connection with WITH_ERROR (4002)
    this.onMessage('host:start', () => { /* intentionally empty */ });

    this.onMessage(EventNames.INPUT, (client: Client, raw: unknown) => {
      try {
        // Accept both plain object (new clients) and JSON string (older clients)
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as InputEventMsg;
        if (!msg?.event) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'malformed INPUT message — discarded');
          return;
        }
        this.inputQueue.push({ clientId: client.sessionId, msg });
      } catch {
        logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse INPUT message — discarded');
      }
    });

    this.tickTimer = setInterval(() => {
      try {
        this.tick();
      } catch (err: unknown) {
        logger.error({ err, roomId: this.roomId }, 'tick error — skipping frame');
      }
    }, 1000 / TICK_RATE_HZ);

    logger.info({ roomId: this.roomId }, 'GameRoom created');
  }

  onJoin(client: Client, options: Record<string, unknown> = {}): void {
    if (options['isHost'] === true) {
      this.gameState.session.hostId = client.sessionId;
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'host joined');
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      client.send(EventNames.SNAPSHOT, snapshot);
      return;
    }

    const rawName = [...String(options['playerName'] ?? '').trim()].slice(0, 32).join('');
    const displayName = rawName.length > 0 ? rawName : client.sessionId.slice(-6);
    const slotIndex = this.nextSlotIndex++;
    const player = createPlayer(client.sessionId, displayName, slotIndex);
    this.gameState.players.push(player);
    this.gameState.session.playerCount = this.gameState.players.length;

    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, snapshot);

    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player joined');
  }

  async onLeave(client: Client, code?: number): Promise<void> {
    const player = this.gameState.players.find(p => p.id === client.sessionId);
    if (!player) return;

    if (code === CloseCode.CONSENTED) {
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      this.gameState.session.playerCount = this.gameState.players.length;
      const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, delta);
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player left (consented)');
      return;
    }

    // Network drop — freeze in place, hold slot, notify host immediately, await reconnect
    player.isFrozen = true;
    const disconnectDelta = {
      type: 'player:disconnected' as const,
      playerId: client.sessionId,
    } satisfies DeltaEventMsg;
    this.broadcast(EventNames.DELTA, disconnectDelta);
    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player disconnected — grace period started');

    try {
      const reconnectedClient = await this.allowReconnection(client, RECONNECT_GRACE_S);
      player.isFrozen = false;
      const reconnectDelta = {
        type: 'player:reconnected' as const,
        playerId: reconnectedClient.sessionId,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, reconnectDelta);
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      reconnectedClient.send(EventNames.SNAPSHOT, snapshot);
      logger.info({ roomId: this.roomId, clientId: reconnectedClient.sessionId }, 'player reconnected');
    } catch {
      // Grace period expired — remove slot permanently
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      this.gameState.session.playerCount = this.gameState.players.length;
      const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, delta);
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'reconnect grace expired — player removed');
    }
  }

  onDispose(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    logger.info({ roomId: this.roomId }, 'GameRoom disposed');
  }

  private tick(): void {
    this.tickCount++;
    this.gameState.tick = this.tickCount;

    // Collect last joystick input per player (latest entry in queue wins)
    const joystickByPlayer = new Map<string, { x: number; y: number }>();
    for (const { clientId, msg } of this.inputQueue) {
      if (msg.event.type === 'joystick') {
        joystickByPlayer.set(clientId, msg.event.joystick);
      }
    }
    this.inputQueue.length = 0;

    // Apply movement — speed inline for Story 1.5; move to game-rules/balance.ts in Story 3.x
    const SPEED = 200; // pixels per second in virtual 1920×1080 space
    const DT = 1 / TICK_RATE_HZ; // seconds per tick

    for (const player of this.gameState.players) {
      if (player.isFrozen) continue;
      const joystick = joystickByPlayer.get(player.id);
      if (!joystick) continue;
      const { x, y } = joystick;
      if (Math.abs(x) < 0.05 && Math.abs(y) < 0.05) continue;
      player.x += x * SPEED * DT;
      player.y += y * SPEED * DT;
      const delta = {
        type: 'player:moved' as const,
        playerId: player.id,
        x: player.x,
        y: player.y,
      } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, delta);
    }

    // Periodic full snapshot every SNAPSHOT_INTERVAL_S seconds
    if (this.tickCount % (SNAPSHOT_INTERVAL_S * TICK_RATE_HZ) === 0) {
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, snapshot);
    }
  }
}
