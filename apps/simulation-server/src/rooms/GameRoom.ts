import { Room, Client, CloseCode } from 'colyseus';
import type { GameState, PlayerState, RunReward, RunProposal } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor, INTERACTIVE_HUB_POIS, PURIFICATION_PULSE_DURATION_MS, REWARD_REVEAL_DURATION_MS } from 'shared-types';
import { EventNames } from 'net-protocol';
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg, CooldownUpdateMsg, SpiritFormMsg, RunProposeMsg, VoteMsg, BondNotificationMsg, RunVictoryMsg } from 'net-protocol';
import { randomInt } from 'node:crypto';
import { Vec2, Body, Contact, Fixture, Circle } from 'planck';
import type { World } from 'planck';
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody, createEssenceSensorBody,
  extractPoiBeginContact, extractPoiEndContact, extractEssenceBeginContact, toMeters, toPixels,
  CAT_BOSS, createZoneBody,
} from '../physics/world.js';
import type { PoiBeginContactEvent, PoiEndContactEvent, EssenceBeginContactEvent, PhysicsBodyData } from '../physics/world.js';
import { createRng, tickEnemy, dispatchAbility, getEnemyCount, applyDamage, isInHitZone, ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX, ABILITY_DAMAGE, applyPlayerDamage, getReviveWindowMs, ENEMY_MELEE_DAMAGE, ENEMY_MELEE_RANGE_PX, ENEMY_ATTACK_COOLDOWN_MS, REVIVE_RADIUS_PX, REVIVE_HP, SPIRIT_ABILITY_COOLDOWN_MS, generateFloorLayout, GRASSLAND_ROOM_POOL, WAVE_COUNTS, WAVE_PAUSE_MS, WAVE_ENEMY_SCALE, bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets, BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK, BOND_DAMAGE_MULT, BOND_SPEED_MULT, assignBond, BOND_DESCRIPTIONS, BOND_MECHANICS, createBossState, tickBoss, BOSS_ADD_HP, BOSS_STOMP_DAMAGE, evaluateGrasslandAchievements, JOYSTICK_DEADBAND, createEasyLayers, createNormalLayers, createHardLayers, tickStatusEffects, getStatusEffectMagnitude, applyStatusEffect, resolveProjectileHit, isProjectileExpired, shouldZoneTick, isZoneExpired, PROJECTILE_MAX_RANGE_PX, ABILITY_CHAINED_ZONE } from 'game-rules';
import type { BehaviorLayer, EnemyContext, EnemyAIEvent, BossEvent, BossStompedEvent, ChainedZoneConfig } from 'game-rules';
import { BOSS_ARENA_SPAWN_POINTS, loadBossArena } from '../levels/boss-arena.js';
import { CLASS_DEFINITIONS } from 'shared-types';
import type { EnemyState, StatusEffect, ZoneState } from 'shared-types';
import { EnemyType, DifficultyTier, EnemyFSMState, OFFSET_ENEMY_SPAWN, OFFSET_FLOOR_LAYOUT, OFFSET_ROOM_POOL, OFFSET_SPIRIT_BOND } from 'shared-types';
import { createEnemyBody } from '../physics/world.js';
import { createBondSensor, extractBondSensorContact, extractProjectileEnemyContact, extractZoneContact } from '../physics/sensors.js';
import type { BondProximityEvent, ProjectileEnemyContactEvent, ZoneContactEvent } from '../physics/sensors.js';
import { logger } from '../logger.js';

