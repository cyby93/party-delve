import { Room, Client, CloseCode } from 'colyseus';
import type { GameState, PlayerState } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor, INTERACTIVE_HUB_POIS } from 'shared-types';
import { EventNames } from 'net-protocol';
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg, CooldownUpdateMsg, SpiritFormMsg, RunProposeMsg, VoteMsg } from 'net-protocol';
import { randomInt } from 'node:crypto';
import { Vec2, Body, Contact } from 'planck';
import type { World } from 'planck';
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody, createEssenceSensorBody,
  extractPoiBeginContact, extractPoiEndContact, extractEssenceBeginContact, toMeters, toPixels,
  createVictoryTriggerBody,
} from '../physics/world.js';
import type { PoiBeginContactEvent, PoiEndContactEvent, EssenceBeginContactEvent, PhysicsBodyData } from '../physics/world.js';
import { createRng, tickEnemy, dispatchAbility, getEnemyCount, applyDamage, isInHitZone, ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX, applyPlayerDamage, ENEMY_MELEE_DAMAGE, ENEMY_MELEE_RANGE_PX, ENEMY_ATTACK_COOLDOWN_MS, REVIVE_RADIUS_PX, REVIVE_HP, SPIRIT_ABILITY_COOLDOWN_MS, generateFloorLayout, GRASSLAND_ROOM_POOL, WAVE_COUNTS, WAVE_PAUSE_MS, WAVE_ENEMY_SCALE } from 'game-rules';
import type { BehaviorLayer, EnemyContext, EnemyAIEvent } from 'game-rules';
import { CLASS_DEFINITIONS } from 'shared-types';
import type { EnemyState } from 'shared-types';
import { EnemyType, DifficultyTier, EnemyFSMState, OFFSET_ENEMY_SPAWN, OFFSET_FLOOR_LAYOUT, OFFSET_ROOM_POOL } from 'shared-types';
import { createEnemyBody } from '../physics/world.js';
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

// Dungeon entry positions — left side of arena, clear of enemy spawn zone (x≥600)
const DUNGEON_SPAWN_POSITIONS: ReadonlyArray<{ x: number; y: number }> = [
  { x: 300, y: 540 }, { x: 300, y: 480 }, { x: 300, y: 600 }, { x: 240, y: 510 },
  { x: 240, y: 570 }, { x: 360, y: 510 }, { x: 360, y: 570 }, { x: 300, y: 420 },
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
      difficulty: null,
      levelObjective: 'clear',
      waveIndex: 0,
      totalWaves: 0,
    },
    players: [],
    enemies: [],
    activeBonds: [],
    essenceDrops: [],
    tick: 0,
    floorLayout: null,
    runProposal: null,
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
    essenceTotal: 0,
    reviveTimerExpiresAt: 0,
  };
}

