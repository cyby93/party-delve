import { Room, Client, CloseCode } from 'colyseus';
import type { GameState, PlayerState } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor } from 'shared-types';
import { serialize, deserialize, EventNames } from 'net-protocol';
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import { logger } from '../logger.js';

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

function createPlayer(id: string): PlayerState {
  return {
    id,
    class: PlayerClass.STONEHIDE,
    x: 0,
    y: 0,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SessionColor.RED,
    downCount: 0,
  };
}

export class GameRoom extends Room {
  private gameState!: GameState;
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private inputQueue: Array<{ clientId: string; msg: InputEventMsg }> = [];

  async onCreate(_options: unknown): Promise<void> {
    this.maxClients = MAX_PLAYERS;
    this.gameState = createEmptyGameState(this.roomId);
    // Placeholder seed — replaced by xoshiro128++ in Story 3.1
    this.gameState.session.runSeed = (Math.random() * 0xffff_ffff) | 0;

    this.onMessage(EventNames.INPUT, (client: Client, raw: string) => {
      try {
        const msg = deserialize<InputEventMsg>(raw);
        this.inputQueue.push({ clientId: client.sessionId, msg });
      } catch {
        logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'malformed INPUT message — discarded');
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

  onJoin(client: Client, _options: unknown): void {
    const player = createPlayer(client.sessionId);
    this.gameState.players.push(player);
    this.gameState.session.playerCount = this.gameState.players.length;

    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, serialize(snapshot));

    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player joined');
  }

  async onLeave(client: Client, code?: number): Promise<void> {
    const player = this.gameState.players.find(p => p.id === client.sessionId);
    if (!player) return;

    if (code === CloseCode.CONSENTED) {
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      this.gameState.session.playerCount = this.gameState.players.length;
      const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, serialize(delta));
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player left (consented)');
      return;
    }

    // Network drop — freeze in place, hold slot, await reconnect
    player.isFrozen = true;
    logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'player disconnected — grace period started');

    try {
      const reconnectedClient = await this.allowReconnection(client, RECONNECT_GRACE_S);
      player.isFrozen = false;
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      reconnectedClient.send(EventNames.SNAPSHOT, serialize(snapshot));
      logger.info({ roomId: this.roomId, clientId: reconnectedClient.sessionId }, 'player reconnected');
    } catch {
      // Grace period expired — remove slot permanently
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      this.gameState.session.playerCount = this.gameState.players.length;
      const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, serialize(delta));
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

    // Drain input queue — no processing yet; wired in Story 1.5
    this.inputQueue.length = 0;

    // Periodic full snapshot every SNAPSHOT_INTERVAL_S seconds
    if (this.tickCount % (SNAPSHOT_INTERVAL_S * TICK_RATE_HZ) === 0) {
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, serialize(snapshot));
    }
  }
}