// ponytail: boss is level index 4; dungeon runs levels 1-3
const BOSS_LEVEL_INDEX = 4;
const BACKEND_URL = process.env['BACKEND_URL'] ?? 'http://localhost:3001';

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
      bossLevelStartedAt: 0,
      anyPlayerDownedDuringBoss: false,
      allBondsAtBossStart: false,
    },
    players: [],
    enemies: [],
    activeBonds: [],
    essenceDrops: [],
    tick: 0,
    floorLayout: null,
    runProposal: null,
    boss: null,
    projectiles: [],
    zones: [],
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
    statusEffects: [],
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
  private purificationTimeoutHandle: ReturnType<typeof setTimeout> | null = null;
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
  // ── Bond proximity tracking ───────────────────────────────────────────────
  private bondSensorFixtures = new Map<string, Fixture>(); // bondKey → sensor fixture on playerA's body
  private bondsInRange        = new Set<string>();          // bondKeys currently in planck sensor overlap
  private bondEnterTime       = new Map<string, number>();  // bondKey → epoch ms when pair entered range
  private pendingBondProximityBegin: BondProximityEvent[] = [];
  private pendingBondProximityEnd:   BondProximityEvent[] = [];
  private levelObjective: 'clear' | 'survive-waves' = 'clear';
  private waveIndex = 0;
  private totalWaves = 0;
  private wavePauseUntil = 0;
  private returnReadySet = new Set<string>();
  private bondRng!: () => number;
  private bondMomentNextLevel = -1; // -1 = not in bond-moment; ≥0 = next level to load on CONTINUE
  private bossBody: Body | null = null;
  private arenaWallBodies: Body[] = [];
  private pendingBossStompEvents: BossStompedEvent[] = [];
  private lastRunReward: RunReward | null = null;
  private classSelectLastAccepted = new Map<string, number>();
  private levelTransitionFailedFor: number | null = null;
  // ── Projectiles ────────────────────────────────────────────────────────────
  private projectileBodies = new Map<string, Body>();
  private projectileSpawnPositions = new Map<string, { x: number; y: number }>(); // GameRoom-local — not on wire-visible ProjectileState
  private pendingProjectileHitContacts: Array<ProjectileEnemyContactEvent> = [];
  // ── Zones ──────────────────────────────────────────────────────────────────
  private zoneBodies = new Map<string, Body>();
  private zoneLastTickAtMs = new Map<string, number>();
  // ponytail: target ids only, no type tag — fine while only 'damage' (enemies-only) is
  // implemented; Story 3.14's 'pull' effect on players will need a typed key (or a second map)
  private zoneOverlapping = new Map<string, Set<string>>(); // zoneId → target ids currently in sensor range
  private zoneDamagePerTick = new Map<string, number>(); // GameRoom-local — not on wire-visible ZoneState
  private pendingZoneContactBegin: Array<ZoneContactEvent> = [];
  private pendingZoneContactEnd: Array<ZoneContactEvent> = [];
  private nextZoneSeq = 0; // disambiguates zone ids when one owner chains 2+ zones in the same tick

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
      this.startDungeon(DifficultyTier.EASY, null);
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
        const last = this.classSelectLastAccepted.get(client.sessionId) ?? 0;
        if (Date.now() - last < 1000) return;
        const msg = (typeof raw === 'string' ? JSON.parse(raw) : raw) as { classId: unknown };
        const validClasses = Object.values(PlayerClass) as string[];
        if (typeof msg?.classId !== 'string' || !validClasses.includes(msg.classId)) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'invalid CLASS_SELECT payload — discarded');
          return;
        }
        this.classSelectLastAccepted.set(client.sessionId, Date.now());
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

    this.onMessage(EventNames.CONTINUE, (_client: Client) => {
      if (this.bondMomentNextLevel === -1 || this.gameState.session.phase !== 'dungeon') return;
      const nextLevel = this.bondMomentNextLevel;
      this.bondMomentNextLevel = -1;
      try {
        this.loadLevel(nextLevel);
      } catch (err) {
        this.bondMomentNextLevel = nextLevel; // restore — allow a repeat CONTINUE to retry
        logger.error({ err, roomId: this.roomId, nextLevel }, 'loadLevel failed during CONTINUE — level not loaded, retry armed');
        return;
      }
      this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
      logger.info({ roomId: this.roomId, nextLevel }, 'bond-moment CONTINUE — loading next level');
    });

    if (process.env['NODE_ENV'] !== 'production') {
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

      this.onMessage('debug:kill-boss', (_client: Client) => {
        if (this.gameState.session.levelIndex !== BOSS_LEVEL_INDEX) return;
        if (!this.gameState.boss || this.gameState.boss.isDefeated) return;
        this.gameState.boss.hp = 0;
      });
    }

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
      // Bond proximity sensor
      const bondBeginEvt = extractBondSensorContact(contact);
      if (bondBeginEvt) this.pendingBondProximityBegin.push(bondBeginEvt);
      // Projectile/zone sensors
      const projectileHitEvt = extractProjectileEnemyContact(contact);
      if (projectileHitEvt) this.pendingProjectileHitContacts.push(projectileHitEvt);
      const zoneBeginEvt = extractZoneContact(contact);
      if (zoneBeginEvt) this.pendingZoneContactBegin.push(zoneBeginEvt);
    });
    this.physicsWorld.on('end-contact', (contact: Contact) => {
      const evt = extractPoiEndContact(contact);
      if (evt) this.pendingPoiEndContacts.push(evt);
      const bondEndEvt = extractBondSensorContact(contact);
      if (bondEndEvt) this.pendingBondProximityEnd.push(bondEndEvt);
      const zoneEndEvt = extractZoneContact(contact);
      if (zoneEndEvt) this.pendingZoneContactEnd.push(zoneEndEvt);
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
      this.classSelectLastAccepted.delete(client.sessionId);
      const leaveBody = this.playerBodies.get(client.sessionId);
      if (leaveBody) {
        this.physicsWorld.destroyBody(leaveBody);
        this.playerBodies.delete(client.sessionId);
      }
      // Remove any bond sensor fixtures associated with this player (body already destroyed)
      for (const [key, fixture] of this.bondSensorFixtures) {
        if (fixture.getBody() === leaveBody) {
          this.bondSensorFixtures.delete(key);
          this.bondsInRange.delete(key);
          this.bondEnterTime.delete(key);
        }
      }
      this.gameState.activeBonds = this.gameState.activeBonds.filter(b => b.playerA !== client.sessionId && b.playerB !== client.sessionId);
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
      const nowReconnect = Date.now();
      const playerCooldownsOnReconnect = this.cooldownMap.get(reconnectedClient.sessionId);
      if (playerCooldownsOnReconnect) {
        for (let i = 0; i < playerCooldownsOnReconnect.length; i++) {
          const expiresAt = playerCooldownsOnReconnect[i];
          if (expiresAt !== undefined && expiresAt > nowReconnect) {
            reconnectedClient.send(EventNames.COOLDOWN_UPDATE, {
              type: 'cooldown:update',
              abilityIndex: i,
              remainingMs: expiresAt - nowReconnect,
            } satisfies CooldownUpdateMsg);
          }
        }
      }
      if (this.gameState.session.phase === 'post-run' && this.lastRunReward !== null) {
        const share = this.lastRunReward.perPlayer.find(p => p.playerId === reconnectedClient.sessionId);
        reconnectedClient.send(EventNames.RUN_VICTORY, {
          type: 'run:victory',
          essenceEarned: share?.essence ?? 0,
        } satisfies RunVictoryMsg);
      }
      logger.info({ roomId: this.roomId, clientId: reconnectedClient.sessionId }, 'player reconnected');
    } catch {
      // Grace period expired — remove slot permanently
      this.gameState.players = this.gameState.players.filter(p => p.id !== client.sessionId);
      this.gameState.session.playerCount = this.gameState.players.length;
      this.cooldownMap.delete(client.sessionId);
      this.spiritCooldownMap.delete(client.sessionId);
      this.lastKnownJoystick.delete(client.sessionId);
      this.classSelectLastAccepted.delete(client.sessionId);
      const expireBody = this.playerBodies.get(client.sessionId);
      if (expireBody) {
        this.physicsWorld.destroyBody(expireBody);
        this.playerBodies.delete(client.sessionId);
      }
      // Remove any bond sensor fixtures associated with this player (body already destroyed)
      for (const [key, fixture] of this.bondSensorFixtures) {
        if (fixture.getBody() === expireBody) {
          this.bondSensorFixtures.delete(key);
          this.bondsInRange.delete(key);
          this.bondEnterTime.delete(key);
        }
      }
      this.gameState.activeBonds = this.gameState.activeBonds.filter(b => b.playerA !== client.sessionId && b.playerB !== client.sessionId);
      const delta = { type: 'player:left' as const, playerId: client.sessionId } satisfies DeltaEventMsg;
      this.broadcast(EventNames.DELTA, delta);
      logger.info({ roomId: this.roomId, clientId: client.sessionId }, 'reconnect grace expired — player removed');
      // Removing this player may unblock a unanimous vote or return-to-camp confirmation.
      this.resolveVoteIfComplete();
      this.checkReturnReady();
    }
  }

  onDispose(): void {
    const earnedValues = this.lastRunReward?.achievements ?? [];
    if (earnedValues.length > 0) {
      for (const player of this.gameState.players) {
        if (player.id.startsWith('guest-')) continue;
        // ponytail: fire-and-forget; Epic 7 adds retry/queue
        fetch(`${BACKEND_URL}/player/${player.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ achievements: earnedValues }),
        }).catch(() => void 0);
      }
    }

    if (this.tickTimer !== null) {
      clearInterval(this.tickTimer);
      this.tickTimer = null;
    }
    if (this.purificationTimeoutHandle !== null) {
      clearTimeout(this.purificationTimeoutHandle);
      this.purificationTimeoutHandle = null;
    }
    for (const body of this.playerBodies.values()) {
      this.physicsWorld.destroyBody(body);
    }
    this.playerBodies.clear();
    this.bondSensorFixtures.clear();
    this.bondsInRange.clear();
    this.bondEnterTime.clear();
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
    this.startDungeon(proposal.difficulty, proposal);
    logger.info({ roomId: this.roomId, difficulty: proposal.difficulty }, 'run starting — unanimous accept');
  }

  private startDungeon(difficulty: DifficultyTier, proposal: RunProposal | null): void {
    const previousPhase = this.gameState.session.phase;
    const previousDifficulty = this.gameState.session.difficulty;
    const previousProposal = this.gameState.runProposal;
    this.gameState.session.phase = 'dungeon';
    this.gameState.session.difficulty = difficulty;
    this.gameState.runProposal = null;
    for (const p of this.gameState.players) p.nearPoiId = null;
    this.bondMomentNextLevel = -1;
    try {
      const floorRng = createRng(this.gameState.session.runSeed ^ OFFSET_FLOOR_LAYOUT);
      const roomRng  = createRng(this.gameState.session.runSeed ^ OFFSET_ROOM_POOL);
      this.gameState.floorLayout = generateFloorLayout(floorRng, roomRng, 'early', GRASSLAND_ROOM_POOL);
      this.bondRng = createRng(this.gameState.session.runSeed ^ OFFSET_SPIRIT_BOND);
      this.loadLevel(1);
    } catch (err) {
      this.gameState.session.phase = previousPhase;
      this.gameState.session.difficulty = previousDifficulty;
      this.gameState.runProposal = previousProposal;
      // Clear stale votes so a fresh VOTE round is required — otherwise an unrelated
      // resolveVoteIfComplete() call (e.g. from onLeave's disconnect/grace-expiry paths)
      // would silently replay the pre-failure unanimous accept and re-attempt this same
      // failing start with no new action from any player.
      this.runVotes.clear();
      logger.error({ err, roomId: this.roomId }, 'startDungeon failed — reverted to previous phase');
      return;
    }
    if (proposal) {
      const startDelta: DeltaEventMsg = { type: 'run:starting', biome: proposal.biome, difficulty };
      this.broadcast(EventNames.DELTA, startDelta);
    }
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
        statusEffects: [],
      };
      this.gameState.enemies.push(enemy);
      const body = createEnemyBody(this.physicsWorld, id, x, y);
      this.enemyBodies.set(id, body);
      this.enemyAttackCooldowns.set(id, 0);
      this.enemyLayers.set(id,
        difficulty === DifficultyTier.HARD   ? createHardLayers()   :
        difficulty === DifficultyTier.NORMAL ? createNormalLayers()  :
        createEasyLayers()
      );
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
        statusEffects: [],
      };
      this.gameState.enemies.push(enemy);
      const body = createEnemyBody(this.physicsWorld, id, x, y);
      this.enemyBodies.set(id, body);
      this.enemyAttackCooldowns.set(id, 0);
      this.enemyLayers.set(id,
        difficulty === DifficultyTier.HARD   ? createHardLayers()   :
        difficulty === DifficultyTier.NORMAL ? createNormalLayers()  :
        createEasyLayers()
      );
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
    this.bondMomentNextLevel = -1;

    // Remove bond sensor fixtures from player bodies
    for (const fixture of this.bondSensorFixtures.values()) {
      const body = fixture.getBody();
      body.destroyFixture(fixture);
    }
    this.bondSensorFixtures.clear();
    this.bondsInRange.clear();
    this.bondEnterTime.clear();
    this.pendingBondProximityBegin.length = 0;
    this.pendingBondProximityEnd.length = 0;

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
    this.gameState.session.levelObjective = 'clear';
    this.gameState.session.waveIndex = 0;
    this.gameState.session.totalWaves = 0;
    this.gameState.session.difficulty = null;
    this.gameState.session.bossLevelStartedAt = 0;
    this.gameState.session.anyPlayerDownedDuringBoss = false;
    this.gameState.session.allBondsAtBossStart = false;
    this.gameState.floorLayout = null;
    this.gameState.session.runSeed = randomInt(0, 0x1_0000_0000);
    this.levelTransitionFailedFor = null;

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
    this.classSelectLastAccepted.clear();
    this.enemyAttackCooldowns.clear();
    this.runVotes.clear();
    this.pendingPoiBeginContacts = [];
    this.pendingPoiEndContacts = [];
    this.pendingEssenceBeginContacts = [];
    this.pendingVictoryContact = false;
    for (const body of this.projectileBodies.values()) this.physicsWorld.destroyBody(body);
    this.projectileBodies.clear();
    this.projectileSpawnPositions.clear();
    this.pendingProjectileHitContacts.length = 0;
    this.gameState.projectiles = [];
    for (const body of this.zoneBodies.values()) this.physicsWorld.destroyBody(body);
    this.zoneBodies.clear();
    this.zoneLastTickAtMs.clear();
    this.zoneOverlapping.clear();
    this.zoneDamagePerTick.clear();
    this.pendingZoneContactBegin.length = 0;
    this.pendingZoneContactEnd.length = 0;
    this.gameState.zones = [];
    this.waveIndex = 0;
    this.totalWaves = 0;
    this.wavePauseUntil = 0;
    this.levelObjective = 'clear';
    this.lastRunReward = null;

    const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
    this.broadcast(EventNames.SNAPSHOT, snapshot);
    logger.info({ roomId: this.roomId }, 'all players returned to camp — hub reset');
  }

  private enterBondMoment(levelIndex: number): void {
    if (levelIndex >= BOSS_LEVEL_INDEX) {
      this.loadLevel(levelIndex + 1);
      this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
      return;
    }
    const result = assignBond(this.gameState, this.bondRng);
    if (!result.ok) {
      logger.warn({ roomId: this.roomId, error: result.error }, 'assignBond failed — skipping bond-moment');
      this.loadLevel(levelIndex + 1);
      this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
      return;
    }
    const { playerA, playerB, bondType, bondColor } = result.value;
    const key = bondKey(playerA, playerB);

    this.broadcast(EventNames.DELTA, {
      type: 'bond:assigned' as const,
      playerA,
      playerB,
      bondType,
      bondColor,
    } satisfies DeltaEventMsg);

    const bondNotif: BondNotificationMsg = {
      type: 'bond:notification',
      playerA,
      playerB,
      bondType,
      bondColor,
      bondDescription: BOND_DESCRIPTIONS[bondType],
      bondMechanic:    BOND_MECHANICS[bondType],
    };
    for (const id of [playerA, playerB]) {
      const target = this.clients.find(c => c.sessionId === id);
      if (target) target.send(EventNames.BOND_NOTIFICATION, bondNotif);
    }

    const bodyA = this.playerBodies.get(playerA);
    if (bodyA) {
      const prevFixture = this.bondSensorFixtures.get(key);
      if (prevFixture) prevFixture.getBody().destroyFixture(prevFixture);
      const fixture = createBondSensor(bodyA, toMeters(BOND_PROXIMITY_RANGE_PX), key, playerB);
      this.bondSensorFixtures.set(key, fixture);
    } else {
      logger.warn({ roomId: this.roomId, playerA }, 'bond sensor skipped — player body missing');
    }

    this.bondMomentNextLevel = levelIndex + 1;
    this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
    logger.info({ roomId: this.roomId, levelIndex, playerA, playerB, bondType }, 'bond assigned — bond-moment pause started');
  }

  // Wraps enterBondMoment for tick()'s level-complete call sites. Returns true only once
  // the transition has actually happened, so the caller can defer its level:complete
  // broadcast until success (no partial broadcast on failure). On repeated failure for the
  // same levelIndex, logs once instead of every tick — avoids a 30Hz error/log spam loop.
  private tryEnterBondMoment(levelIndex: number, branch: 'survive-waves' | 'clear-objective'): boolean {
    try {
      this.enterBondMoment(levelIndex);
      this.levelTransitionFailedFor = null;
      return true;
    } catch (err) {
      if (this.levelTransitionFailedFor !== levelIndex) {
        this.levelTransitionFailedFor = levelIndex;
        logger.error({ err, roomId: this.roomId, levelIndex, branch }, 'enterBondMoment failed during tick — skipping level transition');
      }
      return false;
    }
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

    // Clear projectiles and zones
    for (const body of this.projectileBodies.values()) this.physicsWorld.destroyBody(body);
    this.projectileBodies.clear();
    this.projectileSpawnPositions.clear();
    this.pendingProjectileHitContacts.length = 0;
    this.gameState.projectiles = [];
    for (const body of this.zoneBodies.values()) this.physicsWorld.destroyBody(body);
    this.zoneBodies.clear();
    this.zoneLastTickAtMs.clear();
    this.zoneOverlapping.clear();
    this.zoneDamagePerTick.clear();
    this.pendingZoneContactBegin.length = 0;
    this.pendingZoneContactEnd.length = 0;
    this.gameState.zones = [];

    // Clear previous victory trigger
    if (this.victoryTriggerBody) {
      this.physicsWorld.destroyBody(this.victoryTriggerBody);
      this.victoryTriggerBody = null;
    }
    this.pendingVictoryContact = false;

    // Clear boss state, body, and arena walls
    if (this.bossBody) {
      this.physicsWorld.destroyBody(this.bossBody);
      this.bossBody = null;
    }
    for (const wall of this.arenaWallBodies) this.physicsWorld.destroyBody(wall);
    this.arenaWallBodies.length = 0;
    this.gameState.boss = null;
    this.pendingBossStompEvents.length = 0;

    // Clear bond proximity tracking so drain doesn't fire immediately on level entry
    this.bondsInRange.clear();
    this.bondEnterTime.clear();
    this.pendingBondProximityBegin.length = 0;
    this.pendingBondProximityEnd.length = 0;

    // Auto-revive downed/spirit players; carry downCount (shorter next revive window)
    for (const player of this.gameState.players) {
      if (player.isDown || player.isSpirit) {
        const wasSpirit = player.isSpirit;
        player.isDown = false;
        player.isSpirit = false;
        player.reviveTimerExpiresAt = 0;
        player.hp = REVIVE_HP;
        // Flush class-ability cooldowns that expired during spirit form (AC7 fix)
        if (wasSpirit) this.flushExpiredClassCooldowns(player.id);
      }
      const spawnIdx = this.gameState.players.indexOf(player);
      const spawn = DUNGEON_SPAWN_POSITIONS[spawnIdx] ?? { x: 400, y: 540 };
      player.x = spawn.x;
      player.y = spawn.y;
      const body = this.playerBodies.get(player.id);
      if (body) body.setPosition(Vec2(toMeters(spawn.x), toMeters(spawn.y)));
    }

    if (index === BOSS_LEVEL_INDEX) {
      this.gameState.session.bossLevelStartedAt = Date.now();
      this.gameState.session.anyPlayerDownedDuringBoss = false;
      // ponytail: one bond assigned per dungeon level (BOSS_LEVEL_INDEX-1 = 3 max), but a
      // 2-player session only has 1 possible pair — expect min(3, achievable pairs), not a
      // fixed 3, or AllBondsActive is permanently unreachable for 2-player sessions (D-5.7-C)
      const playerCount = this.gameState.players.length;
      const maxAchievableBonds = playerCount >= 2
        ? Math.min(BOSS_LEVEL_INDEX - 1, (playerCount * (playerCount - 1)) / 2)
        : 0;
      this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length === maxAchievableBonds
        && maxAchievableBonds > 0;
      // ponytail: boss is level index 4; dungeon runs levels 1-3
      this.arenaWallBodies = loadBossArena(this.physicsWorld);
      const bossId = `boss-grassland-${this.gameState.session.runSeed}`;
      const bossBodyInstance = this.physicsWorld.createBody({
        type: 'dynamic',
        position: Vec2(toMeters(960), toMeters(540)),
        fixedRotation: true,
        linearDamping: 0,
      });
      bossBodyInstance.createFixture({
        shape: new Circle(toMeters(48)),
        density: 1,
        friction: 0,
        filterCategoryBits: CAT_BOSS,
        filterMaskBits: 0, // combat is hit-scan; no contact callbacks needed (mirrors createEnemyBody)
      });
      bossBodyInstance.setUserData({ type: 'boss', bossId } satisfies PhysicsBodyData);
      this.bossBody = bossBodyInstance;
      this.gameState.boss = createBossState(this.gameState.session.runSeed);
      this.gameState.session.levelIndex = index; // commit only after boss setup succeeds
      logger.info({ roomId: this.roomId }, 'boss arena loaded');
    } else if (index === 2) {
      this.gameState.session.levelIndex = index;
      this.levelObjective = 'survive-waves';
      this.totalWaves = WAVE_COUNTS['mid'];
      this.waveIndex = 0;
      this.wavePauseUntil = 0;
      this.gameState.session.levelObjective = 'survive-waves';
      this.gameState.session.waveIndex = 0;
      this.gameState.session.totalWaves = this.totalWaves;
      this.spawnWave(1, 'mid', index);
    } else {
      this.gameState.session.levelIndex = index;
      this.levelObjective = 'clear';
      this.waveIndex = 0; this.totalWaves = 0; this.wavePauseUntil = 0;
      this.gameState.session.levelObjective = 'clear';
      this.gameState.session.waveIndex = 0;
      this.gameState.session.totalWaves = 0;
      const tier = index === 1 ? 'early' : 'late';
      this.spawnEnemies(tier, index);
    }
  }

  private buildEnemyContext(enemy: EnemyState, nowMs: number): EnemyContext {
    const dt = 1 / TICK_RATE_HZ;
    const targetable = this.gameState.players.filter(
      p => !p.isFrozen && !p.isDown && !p.isSpirit,
    );
    if (targetable.length === 0) {
      return { nearestPlayerPos: null, nearestPlayerDistance: Infinity, dt, nowMs };
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
    return { nearestPlayerPos: { x: nearest.x, y: nearest.y }, nearestPlayerDistance: minDist, dt, nowMs };
  }

  // Ready-to-use for 3.16-3.20's kit-rework stories — no ability calls this yet in 3.12,
  // so there is no caller here. Applies the effect and broadcasts status:applied; returns
  // the target unchanged if applyStatusEffect rejects it (e.g. already-expired effect).
  private applyStatusEffectToTarget<T extends PlayerState | EnemyState>(
    target: T,
    effect: StatusEffect,
    nowMs: number,
  ): T {
    const result = applyStatusEffect(target, effect, nowMs);
    if (!result.ok) return target;

    this.broadcast(EventNames.DELTA, {
      type: 'status:applied' as const,
      targetId: target.id,
      effectType: effect.type,
      magnitude: effect.magnitude,
      expiresAtMs: effect.expiresAtMs,
    } satisfies DeltaEventMsg);

    return result.value.target as T;
  }

  // Called from the projectile-hit-resolution phase when the hitting ability's
  // ABILITY_CHAINED_ZONE entry is non-null (Story 3.19's Void Pulse). Declarative —
  // this method has no knowledge of which ability triggered it.
  private spawnChainedZone(
    ownerId: string,
    x: number,
    y: number,
    config: ChainedZoneConfig,
    damagePerTick: number,
    nowMs: number,
  ): void {
    const zoneId = `zone-${this.tickCount}-${ownerId}-${this.nextZoneSeq++}`;
    const zone: ZoneState = {
      id: zoneId,
      ownerId,
      x, y,
      radius: config.radius,
      effectType: config.effectType,
      tickIntervalMs: config.tickIntervalMs,
      expiresAtMs: nowMs + config.durationMs,
    };
    this.gameState.zones.push(zone);
    const body = createZoneBody(this.physicsWorld, zoneId, x, y, config.radius);
    this.zoneBodies.set(zoneId, body);
    this.zoneLastTickAtMs.set(zoneId, nowMs);
    this.zoneOverlapping.set(zoneId, new Set());
    this.zoneDamagePerTick.set(zoneId, damagePerTick);
  }

  // Ready-to-use for 3.16's Stone Wall pull and 3.19's Void Pulse vacuum zone
  // (the zone-tick handler built in 3.13 is the intended caller for the enemy
  // variant) — no ability calls these yet, so there is no caller here. dx/dy
  // come from game-rules' applyDisplacement. Direct position mutation, not
  // body.applyLinearImpulse: see Story 3.14 for why impulses are inert for
  // both entity types in this tick architecture (velocity gets overwritten
  // every tick for players). For enemies, the mutated x/y reaches the physics
  // body next time this enemy's own AI tick emits an 'enemy:moved' event (see
  // the Enemy AI phase below) — not necessarily the same tick this runs in.
  private applyDisplacementToEnemy(enemy: EnemyState, dx: number, dy: number): void {
    enemy.x += dx;
    enemy.y += dy;
  }

  private applyDisplacementToPlayer(playerId: string, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;

    const player = this.gameState.players.find(p => p.id === playerId);
    const body = this.playerBodies.get(playerId);
    if (!player || !body) return;

    player.x += dx;
    player.y += dy;
    body.setPosition(Vec2(toMeters(player.x), toMeters(player.y)));

    this.broadcast(EventNames.DELTA, {
      type: 'player:moved' as const,
      playerId: player.id,
      x: player.x,
      y: player.y,
    } satisfies DeltaEventMsg);
  }

  private tick(): void {
    this.tickCount++;
    this.gameState.tick = this.tickCount;
    const tickNowMs = Date.now();

    // Pre-compute bond buff sets for this tick (empty unless activeBonds is populated by 5.4)
    const spiritPlayerIds = this.gameState.activeBonds.length > 0
      ? new Set(this.gameState.players.filter(p => p.isSpirit).map(p => p.id))
      : new Set<string>();
    const proximityBuffed = this.gameState.activeBonds.length > 0
      ? getProximityBuffedPlayers(this.gameState.activeBonds, this.bondsInRange, spiritPlayerIds)
      : new Set<string>();
    const fateBuffed = this.gameState.activeBonds.length > 0
      ? getFateBuffedPlayers(this.gameState.activeBonds)
      : new Set<string>();

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

      if (player.isFrozen || player.class === null || player.isDown) {
        body.setLinearVelocity(Vec2(0, 0));
        continue;
      }

      const joystick = this.lastKnownJoystick.get(player.id);
      const jx = joystick?.x ?? 0;
      const jy = joystick?.y ?? 0;
      const inDeadzone = Math.abs(jx) < JOYSTICK_DEADBAND && Math.abs(jy) < JOYSTICK_DEADBAND;

      const bondSpeed = (fateBuffed.has(player.id) && !player.isSpirit) ? SPEED * BOND_SPEED_MULT : SPEED;
      const slowMagnitude = getStatusEffectMagnitude(player, 'slow', tickNowMs);
      const speed = bondSpeed * (1 - slowMagnitude);
      body.setLinearVelocity(inDeadzone
        ? Vec2(0, 0)
        : Vec2(toMeters(jx * speed), toMeters(jy * speed))
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

    // ── Planck phase 3b: read back projectile positions ──────────────────────────
    for (const projectile of this.gameState.projectiles) {
      const body = this.projectileBodies.get(projectile.id);
      if (!body) continue;
      const pos = body.getPosition();
      projectile.x = toPixels(pos.x);
      projectile.y = toPixels(pos.y);
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
      if (!player || player.isSpirit) continue;

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

    // ── Flush zone overlap contacts (begin/end-contact tracking, bond-sensor style) ─
    for (const { zoneId, targetId } of this.pendingZoneContactBegin) {
      let overlap = this.zoneOverlapping.get(zoneId);
      if (!overlap) {
        overlap = new Set();
        this.zoneOverlapping.set(zoneId, overlap);
      }
      overlap.add(targetId);
    }
    for (const { zoneId, targetId } of this.pendingZoneContactEnd) {
      this.zoneOverlapping.get(zoneId)?.delete(targetId);
    }
    this.pendingZoneContactBegin.length = 0;
    this.pendingZoneContactEnd.length = 0;

    // ── Zone tick/expiry ──────────────────────────────────────────────────────
    for (let zi = this.gameState.zones.length - 1; zi >= 0; zi--) {
      const zone = this.gameState.zones[zi]!;

      if (isZoneExpired(zone, tickNowMs)) {
        this.gameState.zones.splice(zi, 1);
        const zoneBody = this.zoneBodies.get(zone.id);
        if (zoneBody) {
          this.physicsWorld.destroyBody(zoneBody);
          this.zoneBodies.delete(zone.id);
        }
        this.zoneLastTickAtMs.delete(zone.id);
        this.zoneOverlapping.delete(zone.id);
        this.zoneDamagePerTick.delete(zone.id);
        this.broadcast(EventNames.DELTA, { type: 'zone:expired' as const, zoneId: zone.id } satisfies DeltaEventMsg);
        continue;
      }

      const lastTick = this.zoneLastTickAtMs.get(zone.id) ?? 0;
      if (!shouldZoneTick(zone, tickNowMs, lastTick)) continue;
      this.zoneLastTickAtMs.set(zone.id, tickNowMs);

      // 'pull' is a physics-impulse placeholder implemented by Story 3.14 — nothing to apply here yet.
      if (zone.effectType === 'damage') {
        const damage = this.zoneDamagePerTick.get(zone.id) ?? 0;
        const overlapping = this.zoneOverlapping.get(zone.id);
        if (damage > 0 && overlapping) {
          for (const targetId of overlapping) {
            const ei = this.gameState.enemies.findIndex(e => e.id === targetId);
            if (ei === -1) continue;
            const enemy = this.gameState.enemies[ei]!;
            if (!enemy.isAlive) continue;

            const dropId = `drop-${this.tickCount}-${enemy.id}`;
            const dmgResult = applyDamage(enemy, damage, dropId, tickNowMs);
            if (!dmgResult.ok) continue;
            this.gameState.enemies[ei] = dmgResult.value.enemy;

            if (dmgResult.value.killed) {
              this.broadcast(EventNames.DELTA, {
                type: 'enemy:killed' as const,
                enemyId: targetId,
                byPlayerId: zone.ownerId,
              } satisfies DeltaEventMsg);
              const enemyBody = this.enemyBodies.get(targetId);
              if (enemyBody) {
                this.physicsWorld.destroyBody(enemyBody);
                this.enemyBodies.delete(targetId);
              }
              this.enemyAttackCooldowns.delete(targetId);

              const drop = dmgResult.value.essenceDrop!;
              this.gameState.essenceDrops.push(drop);
              this.broadcast(EventNames.DELTA, { type: 'essence:dropped' as const, drop } satisfies DeltaEventMsg);
              const sensor = createEssenceSensorBody(this.physicsWorld, drop.id, drop.x, drop.y);
              this.essenceSensorBodies.set(drop.id, sensor);
            } else {
              this.broadcast(EventNames.DELTA, {
                type: 'enemy:damaged' as const,
                enemyId: targetId,
                damage,
                remainingHp: dmgResult.value.enemy.hp,
              } satisfies DeltaEventMsg);
            }
          }
        }
      }

      this.broadcast(EventNames.DELTA, { type: 'zone:tick' as const, zoneId: zone.id } satisfies DeltaEventMsg);
    }

    // ── Projectile expiry check ──────────────────────────────────────────────
    for (let pi = this.gameState.projectiles.length - 1; pi >= 0; pi--) {
      const projectile = this.gameState.projectiles[pi]!;
      const spawn = this.projectileSpawnPositions.get(projectile.id);
      if (!spawn || !isProjectileExpired(projectile, spawn.x, spawn.y, PROJECTILE_MAX_RANGE_PX)) continue;

      this.gameState.projectiles.splice(pi, 1);
      const projectileBody = this.projectileBodies.get(projectile.id);
      if (projectileBody) {
        this.physicsWorld.destroyBody(projectileBody);
        this.projectileBodies.delete(projectile.id);
      }
      this.projectileSpawnPositions.delete(projectile.id);
      this.broadcast(EventNames.DELTA, { type: 'projectile:expired' as const, projectileId: projectile.id } satisfies DeltaEventMsg);
    }

    // ── Projectile hit resolution ────────────────────────────────────────────
    for (const { projectileId, enemyId } of this.pendingProjectileHitContacts) {
      const pi = this.gameState.projectiles.findIndex(p => p.id === projectileId);
      if (pi === -1) continue; // already resolved or expired earlier this tick
      const ei = this.gameState.enemies.findIndex(e => e.id === enemyId);
      if (ei === -1) continue;
      const enemy = this.gameState.enemies[ei]!;
      if (!enemy.isAlive) continue;

      const projectile = this.gameState.projectiles[pi]!;
      const damage = ABILITY_DAMAGE[projectile.class][projectile.abilityIndex as 0 | 1 | 2 | 3] ?? 0;
      const hitResult = resolveProjectileHit(projectile, enemy, damage, tickNowMs);
      if (!hitResult.ok) continue;

      this.gameState.enemies[ei] = hitResult.value.enemy;
      this.gameState.projectiles.splice(pi, 1);
      const projectileBody = this.projectileBodies.get(projectileId);
      if (projectileBody) {
        this.physicsWorld.destroyBody(projectileBody);
        this.projectileBodies.delete(projectileId);
      }
      this.projectileSpawnPositions.delete(projectileId);

      if (hitResult.value.enemy.isAlive) {
        this.broadcast(EventNames.DELTA, {
          type: 'enemy:damaged' as const,
          enemyId,
          damage,
          remainingHp: hitResult.value.enemy.hp,
        } satisfies DeltaEventMsg);
      } else {
        this.broadcast(EventNames.DELTA, {
          type: 'enemy:killed' as const,
          enemyId,
          byPlayerId: projectile.ownerId,
        } satisfies DeltaEventMsg);
        const enemyBody = this.enemyBodies.get(enemyId);
        if (enemyBody) {
          this.physicsWorld.destroyBody(enemyBody);
          this.enemyBodies.delete(enemyId);
        }
        this.enemyAttackCooldowns.delete(enemyId);

        if (hitResult.value.essenceDrop) {
          const drop = hitResult.value.essenceDrop;
          this.gameState.essenceDrops.push(drop);
          this.broadcast(EventNames.DELTA, { type: 'essence:dropped' as const, drop } satisfies DeltaEventMsg);
          const sensor = createEssenceSensorBody(this.physicsWorld, drop.id, drop.x, drop.y);
          this.essenceSensorBodies.set(drop.id, sensor);
        }
      }

      this.broadcast(EventNames.DELTA, {
        type: 'projectile:hit' as const,
        projectileId,
        x: projectile.x,
        y: projectile.y,
      } satisfies DeltaEventMsg);

      // Declarative chain: only fires once 3.19/3.20 populate ABILITY_CHAINED_ZONE for their ability.
      const chainConfig = ABILITY_CHAINED_ZONE[projectile.class][projectile.abilityIndex as 0 | 1 | 2 | 3];
      if (chainConfig) {
        this.spawnChainedZone(projectile.ownerId, projectile.x, projectile.y, chainConfig, damage, tickNowMs);
      }
    }
    this.pendingProjectileHitContacts.length = 0;

    // ── Flush bond proximity contacts ────────────────────────────────────────
    if (this.gameState.session.phase === 'dungeon') {
      const nowBond = Date.now();
      for (const { bondKey: key } of this.pendingBondProximityBegin) {
        if (!this.bondsInRange.has(key)) {
          this.bondsInRange.add(key);
          this.bondEnterTime.set(key, nowBond);
        }
      }
      for (const { bondKey: key } of this.pendingBondProximityEnd) {
        this.bondsInRange.delete(key);
        this.bondEnterTime.delete(key);
      }
    }
    this.pendingBondProximityBegin.length = 0;
    this.pendingBondProximityEnd.length = 0;

    // ── Boss stomp damage from previous tick ────────────────────────────────────
    if (this.pendingBossStompEvents.length > 0) {
      for (const stompEvt of this.pendingBossStompEvents) {
        for (const player of this.gameState.players) {
          if (player.isDown || player.isSpirit || player.isFrozen) continue;
          const dx = player.x - stompEvt.x;
          const dy = player.y - stompEvt.y;
          if (Math.sqrt(dx * dx + dy * dy) > stompEvt.radius) continue;
          player.hp = Math.max(0, player.hp - BOSS_STOMP_DAMAGE);
          this.broadcast(EventNames.DELTA, {
            type: 'player:hp-updated' as const,
            playerId: player.id,
            hp: player.hp,
          } satisfies DeltaEventMsg);
          if (player.hp <= 0) {
            const nowStomp = Date.now();
            player.downCount++;
            player.isDown = true;
            if (this.gameState.session.levelIndex === BOSS_LEVEL_INDEX) {
              this.gameState.session.anyPlayerDownedDuringBoss = true;
            }
            const windowMs = getReviveWindowMs(player.downCount);
            player.reviveTimerExpiresAt = nowStomp + windowMs;
            this.broadcast(EventNames.DELTA, {
              type: 'player:downed' as const,
              playerId: player.id,
              downCount: player.downCount,
              reviveWindowMs: windowMs,
            } satisfies DeltaEventMsg);
            const downedClient = this.clients.find(c => c.sessionId === player.id);
            if (downedClient) {
              downedClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
            }
          }
        }
      }
      this.pendingBossStompEvents.length = 0;
    }

    // ── Enemy AI phase ──────────────────────────────────────────────────────────
    // Loop is no-op until enemies are spawned (Story 3.3+)
    for (const enemy of this.gameState.enemies) {
      if (!enemy.isAlive) continue;

      const ctx = this.buildEnemyContext(enemy, tickNowMs);
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

    // ── Boss tick ───────────────────────────────────────────────────────────────
    if (this.gameState.session.levelIndex === BOSS_LEVEL_INDEX &&
        this.gameState.boss !== null &&
        !this.gameState.boss.isDefeated) {

      const bossResult = tickBoss(
        this.gameState.boss,
        this.gameState,
        this.gameState.session.difficulty!,
        BOSS_ARENA_SPAWN_POINTS,
        tickNowMs,
      );

      if (bossResult.ok) {
        for (const evt of bossResult.value) {
          switch (evt.type) {
            case 'boss:moved':
              this.gameState.boss.position.x = evt.x;
              this.gameState.boss.position.y = evt.y;
              if (this.bossBody) this.bossBody.setPosition(Vec2(toMeters(evt.x), toMeters(evt.y)));
              this.broadcast(EventNames.DELTA, {
                type: 'boss:moved', bossId: evt.bossId, x: evt.x, y: evt.y,
              } satisfies DeltaEventMsg);
              break;

            case 'boss:stomped':
              this.pendingBossStompEvents.push(evt);
              this.broadcast(EventNames.DELTA, {
                type: 'boss:stomped', bossId: evt.bossId, x: evt.x, y: evt.y, radius: evt.radius,
              } satisfies DeltaEventMsg);
              break;

            case 'boss:phaseChanged':
              this.broadcast(EventNames.DELTA, {
                type: 'boss:phaseChanged', bossId: evt.bossId, newPhase: evt.newPhase,
              } satisfies DeltaEventMsg);
              break;

            case 'boss:charged':
              // ponytail: charge is a movement event handled by tickBoss — no client delta needed
              break;

            case 'add:spawned': {
              const addEnemy: EnemyState = {
                id: evt.enemyId, type: EnemyType.GRASSLAND_ADD,
                x: evt.x, y: evt.y,
                hp: BOSS_ADD_HP, maxHp: BOSS_ADD_HP,
                difficultyTier: this.gameState.session.difficulty ?? DifficultyTier.EASY,
                isAlive: true, fsmState: EnemyFSMState.IDLE,
                attackCooldownTicks: 0,
                statusEffects: [],
              };
              this.gameState.enemies.push(addEnemy);
              const addBody = createEnemyBody(this.physicsWorld, evt.enemyId, evt.x, evt.y);
              this.enemyBodies.set(evt.enemyId, addBody);
              this.enemyAttackCooldowns.set(evt.enemyId, 0);
              this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
              break;
            }

            case 'boss:defeated': {
              if (this.bossBody) {
                this.physicsWorld.destroyBody(this.bossBody);
                this.bossBody = null;
              }
              this.gameState.session.phase = 'post-run';
              const achievements = evaluateGrasslandAchievements(this.gameState, Date.now());
              const reward: RunReward = { ...evt.reward, achievements };
              this.lastRunReward = reward;
              this.broadcast(EventNames.DELTA, {
                type: 'boss:defeated',
                bossId: evt.bossId,
                reward,
              } satisfies DeltaEventMsg);
              for (const client of this.clients) {
                if (client.sessionId === this.gameState.session.hostId) continue;
                const share = reward.perPlayer.find(p => p.playerId === client.sessionId);
                client.send(EventNames.RUN_VICTORY, {
                  type: 'run:victory',
                  essenceEarned: share?.essence ?? 0,
                } satisfies RunVictoryMsg);
              }
              const totalEssence = reward.essenceTotal;
              this.purificationTimeoutHandle = setTimeout(() => {
                this.purificationTimeoutHandle = null;
                if (this.gameState.session.phase !== 'post-run') return;
                this.broadcast(EventNames.DELTA, { type: 'run:complete', totalEssence } satisfies DeltaEventMsg);
              }, PURIFICATION_PULSE_DURATION_MS + REWARD_REVEAL_DURATION_MS);
              break;
            }
          }
        }
      } else {
        logger.error({ roomId: this.roomId, error: bossResult.error }, 'tickBoss returned error');
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
        const rawDamage = result.value.damage;
        if (rawDamage <= 0) continue;  // ponytail: skip hit-scan for buff/heal abilities (damage=0 in balance table)
        const damage = proximityBuffed.has(clientId)
          ? Math.round(rawDamage * BOND_DAMAGE_MULT)
          : rawDamage;

        // AC6: normalize direction so sub-unit joystick magnitude doesn't shrink hit range
        const mag = Math.hypot(dirX, dirY);
        // Story 3.11: hitRange=0 directional abilities (e.g. Stone Wall, Void
        // Pulse) hit at the player's own position regardless of direction —
        // don't require a drag for those, only for abilities whose hit
        // circle is actually offset by direction.
        if (isDirectional && mag === 0 && hitRange > 0) continue; // no direction = no hit
        const normDirX = isDirectional && mag > 0 ? dirX / mag : dirX;
        const normDirY = isDirectional && mag > 0 ? dirY / mag : dirY;

        for (let ei = 0; ei < this.gameState.enemies.length; ei++) {
          const enemy = this.gameState.enemies[ei]!;
          if (!enemy.isAlive) continue;
          if (!isInHitZone(player.x, player.y, normDirX, normDirY, enemy.x, enemy.y, hitRadius, hitRange, isDirectional)) continue;

          const dropId = `drop-${this.tickCount}-${enemy.id}`;
          const dmgResult = applyDamage(enemy, damage, dropId, nowAbility);
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

        const dmgResult = applyPlayerDamage(targetPlayer, ENEMY_MELEE_DAMAGE, nowMelee);
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
          if (this.gameState.session.levelIndex === BOSS_LEVEL_INDEX) {
            this.gameState.session.anyPlayerDownedDuringBoss = true;
          }

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

          // Fate Bond wipe cascade
          if (this.gameState.activeBonds.length > 0) {
            const justDowned = [targetPlayer.id];
            while (justDowned.length > 0) {
              const downedId = justDowned.pop()!;
              const wipeTargets = getFateBondWipeTargets(
                this.gameState.activeBonds,
                downedId,
                this.gameState.players,
              );
              for (const partnerId of wipeTargets) {
                const partnerIdx = this.gameState.players.findIndex(p => p.id === partnerId);
                const partner = this.gameState.players[partnerIdx];
                if (!partner) continue;
                const wipeResult = applyPlayerDamage(partner, partner.hp, nowMelee);
                if (!wipeResult.ok) continue; // already down/spirit/frozen
                this.gameState.players[partnerIdx] = wipeResult.value.player;
                const wipeWindowMs = wipeResult.value.reviveWindowMs!;
                this.gameState.players[partnerIdx]!.reviveTimerExpiresAt = nowMelee + wipeWindowMs;
                this.broadcast(EventNames.DELTA, {
                  type: 'player:hp-updated' as const,
                  playerId: partnerId,
                  hp: 0,
                } satisfies DeltaEventMsg);
                if (this.gameState.session.levelIndex === BOSS_LEVEL_INDEX) {
                  this.gameState.session.anyPlayerDownedDuringBoss = true;
                }
                this.broadcast(EventNames.DELTA, {
                  type: 'player:downed' as const,
                  playerId: partnerId,
                  downCount: wipeResult.value.player.downCount,
                  reviveWindowMs: wipeWindowMs,
                } satisfies DeltaEventMsg);
                const wipeClient = this.clients.find(c => c.sessionId === partnerId);
                if (wipeClient) {
                  wipeClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
                }
                logger.info({ roomId: this.roomId, playerId: partnerId, downedBy: downedId }, 'fate bond wipe — partner downed');
                justDowned.push(partnerId); // cascade: partner may also have a Fate Bond
              }
            }
          }
        }
      }
    }

    // ── Proximity bond drain ─────────────────────────────────────────────────
    if (this.gameState.session.phase === 'dungeon' && this.gameState.activeBonds.length > 0) {
      const nowDrain = Date.now();
      const drainTargets = getProximityDrainTargets(
        this.gameState.activeBonds,
        this.bondsInRange,
        this.bondEnterTime,
        BOND_DRAIN_THRESHOLD_S * 1000,
        nowDrain,
        spiritPlayerIds,
      );
      for (const { playerA, playerB } of drainTargets) {
        let drained = false;
        for (const playerId of [playerA, playerB]) {
          const pi = this.gameState.players.findIndex(p => p.id === playerId);
          const player = this.gameState.players[pi];
          if (!player || player.isDown || player.isSpirit || player.isFrozen) continue;
          const newHp = Math.max(1, player.hp - BOND_DRAIN_HP_PER_TICK); // ponytail: drain never kills
          if (newHp !== player.hp) {
            player.hp = newHp;
            drained = true;
            this.broadcast(EventNames.DELTA, {
              type: 'player:hp-updated' as const,
              playerId,
              hp: newHp,
            } satisfies DeltaEventMsg);
          }
        }
        if (drained) {
          this.broadcast(EventNames.DELTA, {
            type: 'bond:price-active' as const,
            playerA,
            playerB,
          } satisfies DeltaEventMsg);
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
          // Flush any class-ability cooldowns that expired during spirit form (AC7 fix)
          this.flushExpiredClassCooldowns(player.id);

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
        this.bondMomentNextLevel = -1;
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
        if (this.bondMomentNextLevel === -1 && allEnemiesDead && this.wavePauseUntil === 0 && this.waveIndex > 0) {
          const completedWave = this.waveIndex;
          this.broadcast(EventNames.DELTA, {
            type: 'wave:complete' as const,
            waveIndex: completedWave,
          } satisfies DeltaEventMsg);

          if (completedWave >= this.totalWaves) {
            const levelIndex = this.gameState.session.levelIndex;
            if (!this.tryEnterBondMoment(levelIndex, 'survive-waves')) return;
            this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
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
        // Boss-level completion is driven solely by the `boss:defeated` event from tickBoss
        // (see the Boss tick block above) — never by this generic check. Phase3 boss "adds"
        // are pushed into gameState.enemies and can all die while the boss itself survives.
        if (this.gameState.session.levelIndex !== BOSS_LEVEL_INDEX &&
            this.bondMomentNextLevel === -1 && allEnemiesDead) {
          const levelIndex = this.gameState.session.levelIndex;
          if (!this.tryEnterBondMoment(levelIndex, 'clear-objective')) return;
          this.broadcast(EventNames.DELTA, { type: 'level:complete' as const, levelIndex } satisfies DeltaEventMsg);
          logger.info({ roomId: this.roomId, levelIndex }, 'level complete — entering bond moment');
        }
      }
    }

    // Notify clients whose cooldowns have expired this tick
    const nowExpiry = Date.now();
    for (const [clientId, cooldowns] of this.cooldownMap) {
      for (let i = 0; i < cooldowns.length; i++) {
        const expiry = cooldowns[i];
        if (expiry !== undefined && expiry > 0 && nowExpiry >= expiry) {
          cooldowns[i] = 0;
          // AC7: spirit players can't use class abilities (slots 0-2) — reset stored cooldown but skip message
          const player = this.gameState.players.find(p => p.id === clientId);
          if (player?.isSpirit && i < 3) continue;
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

    // Tick status effects for players/enemies, broadcasting status:expired for any removed effect.
    for (let pi = 0; pi < this.gameState.players.length; pi++) {
      const player = this.gameState.players[pi]!;
      if (player.statusEffects.length === 0) continue;
      const ticked = tickStatusEffects(player, tickNowMs);
      if (ticked === player) continue;
      this.gameState.players[pi] = ticked;
      for (const effect of player.statusEffects) {
        if (ticked.statusEffects.includes(effect)) continue;
        this.broadcast(EventNames.DELTA, {
          type: 'status:expired' as const,
          targetId: player.id,
          effectType: effect.type,
        } satisfies DeltaEventMsg);
      }
    }
    for (let ei = 0; ei < this.gameState.enemies.length; ei++) {
      const enemy = this.gameState.enemies[ei]!;
      if (enemy.statusEffects.length === 0) continue;
      const ticked = tickStatusEffects(enemy, tickNowMs);
      if (ticked === enemy) continue;
      this.gameState.enemies[ei] = ticked;
      for (const effect of enemy.statusEffects) {
        if (ticked.statusEffects.includes(effect)) continue;
        this.broadcast(EventNames.DELTA, {
          type: 'status:expired' as const,
          targetId: enemy.id,
          effectType: effect.type,
        } satisfies DeltaEventMsg);
      }
    }

    // Periodic full snapshot every SNAPSHOT_INTERVAL_S seconds
    if (this.tickCount % (SNAPSHOT_INTERVAL_S * TICK_RATE_HZ) === 0) {
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, snapshot);
    }
  }

  // Send COOLDOWN_UPDATE(remainingMs=0) for class slots 0-2 that expired while the player
  // was in spirit form (server cleared cooldowns[i] to 0 but skipped the message per AC7).
  private flushExpiredClassCooldowns(playerId: string): void {
    const cooldowns = this.cooldownMap.get(playerId);
    if (!cooldowns) return;
    const targetClient = this.clients.find(c => c.sessionId === playerId);
    if (!targetClient) return;
    for (let i = 0; i < 3; i++) {
      if (cooldowns[i] === 0) {
        targetClient.send(EventNames.COOLDOWN_UPDATE, {
          type: 'cooldown:update',
          abilityIndex: i,
          remainingMs: 0,
        } satisfies CooldownUpdateMsg);
      }
    }
  }
}