// ponytail: 26^4 = 456,976 codes, 1 local room max — no collision check needed
export function generateRoomCode(): string {
  return Array.from({ length: 4 }, () =>
    String.fromCharCode(65 + Math.floor(Math.random() * 26))
  ).join('');
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
  private spiritCooldownMap = new Map<string, number>(); // playerId → spirit ability expiry epoch (0 = ready)
  private lastKnownJoystick = new Map<string, { x: number; y: number }>();
  private physicsWorld!: World;
  private playerBodies = new Map<string, Body>();
  private enemyBodies = new Map<string, Body>();
  private enemyLayers = new Map<string, BehaviorLayer[]>();
  private prng!: () => number;
  private pendingPoiBeginContacts: Array<PoiBeginContactEvent> = [];
  private pendingPoiEndContacts:   Array<PoiEndContactEvent>   = [];
  private essenceSensorBodies = new Map<string, Body>();
  private pendingEssenceBeginContacts: Array<EssenceBeginContactEvent> = [];
  private nextSlotIndex = 0;
  private enemyAttackCooldowns = new Map<string, number>(); // enemyId → expiry epoch ms
  private runVotes = new Map<string, 'accept' | 'decline'>();
  private victoryTriggerBody: Body | null = null;
  private pendingVictoryContact = false;
  private levelObjective: 'clear' | 'survive-waves' = 'clear';
  private waveIndex = 0;
  private totalWaves = 0;
  private wavePauseUntil = 0;
  private returnReadySet = new Set<string>();

  async onCreate(_options: unknown): Promise<void> {
    this.roomId = generateRoomCode();
    this.maxClients = MAX_PLAYERS + 1; // +1 for the host client slot
    this.gameState = createEmptyGameState(this.roomId);
    this.gameState.session.runSeed = randomInt(0, 0x1_0000_0000);
    this.prng = createRng(this.gameState.session.runSeed);

    this.onMessage(EventNames.HOST_START, (client: Client) => {
      if (client.sessionId !== this.gameState.session.hostId) return;
      if (this.gameState.session.phase === 'dungeon') return;
      if (this.gameState.players.length === 0) return;
      const unready = this.gameState.players.filter(p => p.class === null);
      if (unready.length > 0) {
        logger.warn({ roomId: this.roomId, unready: unready.length }, 'host:start rejected — players without class');
        return;
      }
      this.startDungeon(DifficultyTier.EASY);
    });

    this.onMessage(EventNames.RUN_PROPOSE, (client: Client, raw: unknown) => {
      try {
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as RunProposeMsg;
        // ponytail: server never transitions lobby→hub (LobbyScreen "Start Game" is UI-only); allow both
        if (this.gameState.session.phase === 'dungeon' || this.gameState.session.phase === 'post-run') return;
        if (this.gameState.runProposal !== null) return;
        const player = this.gameState.players.find(p => p.id === client.sessionId);
        if (!player || player.isFrozen) return;
        if (msg.biome !== 'grassland') {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'RUN_PROPOSE invalid biome — discarded');
          return;
        }
        if (!Object.values(DifficultyTier).includes(msg.difficulty as DifficultyTier)) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'RUN_PROPOSE invalid difficulty — discarded');
          return;
        }

        this.runVotes.clear();
        this.gameState.runProposal = { biome: msg.biome, difficulty: msg.difficulty, proposedBy: client.sessionId };
        const delta: DeltaEventMsg = { type: 'run:proposed', biome: msg.biome, difficulty: msg.difficulty, proposedBy: client.sessionId };
        this.broadcast(EventNames.DELTA, delta);
        logger.info({ roomId: this.roomId, proposedBy: client.sessionId, difficulty: msg.difficulty }, 'run proposed');
      } catch {
        logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse RUN_PROPOSE — discarded');
      }
    });

    this.onMessage(EventNames.VOTE, (client: Client, raw: unknown) => {
      try {
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as VoteMsg;
        if (this.gameState.session.phase === 'dungeon' || this.gameState.session.phase === 'post-run') return;
        if (this.gameState.runProposal === null) return;
        const player = this.gameState.players.find(p => p.id === client.sessionId);
        if (!player || player.isFrozen) return;

        if (!msg.accept) {
          this.gameState.runProposal = null;
          this.runVotes.clear();
          const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
          this.broadcast(EventNames.SNAPSHOT, snapshot);
          logger.info({ roomId: this.roomId, declinedBy: client.sessionId }, 'run proposal declined');
          return;
        }

        this.runVotes.set(client.sessionId, 'accept');

        this.resolveVoteIfComplete();
      } catch {
        logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'failed to parse VOTE — discarded');
      }
    });

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

    this.onMessage(EventNames.RETURN_TO_CAMP, (client: Client) => {
      if (this.gameState.session.phase !== 'post-run') return;
      this.returnReadySet.add(client.sessionId);
      this.checkReturnReady();
    });

    this.onMessage('debug:kill-all', (_client: Client) => {
      if (this.gameState.session.phase !== 'dungeon') return;
      for (const enemy of this.gameState.enemies) {
        if (!enemy.isAlive) continue;
        enemy.isAlive = false;
        this.broadcast(EventNames.DELTA, {
          type: 'enemy:killed' as const,
          enemyId: enemy.id,
          byPlayerId: '',
        } satisfies DeltaEventMsg);
        const body = this.enemyBodies.get(enemy.id);
        if (body) { this.physicsWorld.destroyBody(body); this.enemyBodies.delete(enemy.id); }
        this.enemyAttackCooldowns.delete(enemy.id);
      }
      logger.info({ roomId: this.roomId }, 'debug:kill-all — all enemies killed');
    });

    // Initialize physics world
    this.physicsWorld = createPhysicsWorld();

    // Create static sensor bodies for interactive hub POIs
    for (const poi of INTERACTIVE_HUB_POIS) {
      createPoiSensorBody(this.physicsWorld, poi);
    }

    // Contact listeners — capture events during world.step() for processing after
    this.physicsWorld.on('begin-contact', (contact: Contact) => {
      const poiEvt = extractPoiBeginContact(contact);
      if (poiEvt) this.pendingPoiBeginContacts.push(poiEvt);
      const essenceEvt = extractEssenceBeginContact(contact);
      if (essenceEvt) this.pendingEssenceBeginContacts.push(essenceEvt);
      if (this.victoryTriggerBody) {
        const bodyA = contact.getFixtureA().getBody();
        const bodyB = contact.getFixtureB().getBody();
        if (bodyA === this.victoryTriggerBody || bodyB === this.victoryTriggerBody) {
          const otherBody = bodyA === this.victoryTriggerBody ? bodyB : bodyA;
          const data = otherBody.getUserData() as PhysicsBodyData | null;
          if (data?.type === 'player') {
            const player = this.gameState.players.find(p => p.id === data.playerId);
            if (player && !player.isFrozen && !player.isDown && !player.isSpirit) {
              this.pendingVictoryContact = true;
            }
          }
        }
      }
    });
    this.physicsWorld.on('end-contact', (contact: Contact) => {
      const evt = extractPoiEndContact(contact);
      if (evt) this.pendingPoiEndContacts.push(evt);
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
    this.spiritCooldownMap.set(client.sessionId, 0);

    // Create physics body at this player's spawn position
    const body = createPlayerBody(this.physicsWorld, client.sessionId, player.x, player.y);
    this.playerBodies.set(client.sessionId, body);

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
      this.spiritCooldownMap.delete(client.sessionId);
      this.lastKnownJoystick.delete(client.sessionId);
      const leaveBody = this.playerBodies.get(client.sessionId);
      if (leaveBody) {
        this.physicsWorld.destroyBody(leaveBody);
        this.playerBodies.delete(client.sessionId);
      }
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
    // Freezing this player may unblock a unanimous vote or return-to-camp confirmation.
    this.resolveVoteIfComplete();
    this.checkReturnReady();

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
      this.spiritCooldownMap.delete(client.sessionId);
      this.lastKnownJoystick.delete(client.sessionId);
      const expireBody = this.playerBodies.get(client.sessionId);
      if (expireBody) {
        this.physicsWorld.destroyBody(expireBody);
        this.playerBodies.delete(client.sessionId);
      }
      const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, delta);
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'reconnect grace expired — player removed');
      // Removing this player may unblock a unanimous vote or return-to-camp confirmation.
      this.resolveVoteIfComplete();
      this.checkReturnReady();
    }
  }

  onDispose(): void {
    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    for (const body of this.playerBodies.values()) {
      this.physicsWorld.destroyBody(body);
    }
    this.playerBodies.clear();
    for (const body of this.enemyBodies.values()) {
      this.physicsWorld.destroyBody(body);
    }
    this.enemyBodies.clear();
    this.enemyLayers.clear();
    this.enemyAttackCooldowns.clear();
    this.spiritCooldownMap.clear();
    for (const body of this.essenceSensorBodies.values()) {
      this.physicsWorld.destroyBody(body);
    }
    this.essenceSensorBodies.clear();
    if (this.victoryTriggerBody) {
      this.physicsWorld.destroyBody(this.victoryTriggerBody);
      this.victoryTriggerBody = null;
    }
    this.pendingPoiBeginContacts.length = 0;
    this.pendingPoiEndContacts.length = 0;
    this.pendingEssenceBeginContacts.length = 0;
    logger.info({ roomId: this.roomId }, 'GameRoom disposed');
  }

  private resolveVoteIfComplete(): void {
    if (this.gameState.runProposal === null) return;
    const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
    if (activePlayers.length === 0) return;
    if (activePlayers.some(p => p.class === null)) return;
    if (!activePlayers.every(p => this.runVotes.get(p.id) === 'accept')) return;
    const proposal = this.gameState.runProposal;
    const startDelta: DeltaEventMsg = { type: 'run:starting', biome: proposal.biome, difficulty: proposal.difficulty };
    this.broadcast(EventNames.DELTA, startDelta);
    this.startDungeon(proposal.difficulty);
    logger.info({ roomId: this.roomId, difficulty: proposal.difficulty }, 'run starting — unanimous accept');
  }

  private startDungeon(difficulty: DifficultyTier): void {
    this.gameState.session.phase = 'dungeon';
    this.gameState.session.difficulty = difficulty;
    this.gameState.runProposal = null;
    for (const p of this.gameState.players) p.nearPoiId = null;
    const floorRng = createRng(this.gameState.session.runSeed ^ OFFSET_FLOOR_LAYOUT);
    const roomRng  = createRng(this.gameState.session.runSeed ^ OFFSET_ROOM_POOL);
    this.gameState.floorLayout = generateFloorLayout(floorRng, roomRng, 'early', GRASSLAND_ROOM_POOL);
    this.loadLevel(1);
    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, snapshot);
    logger.info({ roomId: this.roomId, difficulty }, 'dungeon phase started');
  }

  private spawnEnemies(tier: 'early' | 'mid' | 'late', levelIndex: number): void {
    const count = getEnemyCount(this.gameState.players.length, tier);
    const enemyPrng = createRng(this.gameState.session.runSeed ^ (OFFSET_ENEMY_SPAWN | (levelIndex << 8)));
    const difficulty = this.gameState.session.difficulty ?? DifficultyTier.EASY;
    for (let i = 0; i < count; i++) {
      const id = `enemy-L${levelIndex}-${i}`;
      const x = 600 + enemyPrng() * 1120;
      const y = 200 + enemyPrng() * 680;
      const enemy: EnemyState = {
        id,
        type: EnemyType.GRUNT,
        x,
        y,
        hp: 60,
        maxHp: 60,
        difficultyTier: difficulty,
        isAlive: true,
        fsmState: EnemyFSMState.IDLE,
        attackCooldownTicks: 0,
      };
      this.gameState.enemies.push(enemy);
      const body = createEnemyBody(this.physicsWorld, id, x, y);
      this.enemyBodies.set(id, body);
      this.enemyAttackCooldowns.set(id, 0);
    }
    logger.info({ roomId: this.roomId, count, tier, levelIndex }, 'enemies spawned');
  }

  private spawnWave(waveNum: number, tier: 'early' | 'mid' | 'late', levelIndex: number): void {
    // Remove dead bodies from previous wave
    for (const enemy of this.gameState.enemies) {
      if (!enemy.isAlive) {
        const body = this.enemyBodies.get(enemy.id);
        if (body) {
          this.physicsWorld.destroyBody(body);
          this.enemyBodies.delete(enemy.id);
        }
        this.enemyAttackCooldowns.delete(enemy.id);
      }
    }
    this.gameState.enemies = this.gameState.enemies.filter(e => e.isAlive);

    const baseCount = getEnemyCount(this.gameState.players.length, tier);
    const scaleIndex = Math.min(waveNum - 1, WAVE_ENEMY_SCALE.length - 1);
    const count = Math.max(1, Math.ceil(baseCount * (WAVE_ENEMY_SCALE[scaleIndex] ?? 1.0)));
    const waveRng = createRng(
      this.gameState.session.runSeed ^ (OFFSET_ENEMY_SPAWN | (levelIndex << 8) | (waveNum << 4))
    );
    const difficulty = this.gameState.session.difficulty ?? DifficultyTier.EASY;

    for (let i = 0; i < count; i++) {
      const id = `enemy-L${levelIndex}-W${waveNum}-${i}`;
      const x = 1200 + waveRng() * 650;  // right-half spawn: 1200–1850
      const y = 100  + waveRng() * 880;
      const enemy: EnemyState = {
        id, type: EnemyType.GRUNT, x, y,
        hp: 60, maxHp: 60, difficultyTier: difficulty,
        isAlive: true, fsmState: EnemyFSMState.IDLE, attackCooldownTicks: 0,
      };
      this.gameState.enemies.push(enemy);
      const body = createEnemyBody(this.physicsWorld, id, x, y);
      this.enemyBodies.set(id, body);
      this.enemyAttackCooldowns.set(id, 0);
    }

    this.waveIndex = waveNum;
    this.gameState.session.waveIndex = waveNum;
    this.wavePauseUntil = 0;

    this.broadcast(EventNames.DELTA, {
      type: 'wave:started' as const,
      waveIndex: waveNum,
      totalWaves: this.totalWaves,
    } satisfies DeltaEventMsg);
    logger.info({ roomId: this.roomId, levelIndex, waveNum, count, tier }, 'wave started');
  }

  private checkReturnReady(): void {
    if (this.gameState.session.phase !== 'post-run') return;
    const activePlayers = this.gameState.players.filter(p => !p.isFrozen);
    if (activePlayers.length > 0 && activePlayers.every(p => this.returnReadySet.has(p.id))) {
      this.resetToHub();
    }
  }

  private resetToHub(): void {
    // Destroy enemy physics bodies
    for (const [id, body] of this.enemyBodies) {
      this.physicsWorld.destroyBody(body);
      this.enemyBodies.delete(id);
    }
    this.enemyLayers.clear();
    // Destroy victory trigger body if present
    if (this.victoryTriggerBody) {
      this.physicsWorld.destroyBody(this.victoryTriggerBody);
      this.victoryTriggerBody = null;
    }
    // Destroy essence sensor bodies
    for (const [, body] of this.essenceSensorBodies) {
      this.physicsWorld.destroyBody(body);
    }
    this.essenceSensorBodies.clear();

    // Clear game state arrays
    this.gameState.enemies = [];
    this.gameState.essenceDrops = [];
    this.gameState.activeBonds = [];

    // Reset each player to hub spawn
    for (let i = 0; i < this.gameState.players.length; i++) {
      const player = this.gameState.players[i]!;
      const spawn = SPAWN_POSITIONS[i] ?? { x: 960, y: 540 };
      player.x = spawn.x;
      player.y = spawn.y;
      player.hp = player.maxHp;
      player.isDown = false;
      player.isSpirit = false;
      player.isFrozen = false;
      player.nearPoiId = null;
      player.reviveTimerExpiresAt = 0;
      player.essenceTotal = 0;
      player.downCount = 0;
      const body = this.playerBodies.get(player.id);
      if (body) {
        body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
        body.setLinearVelocity(Vec2(0, 0));
      }
    }

    // Reset session
    this.gameState.session.phase = 'hub';
    this.gameState.session.levelIndex = 0;

    // Clear server-local dungeon state
    this.returnReadySet.clear();
    this.inputQueue = [];
    this.cooldownMap.clear();
    this.spiritCooldownMap.clear();
    for (const p of this.gameState.players) {
      this.cooldownMap.set(p.id, [0, 0, 0, 0]);
      this.spiritCooldownMap.set(p.id, 0);
    }
    this.lastKnownJoystick.clear();
    this.enemyAttackCooldowns.clear();
    this.runVotes.clear();
    this.pendingPoiBeginContacts = [];
    this.pendingPoiEndContacts = [];
    this.pendingEssenceBeginContacts = [];
    this.pendingVictoryContact = false;
    this.waveIndex = 0;
    this.totalWaves = 0;
    this.wavePauseUntil = 0;
    this.levelObjective = 'clear';

    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, snapshot);
    logger.info({ roomId: this.roomId }, 'all players returned to camp — hub reset');
  }

  private loadLevel(index: number): void {
    // Clear current enemies
    for (const body of this.enemyBodies.values()) this.physicsWorld.destroyBody(body);
    this.enemyBodies.clear();
    this.enemyLayers.clear();
    this.enemyAttackCooldowns.clear();
    this.gameState.enemies = [];

    // Clear essence drops
    for (const body of this.essenceSensorBodies.values()) this.physicsWorld.destroyBody(body);
    this.essenceSensorBodies.clear();
    this.gameState.essenceDrops = [];

    // Clear previous victory trigger
    if (this.victoryTriggerBody) {
      this.physicsWorld.destroyBody(this.victoryTriggerBody);
      this.victoryTriggerBody = null;
    }
    this.pendingVictoryContact = false;

    // Auto-revive downed/spirit players; carry downCount (shorter next revive window)
    for (const player of this.gameState.players) {
      if (player.isDown || player.isSpirit) {
        player.isDown = false;
        player.isSpirit = false;
        player.reviveTimerExpiresAt = 0;
        player.hp = REVIVE_HP;
      }
      const spawnIdx = this.gameState.players.indexOf(player);
      const spawn = DUNGEON_SPAWN_POSITIONS[spawnIdx] ?? { x: 400, y: 540 };
      player.x = spawn.x;
      player.y = spawn.y;
      const body = this.playerBodies.get(player.id);
      if (body) body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
    }

    this.gameState.session.levelIndex = index;

    if (index >= 4) {
      // Boss placeholder: empty room with a victory trigger zone at the far end
      this.victoryTriggerBody = createVictoryTriggerBody(this.physicsWorld, 1700, 540, 120);
      logger.info({ roomId: this.roomId }, 'boss placeholder level loaded — victory trigger at (1700, 540)');
    } else if (index === 2) {
      this.levelObjective = 'survive-waves';
      this.totalWaves = WAVE_COUNTS['mid'];
      this.waveIndex = 0;
      this.wavePauseUntil = 0;
      this.gameState.session.levelObjective = 'survive-waves';
      this.gameState.session.waveIndex = 0;
      this.gameState.session.totalWaves = this.totalWaves;
      this.spawnWave(1, 'mid', index);
    } else {
      this.levelObjective = 'clear';
      this.waveIndex = 0; this.totalWaves = 0; this.wavePauseUntil = 0;
      this.gameState.session.levelObjective = 'clear';
      this.gameState.session.waveIndex = 0;
      this.gameState.session.totalWaves = 0;
      const tier = index === 1 ? 'early' : 'late';
      this.spawnEnemies(tier, index);
    }
  }

  private buildEnemyContext(enemy: EnemyState): EnemyContext {
    const dt = 1 / TICK_RATE_HZ;
    const targetable = this.gameState.players.filter(
      p => !p.isFrozen && !p.isDown && !p.isSpirit,
    );
    if (targetable.length === 0) {
      return { nearestPlayerPos: null, nearestPlayerDistance: Infinity, dt };
    }
    let minDist = Infinity;
    let nearest = targetable[0]!;
    for (const p of targetable) {
      const dx = p.x - enemy.x;
      const dy = p.y - enemy.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < minDist) {
        minDist = dist;
        nearest = p;
      }
    }
    return { nearestPlayerPos: { x: nearest.x, y: nearest.y }, nearestPlayerDistance: minDist, dt };
  }

  private tick(): void {
    this.tickCount++;
    this.gameState.tick = this.tickCount;

    // Drain joystick events into persistent map (latest entry per player wins).
    // WARNING: both this loop and the ability loop below read inputQueue before it is cleared.
    // Do not move the inputQueue.length = 0 clear above either loop.
    for (const { clientId, msg } of this.inputQueue) {
      if (msg.event.type === 'joystick') {
        this.lastKnownJoystick.set(clientId, msg.event.joystick);
      }
    }

    // ── Planck phase 1: set player body velocities ──────────────────────────────
    const SPEED = 200; // pixels per second in virtual 1920×1080 space
    const DT = 1 / TICK_RATE_HZ;

    for (const player of this.gameState.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;

      if (player.isFrozen || player.class === null) {
        body.setLinearVelocity(Vec2(0, 0));
        continue;
      }

      const joystick = this.lastKnownJoystick.get(player.id);
      const jx = joystick?.x ?? 0;
      const jy = joystick?.y ?? 0;
      const inDeadzone = Math.abs(jx) < 0.05 && Math.abs(jy) < 0.05;

      body.setLinearVelocity(inDeadzone
        ? Vec2(0, 0)
        : Vec2(toMeters(jx * SPEED), toMeters(jy * SPEED))
      );
    }

    // ── Planck phase 2: step world (integrates velocities + fires contact events) ─
    this.physicsWorld.step(DT, 8, 3);

    // ── Planck phase 3: read back positions, broadcast player:moved deltas ───────
    for (const player of this.gameState.players) {
      const body = this.playerBodies.get(player.id);
      if (!body) continue;

      const pos = body.getPosition();
      const newX = toPixels(pos.x);
      const newY = toPixels(pos.y);

      if (Math.abs(newX - player.x) > 0.5 || Math.abs(newY - player.y) > 0.5) {
        player.x = newX;
        player.y = newY;
        const delta = {
          type: 'player:moved' as const,
          playerId: player.id,
          x: player.x,
          y: player.y,
        } satisfies DeltaEventMsg;
        this.broadcast(EventNames.DELTA, delta);
      }
    }

    // ── Planck phase 4: process POI contact events from this tick's world.step() ─
    // POI interactions only apply in hub phase — skip (but always drain) during dungeon.
    if (this.gameState.session.phase !== 'dungeon') {
      for (const { playerId, poiId, poiType } of this.pendingPoiBeginContacts) {
        const player = this.gameState.players.find(p => p.id === playerId);
        if (!player || player.nearPoiId === poiId) continue;
        player.nearPoiId = poiId;
        const enteredDelta = {
          type: 'player:poi-entered' as const,
          playerId,
          poiId,
          poiType,
        } satisfies DeltaEventMsg;
        this.broadcast(EventNames.DELTA, enteredDelta);
      }
      for (const { playerId, poiId } of this.pendingPoiEndContacts) {
        const player = this.gameState.players.find(p => p.id === playerId);
        if (!player || player.nearPoiId !== poiId) continue;
        player.nearPoiId = null;
        const exitedDelta = {
          type: 'player:poi-exited' as const,
          playerId,
        } satisfies DeltaEventMsg;
        this.broadcast(EventNames.DELTA, exitedDelta);
      }
    }
    this.pendingPoiBeginContacts.length = 0;
    this.pendingPoiEndContacts.length = 0;

    // ── Flush essence collection contacts ────────────────────────────────────
    for (const { playerId, dropId } of this.pendingEssenceBeginContacts) {
      const dropIdx = this.gameState.essenceDrops.findIndex(d => d.id === dropId);
      if (dropIdx === -1) continue;  // already collected this tick

      const drop = this.gameState.essenceDrops[dropIdx]!;
      const player = this.gameState.players.find(p => p.id === playerId);
      if (!player) continue;

      this.gameState.essenceDrops.splice(dropIdx, 1);

      const sensorBody = this.essenceSensorBodies.get(dropId);
      if (sensorBody) {
        this.physicsWorld.destroyBody(sensorBody);
        this.essenceSensorBodies.delete(dropId);
      }

      player.essenceTotal += drop.amount;

      this.broadcast(EventNames.DELTA, {
        type: 'essence:collected' as const,
        dropId,
        byPlayerId: playerId,
        newTotal: player.essenceTotal,
      } satisfies DeltaEventMsg);
    }
    this.pendingEssenceBeginContacts.length = 0;

    // ── Enemy AI phase ──────────────────────────────────────────────────────────
    // Loop is no-op until enemies are spawned (Story 3.3+)
    for (const enemy of this.gameState.enemies) {
      if (!enemy.isAlive) continue;

      const ctx = this.buildEnemyContext(enemy);
      const layers = this.enemyLayers.get(enemy.id) ?? [];
      const result = tickEnemy(enemy, ctx, layers);

      if (!result.ok) {
        logger.debug({ roomId: this.roomId, enemyId: enemy.id, error: result.error }, 'enemy AI error — skipping');
        continue;
      }

      for (const aiEvt of result.value) {
        const delta: DeltaEventMsg = aiEvt;

        if (aiEvt.type === 'enemy:moved') {
          const body = this.enemyBodies.get(enemy.id);
          if (body) {
            body.setPosition(Vec2(toMeters(enemy.x), toMeters(enemy.y)));
          }
        }

        this.broadcast(EventNames.DELTA, delta);
      }
    }

    // Process ability inputs — valid in dungeon phase or near training dummy
    for (const { clientId, msg } of this.inputQueue) {
      if (msg.event.type !== 'ability') continue;
      const { abilityIndex, directionX, directionY } = msg.event.ability;

      const player = this.gameState.players.find(p => p.id === clientId);
      if (!player || player.class === null || player.isFrozen || player.isDown || player.isSpirit) continue;

      const inDungeon = this.gameState.session.phase === 'dungeon';
      const atTrainingDummy = player.nearPoiId === 'training-dummy';
      if (!inDungeon && !atTrainingDummy) continue;

      const playerCooldowns = this.cooldownMap.get(clientId);
      if (!playerCooldowns) continue;

      const nowAbility = Date.now();
      const result = dispatchAbility({
        playerClass: player.class,
        abilityIndex,
        directionX,
        directionY,
        cooldownExpiresAt: playerCooldowns[abilityIndex] ?? 0,
        nowMs: nowAbility,
      });

      if (!result.ok) continue;

      const { cooldownMs, expiresAt, directionX: dirX, directionY: dirY } = result.value;
      playerCooldowns[abilityIndex] = expiresAt;

      const targetClient = this.clients.find(c => c.sessionId === clientId);
      if (targetClient) {
        targetClient.send(EventNames.COOLDOWN_UPDATE, {
          type: 'cooldown:update',
          abilityIndex,
          remainingMs: cooldownMs,
        } satisfies CooldownUpdateMsg);
      }

      if (inDungeon) {
        const abilityDelta = {
          type: 'ability:fired' as const,
          playerId: clientId,
          abilityIndex,
          directionX: dirX,
          directionY: dirY,
        } satisfies DeltaEventMsg;
        this.broadcast(EventNames.DELTA, abilityDelta);

        // Hit-scan: check all living enemies against this ability's hit zone
        const abilityDef = CLASS_DEFINITIONS[player.class].abilities[abilityIndex];
        if (!abilityDef) continue;
        const isDirectional = abilityDef.inputType !== 'TAP';
        const hitRange  = ABILITY_HIT_RANGE_PX[player.class][abilityIndex] ?? 0;
        const hitRadius = ABILITY_HIT_RADIUS_PX[player.class][abilityIndex] ?? 60;
        const damage    = result.value.damage;
        if (damage <= 0) continue;  // ponytail: skip hit-scan for buff/heal abilities (damage=0 in balance table)

        for (let ei = 0; ei < this.gameState.enemies.length; ei++) {
          const enemy = this.gameState.enemies[ei]!;
          if (!enemy.isAlive) continue;
          if (!isInHitZone(player.x, player.y, dirX, dirY, enemy.x, enemy.y, hitRadius, hitRange, isDirectional)) continue;

          const dropId = `drop-${this.tickCount}-${enemy.id}`;
          const dmgResult = applyDamage(enemy, damage, dropId);
          if (!dmgResult.ok) continue;

          this.gameState.enemies[ei] = dmgResult.value.enemy;

          this.broadcast(EventNames.DELTA, {
            type: 'enemy:damaged' as const,
            enemyId: enemy.id,
            damage,
            remainingHp: dmgResult.value.enemy.hp,
          } satisfies DeltaEventMsg);

          if (dmgResult.value.killed) {
            this.broadcast(EventNames.DELTA, {
              type: 'enemy:killed' as const,
              enemyId: enemy.id,
              byPlayerId: clientId,
            } satisfies DeltaEventMsg);

            const enemyBody = this.enemyBodies.get(enemy.id);
            if (enemyBody) {
              this.physicsWorld.destroyBody(enemyBody);
              this.enemyBodies.delete(enemy.id);
            }
            this.enemyAttackCooldowns.delete(enemy.id);

            const drop = dmgResult.value.essenceDrop!;
            this.gameState.essenceDrops.push(drop);
            this.broadcast(EventNames.DELTA, {
              type: 'essence:dropped' as const,
              drop,
            } satisfies DeltaEventMsg);

            const sensor = createEssenceSensorBody(this.physicsWorld, drop.id, drop.x, drop.y);
            this.essenceSensorBodies.set(drop.id, sensor);
          }
        }
      }

      logger.debug({ roomId: this.roomId, clientId, abilityIndex, dirX, dirY }, 'ability fired');
    }

    // ── Spirit ability dispatch ───────────────────────────────────────────────
    if (this.gameState.session.phase === 'dungeon') {
      const nowSpirit = Date.now();
      for (const { clientId, msg } of this.inputQueue) {
        if (msg.event.type !== 'ability') continue;
        if (msg.event.ability.abilityIndex !== 3) continue;

        const player = this.gameState.players.find(p => p.id === clientId);
        if (!player || !player.isSpirit || player.class === null || player.isFrozen) continue;

        const spiritExpiry = this.spiritCooldownMap.get(clientId) ?? 0;
        if (spiritExpiry > nowSpirit) continue;

        this.spiritCooldownMap.set(clientId, nowSpirit + SPIRIT_ABILITY_COOLDOWN_MS);

        this.broadcast(EventNames.DELTA, {
          type: 'spirit-ability:fired' as const,
          playerId: clientId,
          class: player.class,
        } satisfies DeltaEventMsg);

        const targetClient = this.clients.find(c => c.sessionId === clientId);
        if (targetClient) {
          targetClient.send(EventNames.COOLDOWN_UPDATE, {
            type: 'cooldown:update',
            abilityIndex: 3,
            remainingMs: SPIRIT_ABILITY_COOLDOWN_MS,
          } satisfies CooldownUpdateMsg);
        }

        logger.debug({ roomId: this.roomId, clientId, class: player.class }, 'spirit ability fired');
      }
    }

    this.inputQueue.length = 0;

    // ── Enemy melee attacks ───────────────────────────────────────────────────
    if (this.gameState.session.phase === 'dungeon') {
      const nowMelee = Date.now();

      for (const enemy of this.gameState.enemies) {
        if (!enemy.isAlive) continue;
        // ponytail: only ATTACK-state enemies deal melee damage; FSM handles transitions
        if (enemy.fsmState !== EnemyFSMState.ATTACK) continue;

        const attackExpiry = this.enemyAttackCooldowns.get(enemy.id) ?? 0;
        if (attackExpiry > nowMelee) continue;

        let targetPlayer: (typeof this.gameState.players)[0] | null = null;
        let minDist = Infinity;
        for (const player of this.gameState.players) {
          if (player.isDown || player.isSpirit || player.isFrozen) continue;
          const dx = player.x - enemy.x;
          const dy = player.y - enemy.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < ENEMY_MELEE_RANGE_PX && dist < minDist) {
            minDist = dist;
            targetPlayer = player;
          }
        }
        if (!targetPlayer) continue;

        const dmgResult = applyPlayerDamage(targetPlayer, ENEMY_MELEE_DAMAGE);
        if (!dmgResult.ok) continue;

        const pi = this.gameState.players.findIndex(p => p.id === targetPlayer!.id);
        if (pi === -1) continue;
        this.gameState.players[pi] = dmgResult.value.player;
        this.enemyAttackCooldowns.set(enemy.id, nowMelee + ENEMY_ATTACK_COOLDOWN_MS);

        this.broadcast(EventNames.DELTA, {
          type: 'player:hp-updated' as const,
          playerId: targetPlayer.id,
          hp: dmgResult.value.player.hp,
        } satisfies DeltaEventMsg);

        if (dmgResult.value.downed) {
          const windowMs = dmgResult.value.reviveWindowMs!;
          this.gameState.players[pi]!.reviveTimerExpiresAt = nowMelee + windowMs;

          this.broadcast(EventNames.DELTA, {
            type: 'player:downed' as const,
            playerId: targetPlayer.id,
            downCount: dmgResult.value.player.downCount,
            reviveWindowMs: windowMs,
          } satisfies DeltaEventMsg);

          // Notify mobile: downed (spirit cell visible but locked until timer expires)
          const downedClient = this.clients.find(c => c.sessionId === targetPlayer!.id);
          if (downedClient) {
            downedClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
          }

          logger.info({ roomId: this.roomId, playerId: targetPlayer.id, downCount: dmgResult.value.player.downCount, windowMs }, 'player downed');
        }
      }
    }

    // ── Revive timer expiry and proximity revive ──────────────────────────────
    if (this.gameState.session.phase === 'dungeon') {
      const nowRevive = Date.now();

      for (const player of this.gameState.players) {
        if (!player.isDown) continue;

        // Timer expiry → spirit form
        if (player.reviveTimerExpiresAt > 0 && nowRevive >= player.reviveTimerExpiresAt) {
          const piExpiry = this.gameState.players.findIndex(p => p.id === player.id);
          this.gameState.players[piExpiry] = { ...this.gameState.players[piExpiry]!, isDown: false, isSpirit: true, reviveTimerExpiresAt: 0 };

          this.broadcast(EventNames.DELTA, {
            type: 'player:spirit' as const,
            playerId: player.id,
          } satisfies DeltaEventMsg);

          const spiritClient = this.clients.find(c => c.sessionId === player.id);
          if (spiritClient) {
            spiritClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: true } satisfies SpiritFormMsg);
          }

          logger.info({ roomId: this.roomId, playerId: player.id }, 'player entered spirit form (timer expired)');
          continue;
        }

        // Proximity revive: first living teammate in range wins
        let revivedBy: string | null = null;
        for (const teammate of this.gameState.players) {
          if (teammate.id === player.id) continue;
          if (teammate.isDown || teammate.isSpirit || teammate.isFrozen) continue;
          const dx = teammate.x - player.x;
          const dy = teammate.y - player.y;
          if (Math.sqrt(dx * dx + dy * dy) <= REVIVE_RADIUS_PX) {
            revivedBy = teammate.id;
            break;
          }
        }

        if (revivedBy !== null) {
          const piRevive = this.gameState.players.findIndex(p => p.id === player.id);
          this.gameState.players[piRevive] = { ...this.gameState.players[piRevive]!, isDown: false, isSpirit: false, hp: REVIVE_HP, reviveTimerExpiresAt: 0 };

          this.broadcast(EventNames.DELTA, {
            type: 'player:revived' as const,
            playerId: player.id,
          } satisfies DeltaEventMsg);

          this.broadcast(EventNames.DELTA, {
            type: 'player:hp-updated' as const,
            playerId: player.id,
            hp: REVIVE_HP,
          } satisfies DeltaEventMsg);

          const revivedClient = this.clients.find(c => c.sessionId === player.id);
          if (revivedClient) {
            // isActive: false signals return to normal combat (not in spirit form)
            revivedClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
          }

          logger.info({ roomId: this.roomId, playerId: player.id, revivedBy }, 'player revived by proximity');
        }
      }
    }

    // ── Run failure: all players in spirit form → phase 'post-run' ───────────
    if (this.gameState.session.phase === 'dungeon') {
      const players = this.gameState.players;
      if (players.length > 0 && players.every(p => p.isSpirit)) {
        const partialEssence = players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0);
        this.gameState.session.phase = 'post-run';
        this.broadcast(EventNames.DELTA, {
          type: 'run:failed' as const,
          partialEssence,
        } satisfies DeltaEventMsg);
        logger.info({ roomId: this.roomId, partialEssence }, 'run failed — all players in spirit form');
      }
    }

    // ── Level clear / wave objective check ───────────────────────────────────
    if (this.gameState.session.phase === 'dungeon') {
      const enemies = this.gameState.enemies;
      const allEnemiesDead = enemies.length > 0 && enemies.every(e => !e.isAlive);

      if (this.levelObjective === 'survive-waves') {
        if (allEnemiesDead && this.wavePauseUntil === 0 && this.waveIndex > 0) {
          const completedWave = this.waveIndex;
          this.broadcast(EventNames.DELTA, {
            type: 'wave:complete' as const,
            waveIndex: completedWave,
          } satisfies DeltaEventMsg);

          if (completedWave >= this.totalWaves) {
            const levelIndex = this.gameState.session.levelIndex;
            this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
            this.loadLevel(levelIndex + 1);
            this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
            logger.info({ roomId: this.roomId, levelIndex, waves: completedWave }, 'survive-waves level complete');
          } else {
            this.wavePauseUntil = Date.now() + WAVE_PAUSE_MS;
            logger.info({ roomId: this.roomId, completedWave, nextWave: completedWave + 1 }, 'wave cleared — pausing before next wave');
          }
        }

        if (this.wavePauseUntil > 0 && Date.now() >= this.wavePauseUntil) {
          this.wavePauseUntil = 0;
          const nextWave = this.waveIndex + 1;
          this.spawnWave(nextWave, 'mid', this.gameState.session.levelIndex);
          this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
        }
      } else {
        if (allEnemiesDead) {
          const levelIndex = this.gameState.session.levelIndex;
          this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
          this.loadLevel(levelIndex + 1);
          this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
          logger.info({ roomId: this.roomId, nextLevel: levelIndex + 1 }, 'level complete — loading next level');
        }
      }
    }

    // ── Boss placeholder: victory trigger contact → run:complete ─────────────
    if (this.gameState.session.phase === 'dungeon'
        && this.gameState.session.levelIndex === 4
        && this.pendingVictoryContact) {
      this.pendingVictoryContact = false;
      const totalEssence = this.gameState.players.reduce((sum, p) => sum + (p.essenceTotal ?? 0), 0);
      this.gameState.session.phase = 'post-run';
      this.broadcast(EventNames.DELTA, { type: 'run:complete' as const, totalEssence } satisfies DeltaEventMsg);
      logger.info({ roomId: this.roomId, totalEssence }, 'boss placeholder — victory zone reached, run complete');
      if (this.victoryTriggerBody) {
        this.physicsWorld.destroyBody(this.victoryTriggerBody);
        this.victoryTriggerBody = null;
      }
    }

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

    // Check spirit ability cooldown expiries
    const nowSpiritExpiry = Date.now();
    for (const [clientId, expiry] of this.spiritCooldownMap) {
      if (expiry > 0 && nowSpiritExpiry >= expiry) {
        this.spiritCooldownMap.set(clientId, 0);
        const targetClient = this.clients.find(c => c.sessionId === clientId);
        if (targetClient) {
          targetClient.send(EventNames.COOLDOWN_UPDATE, {
            type: 'cooldown:update',
            abilityIndex: 3,
            remainingMs: 0,
          } satisfies CooldownUpdateMsg);
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
