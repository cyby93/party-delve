import { Room, Client, CloseCode } from 'colyseus';
import type { GameState, PlayerState } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor, INTERACTIVE_HUB_POIS } from 'shared-types';
import type { PoiDefinition } from 'shared-types';
import { EventNames } from 'net-protocol';
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg, CooldownUpdateMsg } from 'net-protocol';
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
    class: null,
    x: spawn.x,
    y: spawn.y,
    hp: 100,
    maxHp: 100,
    isFrozen: false,
    isDown: false,
    isSpirit: false,
    sessionColor: SESSION_COLORS[slotIndex % SESSION_COLORS.length] ?? SessionColor.RED,
    downCount: 0,
    nearPoiId: null,
  };
}

export class GameRoom extends Room {
  private gameState!: GameState;
  private tickCount = 0;
  private tickTimer: ReturnType<typeof setInterval> | null = null;
  private inputQueue: Array<{ clientId: string; msg: InputEventMsg }> = [];
  // Tracks cooldown expiry timestamps per player per ability slot (ms since epoch).
  // Array index = abilityIndex (0–3). Value 0 = no cooldown active.
  // NOT part of GameState — purely server-local, not snapshotted.
  private cooldownMap = new Map<string, number[]>();
  private nextSlotIndex = 0;

  async onCreate(_options: unknown): Promise<void> {
    this.maxClients = MAX_PLAYERS + 1; // +1 for the host client slot
    this.gameState = createEmptyGameState(this.roomId);
    // Placeholder seed — replaced by xoshiro128++ in Story 3.1
    this.gameState.session.runSeed = (Math.random() * 0xffff_ffff) | 0;

    // host:start has no server-side effect yet (deferred to Story 3.x) — register a no-op
    // so Colyseus does not close the host connection with WITH_ERROR (4002)
    this.onMessage(EventNames.HOST_START, () => { /* intentionally empty */ });

    this.onMessage(EventNames.CLASS_SELECT, (client: Client, raw: unknown) => {
      try {
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { classId: unknown };
        const validClasses = Object.values(PlayerClass) as string[];
        if (typeof msg?.classId !== 'string' || !validClasses.includes(msg.classId)) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'invalid CLASS_SELECT payload — discarded');
          return;
        }
        const classId = msg.classId as PlayerClass;
        const player = this.gameState.players.find(p => p.id === client.sessionId);
        if (!player) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'CLASS_SELECT from unknown player — discarded');
          return;
        }
        if (player.isFrozen) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'CLASS_SELECT from frozen player — discarded');
          return;
        }
        player.class = classId;
        const delta = {
          type: 'player:class-updated' as const,
          playerId: client.sessionId,
          class: classId,
        } satisfies DeltaEventMsg;
        this.broadcast(EventNames.DELTA, delta);
        logger.info({ roomId: this.roomId, clientId: client.sessionId, classId }, 'player class confirmed');
      } catch {
        logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse CLASS_SELECT message — discarded');
      }
    });

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
    this.cooldownMap.set(client.sessionId, [0, 0, 0, 0]);

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
      this.cooldownMap.delete(client.sessionId);
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
      this.cooldownMap.delete(client.sessionId);
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

    // POI proximity — Euclidean distance check (planck.js sensor migration deferred to Story 3.1)
    for (const player of this.gameState.players) {
      if (player.isFrozen) continue;

      let matchedPoi: PoiDefinition | null = null;
      for (const poi of INTERACTIVE_HUB_POIS) {
        const dx = player.x - poi.x;
        const dy = player.y - poi.y;
        if (dx * dx + dy * dy < poi.radius * poi.radius) {
          matchedPoi = poi;
          break; // POIs don't overlap — first match wins
        }
      }
      const newPoiId = matchedPoi?.id ?? null;

      if (player.nearPoiId !== newPoiId) {
        player.nearPoiId = newPoiId;
        if (matchedPoi !== null) {
          const enteredDelta = {
            type: 'player:poi-entered' as const,
            playerId: player.id,
            poiId: matchedPoi.id,
            poiType: matchedPoi.type,
          } satisfies DeltaEventMsg;
          this.broadcast(EventNames.DELTA, enteredDelta);
        } else {
          const exitedDelta = {
            type: 'player:poi-exited' as const,
            playerId: player.id,
          } satisfies DeltaEventMsg;
          this.broadcast(EventNames.DELTA, exitedDelta);
        }
      }
    }

    // Process ability inputs — training dummy only (inline cooldown; Story 3.x moves to game-rules/balance.ts)
    const TRAINING_DUMMY_COOLDOWN_MS = 3000;
    for (const { clientId, msg } of this.inputQueue) {
      if (msg.event.type !== 'ability') continue;
      const { abilityIndex, directionX, directionY: _dirY } = msg.event.ability;

      const player = this.gameState.players.find(p => p.id === clientId);
      if (!player) continue;
      if (player.class === null) continue;
      if (player.nearPoiId !== 'training-dummy') continue;

      const playerCooldowns = this.cooldownMap.get(clientId);
      if (!playerCooldowns) continue;

      if (abilityIndex < 0 || abilityIndex > 3) continue;

      const nowAbility = Date.now();
      if ((playerCooldowns[abilityIndex] ?? 0) > nowAbility) continue;

      playerCooldowns[abilityIndex] = nowAbility + TRAINING_DUMMY_COOLDOWN_MS;

      const targetClient = this.clients.find(c => c.sessionId === clientId);
      if (targetClient) {
        targetClient.send(EventNames.COOLDOWN_UPDATE, {
          type: 'cooldown:update',
          abilityIndex,
          remainingMs: TRAINING_DUMMY_COOLDOWN_MS,
        } satisfies CooldownUpdateMsg);
      }

      logger.debug({ roomId: this.roomId, clientId, abilityIndex, directionX }, 'ability fired at training dummy');
    }

    this.inputQueue.length = 0;

    // Notify clients whose cooldowns have expired this tick
    const nowExpiry = Date.now();
    for (const [clientId, cooldowns] of this.cooldownMap) {
      for (let i = 0; i < cooldowns.length; i++) {
        const expiry = cooldowns[i];
        if (expiry !== undefined && expiry > 0 && nowExpiry >= expiry) {
          cooldowns[i] = 0;
          const targetClient = this.clients.find(c => c.sessionId === clientId);
          if (targetClient) {
            targetClient.send(EventNames.COOLDOWN_UPDATE, {
              type: 'cooldown:update',
              abilityIndex: i,
              remainingMs: 0,
            } satisfies CooldownUpdateMsg);
          }
        }
      }
    }

    // Periodic full snapshot every SNAPSHOT_INTERVAL_S seconds
    if (this.tickCount % (SNAPSHOT_INTERVAL_S * TICK_RATE_HZ) === 0) {
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, snapshot);
    }
  }
}
