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
  CAT_BOSS, createZoneBody, createProjectileBody,
} from '../physics/world.js';
import type { PoiBeginContactEvent, PoiEndContactEvent, EssenceBeginContactEvent, PhysicsBodyData } from '../physics/world.js';
import { createRng, tickEnemy, dispatchAbility, getEnemyCount, applyDamage, isInHitZone, isInConeZone, ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX, ABILITY_HIT_SHAPE, ABILITY_CONE_ANGLE_DEG, ABILITY_DAMAGE, applyPlayerDamage, getReviveWindowMs, ENEMY_MELEE_DAMAGE, ENEMY_MELEE_RANGE_PX, ENEMY_ATTACK_COOLDOWN_MS, REVIVE_RADIUS_PX, REVIVE_HP, SPIRIT_ABILITY_COOLDOWN_MS, generateFloorLayout, GRASSLAND_ROOM_POOL, WAVE_COUNTS, WAVE_PAUSE_MS, WAVE_ENEMY_SCALE, bondKey, getProximityBuffedPlayers, getFateBuffedPlayers, getFateBondWipeTargets, getProximityDrainTargets, BOND_PROXIMITY_RANGE_PX, BOND_DRAIN_THRESHOLD_S, BOND_DRAIN_HP_PER_TICK, BOND_SPEED_MULT, assignBond, BOND_DESCRIPTIONS, BOND_MECHANICS, createBossState, tickBoss, BOSS_ADD_HP, BOSS_STOMP_DAMAGE, evaluateGrasslandAchievements, JOYSTICK_DEADBAND, createEasyLayers, createNormalLayers, createHardLayers, tickStatusEffects, getStatusEffectMagnitude, applyStatusEffect, resolveProjectileHit, isProjectileExpired, shouldZoneTick, isZoneExpired, PROJECTILE_MAX_RANGE_PX, PROJECTILE_SPEED_PX_S, ABILITY_CHAINED_ZONE, ABILITY_STATUS_EFFECT, ABILITY_DISPLACEMENT_STRENGTH, applyDisplacement, resolveMixedFactionTargets, healPlayer, calculateLifesteal, resolveExpandingRadius, ABILITY_HEAL_AMOUNT, SPIRIT_NOVA_DURATION_MS, SPIRIT_NOVA_MAX_RADIUS_PX, findSoulMendTarget, shouldCancelSoulMendChannel, reviveBySoulMend, SOUL_MEND_CHANNEL_DURATION_MS, SOUL_MEND_LIVENESS_MS, ABILITY_COOLDOWNS_MS, ABILITY_DELIVERY, ABILITY_LIFESTEAL_PCT, VOID_PULSE_PULL_STRENGTH_PX, DARK_PACT_DRAIN_PCT, STORM_EYE_ZONE_RADIUS_PX, STORM_EYE_TICK_MS, STORM_EYE_TICK_DAMAGE, STORM_EYE_DURATION_MS, STORM_EYE_STRIKE_INTERVAL_MS, STORM_EYE_STRIKE_DAMAGE, pickRandomIndex, resolveOutgoingDamage, LIGHTNING_ARC_CORRIDOR_ANGLE_DEG, LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF, findNearestCandidate, resolveLightningArcChain, TEMPEST_HURL_PROJECTILE_RADIUS_PX, TEMPEST_HURL_SPEED_PX_S, TEMPEST_HURL_BLAST_RADIUS_PX } from 'game-rules';
import type { BehaviorLayer, EnemyContext, EnemyAIEvent, BossEvent, BossStompedEvent, ChainedZoneConfig, AbilityHitShape, LightningArcCandidate } from 'game-rules';
import { BOSS_ARENA_SPAWN_POINTS, loadBossArena } from '../levels/boss-arena.js';
import { CLASS_DEFINITIONS } from 'shared-types';
import type { EnemyState, StatusEffect, ZoneState, ProjectileState } from 'shared-types';
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
    channelingAbility: null,
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
  private godModePlayerIds = new Set<string>(); // debug-only, NODE_ENV-gated — see debug:toggle-god-mode
  private bondRng!: () => number;
  private bondMomentNextLevel = -1; // -1 = not in bond-moment; ≥0 = next level to load on CONTINUE
  private bondEligiblePlayerCount = -1; // -1 = not yet snapshotted; roster size at first bond-assignment attempt (Story 5.9, D-5.8-A)
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
  // Storm Eye's bonus-strike cadence (Story 3.20) — zoneId → lastStrikeAtMs. GameRoom-local,
  // not on wire-visible ZoneState (would be premature generalization for the one ability that
  // uses it). Presence of a zoneId in this map marks it strike-eligible — set only when Storm
  // Eye creates the zone, so the generic zone-tick loop never needs a class/index check.
  private zoneStrikeTimers = new Map<string, number>();
  // ── Spirit Nova expanding-radius sweep (Story 3.17) ─────────────────────────
  // GameRoom-local only — no persistent GameState entity per the story's Non-goals;
  // resolves within its short duration via ordinary enemy:damaged/player:hp-updated deltas.
  private activeSpiritNovas: Array<{
    casterId: string; x: number; y: number;
    startedAtMs: number; durationMs: number; maxRadiusPx: number;
    hitIds: Set<string>;
  }> = [];
  // ── Soul Mend hold-to-channel (Story 3.18) ──────────────────────────────────
  // GameRoom-local — not on the wire; caster id → epoch ms of the last AIM_CAST
  // fire-attempt received. Drives liveness-timeout cancellation (no explicit
  // "stop" message exists — see Dev Notes on the story for why).
  private lastSoulMendInputAt = new Map<string, number>();

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
        // Soul Mend's channel re-reads `caster.class` fresh every tick for its range/
        // cooldown lookups (Story 3.18) — switching class mid-channel would corrupt
        // those lookups, so block class changes while actively channeling.
        if (player.channelingAbility !== null) {
          logger.warn({ clientId: client.sessionId, roomId: this.roomId }, 'CLASS_SELECT from mid-channel player — discarded');
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

      this.onMessage('debug:toggle-god-mode', (client: Client) => {
        const player = this.gameState.players.find(p => p.id === client.sessionId);
        if (!player) return;
        let godMode: boolean;
        if (this.godModePlayerIds.has(client.sessionId)) {
          this.godModePlayerIds.delete(client.sessionId);
          godMode = false;
        } else {
          this.godModePlayerIds.add(client.sessionId);
          godMode = true;
        }
        logger.info({ roomId: this.roomId, clientId: client.sessionId, godMode }, 'debug:toggle-god-mode');
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
      this.lastSoulMendInputAt.delete(client.sessionId);
      this.godModePlayerIds.delete(client.sessionId);
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
            // Reconstruct the original start epoch from the full cooldown so the
            // client's arc sweep is correct on reconnect (the old code sent only
            // the *remaining* time, which made the arc animate as if the whole
            // cooldown were that short — the RELEASE "overlay reset" symptom).
            const fullCooldownMs = player.class !== null
              ? ABILITY_COOLDOWNS_MS[player.class][i as 0 | 1 | 2 | 3]
              : expiresAt - nowReconnect;
            this.sendCooldownUpdate(reconnectedClient, i, expiresAt - fullCooldownMs, expiresAt);
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
      this.lastSoulMendInputAt.delete(client.sessionId);
      this.godModePlayerIds.delete(client.sessionId);
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
    this.bondEligiblePlayerCount = -1;
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

    // Destroy boss body and arena walls if a run ended mid-boss-fight or boss construction
    // failed partway through (Story 4.14 — mirrors loadLevel's equivalent cleanup block)
    if (this.bossBody) {
      this.physicsWorld.destroyBody(this.bossBody);
      this.bossBody = null;
    }
    for (const wall of this.arenaWallBodies) this.physicsWorld.destroyBody(wall);
    this.arenaWallBodies.length = 0;

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
    this.zoneStrikeTimers.clear();
    this.pendingZoneContactBegin.length = 0;
    this.pendingZoneContactEnd.length = 0;
    this.gameState.zones = [];
    this.activeSpiritNovas.length = 0;
    this.lastSoulMendInputAt.clear();
    // A mid-channel caster's channelingAbility lives on their own PlayerState (part of
    // GameState, unlike the GameRoom-local maps above) — must be explicitly cleared here
    // too, or it leaks into the next run's snapshots (Story 3.18 review finding).
    this.gameState.players = this.gameState.players.map(p =>
      p.channelingAbility !== null ? { ...p, channelingAbility: null } : p
    );
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
    if (this.bondEligiblePlayerCount === -1) {
      this.bondEligiblePlayerCount = this.gameState.players.length;
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
    this.zoneStrikeTimers.clear();
    this.pendingZoneContactBegin.length = 0;
    this.pendingZoneContactEnd.length = 0;
    this.gameState.zones = [];
    this.activeSpiritNovas.length = 0;

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
        // Flush class-ability cooldowns that expired during spirit form (AC7 fix)
        if (wasSpirit) this.flushExpiredClassCooldowns(player.id);
      }
      // Full HP restore on every level transition (Story 4.12) — applies to every player,
      // not only the isDown/isSpirit subset; matches resetToHub()'s existing pattern.
      player.hp = player.maxHp;
      // Clear isFrozen on every level transition too (Story 4.14) — matches
      // resetToHub()'s existing player.isFrozen = false precedent; a disconnected/frozen
      // player must not carry a stale freeze flag across a level boundary.
      player.isFrozen = false;
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
      // Story 5.9 (D-5.8-A): use the roster snapshotted at first bond assignment, not the live
      // roster at boss-start — a mid-dungeon join/leave between bond assignment and boss start
      // must not desync maxAchievableBonds from the bonds that were actually assigned.
      // !== -1 (not >= 2): 0 or 1 is a legitimate captured snapshot (e.g. a solo-started run),
      // not "never snapshotted" — falling back to the live count for a captured 0/1 would
      // reintroduce the exact stale-read bug this story closes (code review finding, 5.9).
      const playerCount = this.bondEligiblePlayerCount !== -1
        ? this.bondEligiblePlayerCount
        : this.gameState.players.length;
      const maxAchievableBonds = playerCount >= 2
        ? Math.min(BOSS_LEVEL_INDEX - 1, (playerCount * (playerCount - 1)) / 2)
        : 0;
      // >= (not ===): assignBond still pairs against the live roster each bond-moment, so a
      // roster that grows between bond-assignment attempts (not just right before boss) can
      // validly earn more bonds than the frozen playerCount snapshot anticipated — those extra
      // bonds should still count as "all achievable bonds active" (code review finding, 5.9).
      this.gameState.session.allBondsAtBossStart = this.gameState.activeBonds.length >= maxAchievableBonds
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
      this.levelObjective = 'survive-waves';
      this.totalWaves = WAVE_COUNTS['mid'];
      this.waveIndex = 0;
      this.wavePauseUntil = 0;
      this.gameState.session.levelObjective = 'survive-waves';
      this.gameState.session.waveIndex = 0;
      this.gameState.session.totalWaves = this.totalWaves;
      this.spawnWave(1, 'mid', index);
      this.gameState.session.levelIndex = index; // commit only after spawnWave succeeds
    } else {
      this.levelObjective = 'clear';
      this.waveIndex = 0; this.totalWaves = 0; this.wavePauseUntil = 0;
      this.gameState.session.levelObjective = 'clear';
      this.gameState.session.waveIndex = 0;
      this.gameState.session.totalWaves = 0;
      const tier = index === 1 ? 'early' : 'late';
      this.spawnEnemies(tier, index);
      this.gameState.session.levelIndex = index; // commit only after spawnEnemies succeeds
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

  // Story 3.17: first ability query to gather nearby PLAYERS for a hit zone — every
  // ability before this story only ever targeted enemies. Mirrors the existing enemy
  // hit-scan's isInHitZone call; excludes the caster and any player who isn't a valid
  // interaction target (same isDown/isSpirit/isFrozen guard style as the proximity-revive
  // block). Used by Ancestor's Voice/Spirit Nova's mixed-faction gather and Warding Cry's
  // 'allies-in-zone' status-effect scope.
  private gatherPlayersInHitZone(
    originX: number,
    originY: number,
    dirX: number,
    dirY: number,
    hitRadiusPx: number,
    hitRangePx: number,
    isDirectional: boolean,
    casterId: string,
    coneAngleDeg?: number,
  ): PlayerState[] {
    const found: PlayerState[] = [];
    for (const p of this.gameState.players) {
      if (p.id === casterId) continue;
      if (p.isDown || p.isSpirit || p.isFrozen) continue;
      const inZone = coneAngleDeg !== undefined
        ? isInConeZone(originX, originY, dirX, dirY, p.x, p.y, hitRangePx, coneAngleDeg)
        : isInHitZone(originX, originY, dirX, dirY, p.x, p.y, hitRadiusPx, hitRangePx, isDirectional);
      if (!inZone) continue;
      found.push(p);
    }
    return found;
  }

  // Story 3.25 (ADR-0005): shared shape dispatch for the generic hit-scan loop and
  // Ancestor's Voice's mixed-faction branch — 'cone' delegates to isInConeZone
  // (length = hitRangePx, half-angle = half of coneAngleDeg), 'circle' keeps calling
  // isInHitZone exactly as before every ability in this codebase already does.
  private isInAbilityHitZone(
    shape: AbilityHitShape,
    casterX: number,
    casterY: number,
    dirX: number,
    dirY: number,
    targetX: number,
    targetY: number,
    hitRadiusPx: number,
    hitRangePx: number,
    coneAngleDeg: number,
    isDirectional: boolean,
  ): boolean {
    if (shape === 'cone') {
      return isInConeZone(casterX, casterY, dirX, dirY, targetX, targetY, hitRangePx, coneAngleDeg);
    }
    return isInHitZone(casterX, casterY, dirX, dirY, targetX, targetY, hitRadiusPx, hitRangePx, isDirectional);
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

  // dx/dy come from game-rules' applyDisplacement. Direct position mutation,
  // not body.applyLinearImpulse: see Story 3.14 for why impulses are inert
  // for both entity types in this tick architecture (velocity gets
  // overwritten every tick for players). Repositions the physics body and
  // broadcasts immediately (mirrors applyDisplacementToPlayer below) — the
  // enemy's own AI tick only emits 'enemy:moved' from tickChase, so an
  // IDLE/ATTACK-state enemy would otherwise sit displaced server-side with
  // no client ever told, surfacing as a teleport whenever it next chases.
  private applyDisplacementToEnemy(enemy: EnemyState, dx: number, dy: number): void {
    if (dx === 0 && dy === 0) return;

    enemy.x += dx;
    enemy.y += dy;

    const body = this.enemyBodies.get(enemy.id);
    if (body) body.setPosition(Vec2(toMeters(enemy.x), toMeters(enemy.y)));

    this.broadcast(EventNames.DELTA, {
      type: 'enemy:moved' as const,
      enemyId: enemy.id,
      x: enemy.x,
      y: enemy.y,
    } satisfies DeltaEventMsg);
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

  // Dark Pact (Souldrinker slot 2, Story 3.19): single-target ally drain + self
  // damageBuff. Its own dispatch branch — not a hit-scan (no enemy involved), not a
  // mixed-faction AoE (single nearest ally, not everyone in the zone), and not a
  // channel (instant RELEASE, unlike Soul Mend). Reuses gatherPlayersInHitZone's
  // "aim a cone, filter to valid living allies, exclude caster" query shape.
  // The damageBuff status effect is gated on a target actually being found — no
  // drain means no buff, per the ability's single linked drain-transfer effect.
  private handleDarkPact(casterId: string, caster: PlayerState, dirX: number, dirY: number, nowMs: number): void {
    const abilityIndex = 2;
    const hitRange = ABILITY_HIT_RANGE_PX[PlayerClass.SOULDRINKER][abilityIndex];
    const hitRadius = ABILITY_HIT_RADIUS_PX[PlayerClass.SOULDRINKER][abilityIndex];
    const mag = Math.hypot(dirX, dirY);
    if (mag === 0) return; // no direction = no target, same rule as every other directional ability
    const normDirX = dirX / mag;
    const normDirY = dirY / mag;

    const candidates = this.gatherPlayersInHitZone(caster.x, caster.y, normDirX, normDirY, hitRadius, hitRange, true, casterId);
    if (candidates.length === 0) return; // aimed at nothing — cooldown still applies (handled by the caller), no drain/buff

    let nearest = candidates[0]!;
    let nearestDistSq = Infinity;
    for (const c of candidates) {
      const dx = c.x - caster.x;
      const dy = c.y - caster.y;
      const distSq = dx * dx + dy * dy;
      if (distSq < nearestDistSq) {
        nearestDistSq = distSq;
        nearest = c;
      }
    }

    const targetIdx = this.gameState.players.findIndex(p => p.id === nearest.id);
    if (targetIdx === -1) return;
    if (this.godModePlayerIds.has(this.gameState.players[targetIdx]!.id)) return;
    const drainAmount = this.gameState.players[targetIdx]!.hp * DARK_PACT_DRAIN_PCT;
    const dmgResult = applyPlayerDamage(this.gameState.players[targetIdx]!, drainAmount, nowMs);
    if (!dmgResult.ok) return; // target became invalid this tick (e.g. concurrently downed) — no drain, no buff

    this.gameState.players[targetIdx] = dmgResult.value.player;
    this.broadcast(EventNames.DELTA, {
      type: 'player:hp-updated' as const,
      playerId: nearest.id,
      hp: dmgResult.value.player.hp,
    } satisfies DeltaEventMsg);

    if (dmgResult.value.downed) {
      this.broadcast(EventNames.DELTA, {
        type: 'player:downed' as const,
        playerId: nearest.id,
        downCount: dmgResult.value.player.downCount,
        reviveWindowMs: dmgResult.value.reviveWindowMs!,
        bodyX: dmgResult.value.player.bodyX!,
        bodyY: dmgResult.value.player.bodyY!,
      } satisfies DeltaEventMsg);
      const downedClient = this.clients.find(c => c.sessionId === nearest.id);
      if (downedClient) {
        downedClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
      }
    }

    const casterIdx = this.gameState.players.findIndex(p => p.id === casterId);
    if (casterIdx === -1) return;
    this.gameState.players[casterIdx] = healPlayer(this.gameState.players[casterIdx]!, drainAmount);
    this.broadcast(EventNames.DELTA, {
      type: 'player:hp-updated' as const,
      playerId: casterId,
      hp: this.gameState.players[casterIdx]!.hp,
    } satisfies DeltaEventMsg);

    const buffConfig = ABILITY_STATUS_EFFECT[PlayerClass.SOULDRINKER][abilityIndex];
    if (buffConfig) {
      this.gameState.players[casterIdx] = this.applyStatusEffectToTarget(
        this.gameState.players[casterIdx]!,
        { type: buffConfig.effectType, magnitude: buffConfig.magnitude, expiresAtMs: nowMs + buffConfig.durationMs },
        nowMs,
      );
    }
  }

  // Every currently-living damageable candidate (enemies + boss, if alive) as
  // plain {id,x,y} points — the shape Lightning Arc's pure chain math needs.
  // Re-queried at each chain hop (not a frozen snapshot) so a same-cast kill
  // earlier in the chain can't leave a stale, already-dead candidate behind.
  private gatherLightningArcCandidates(): LightningArcCandidate[] {
    const candidates: LightningArcCandidate[] = this.gameState.enemies
      .filter(e => e.isAlive)
      .map(e => ({ id: e.id, x: e.x, y: e.y }));
    if (this.gameState.boss && !this.gameState.boss.isDefeated) {
      candidates.push({ id: this.gameState.boss.id, x: this.gameState.boss.position.x, y: this.gameState.boss.position.y });
    }
    return candidates;
  }

  // Applies a single Lightning Arc hit's damage to whichever candidate id it
  // resolved to (enemy or boss) and broadcasts the matching delta(s) — mirrors
  // the generic hit-scan loop's own enemy/boss application exactly (applyDamage
  // for enemies, the same direct Math.max(0, boss.hp - damage) pattern for the
  // boss), just addressed by id instead of iterating a hit-zone query.
  // Returns whether the hit actually applied — the caller uses this to gate the
  // ability:chain-hit visual broadcast, so the host never draws an arc landing
  // on a target that received no damage and no accompanying enemy:damaged/
  // boss:damaged delta (a target can only fail to resolve here if it was
  // concurrently invalidated, e.g. killed by another source in the same tick
  // before this chain hop was reached).
  private resolveLightningArcHit(casterId: string, targetId: string, damage: number, nowMs: number): boolean {
    const ei = this.gameState.enemies.findIndex(e => e.id === targetId);
    if (ei !== -1) {
      const enemy = this.gameState.enemies[ei]!;
      const dropId = `drop-${this.tickCount}-${enemy.id}`;
      const dmgResult = applyDamage(enemy, damage, dropId, nowMs);
      if (!dmgResult.ok) return false;
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
          byPlayerId: casterId,
        } satisfies DeltaEventMsg);
        const enemyBody = this.enemyBodies.get(enemy.id);
        if (enemyBody) {
          this.physicsWorld.destroyBody(enemyBody);
          this.enemyBodies.delete(enemy.id);
        }
        this.enemyAttackCooldowns.delete(enemy.id);

        const drop = dmgResult.value.essenceDrop!;
        this.gameState.essenceDrops.push(drop);
        this.broadcast(EventNames.DELTA, { type: 'essence:dropped' as const, drop } satisfies DeltaEventMsg);
        const sensor = createEssenceSensorBody(this.physicsWorld, drop.id, drop.x, drop.y);
        this.essenceSensorBodies.set(drop.id, sensor);
      }
      return true;
    }

    if (this.gameState.boss && this.gameState.boss.id === targetId) {
      this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
      this.broadcast(EventNames.DELTA, {
        type: 'boss:damaged' as const,
        bossId: this.gameState.boss.id,
        newHp: this.gameState.boss.hp,
      } satisfies DeltaEventMsg);
      return true;
    }

    return false; // target id resolved to neither a living enemy nor the boss
  }

  // Lightning Arc (Stormcaller slot 0, Story 3.26): first target in a narrow
  // directional corridor (isInConeZone, Story 3.25's primitive), then chains up
  // to LIGHTNING_ARC_MAX_BOUNCES additional bounces at
  // LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF per bounce, searching from the PREVIOUS
  // hit's position (not re-aimed) — resolveLightningArcChain (game-rules) does
  // the pure nearest/falloff math; this method only gathers live candidates and
  // applies the resolved hits. Its own dispatch branch, structurally mirroring
  // handleDarkPact — not the generic hit-scan loop, since chain targeting isn't
  // a single hit-zone query. `rawDamage` here is already bond/god-mode adjusted
  // by the caller (see the dispatch loop), same convention as the generic loop's
  // pre-adjusted `damage` local.
  //
  // The epics AC text says the first-target gather includes "(+boss)" but the
  // chain-hop re-search line says only "living enemy" — an ambiguity flagged
  // (not silently resolved) in this story's Dev Notes. Implemented reading:
  // the boss DOES participate in chain hops, for consistency with every other
  // multi-hit ability in this codebase (generic hit-scan loop, Ancestor's Voice,
  // Spirit Nova) which never excludes the boss from AoE/sweep continuations.
  private handleLightningArc(casterId: string, caster: PlayerState, dirX: number, dirY: number, rawDamage: number, nowMs: number): void {
    const mag = Math.hypot(dirX, dirY);
    if (mag === 0) return; // no direction = no target — belt-and-suspenders; dispatchAbility already rejects zero-aim before this is ever called
    const normDirX = dirX / mag;
    const normDirY = dirY / mag;

    const hitRange = ABILITY_HIT_RANGE_PX[PlayerClass.STORMCALLER][0];
    const allCandidates = this.gatherLightningArcCandidates();
    const inCorridor = allCandidates.filter(c =>
      isInConeZone(caster.x, caster.y, normDirX, normDirY, c.x, c.y, hitRange, LIGHTNING_ARC_CORRIDOR_ANGLE_DEG));
    const firstTarget = findNearestCandidate(caster.x, caster.y, inCorridor);
    if (!firstTarget) return; // no target in corridor — no-op, cooldown still applies (handled by the caller)

    const remaining = allCandidates.filter(c => c.id !== firstTarget.id);
    const hits = resolveLightningArcChain(
      caster.x, caster.y, firstTarget, rawDamage, remaining,
      LIGHTNING_ARC_CHAIN_RADIUS_PX, LIGHTNING_ARC_MAX_BOUNCES, LIGHTNING_ARC_CHAIN_DAMAGE_FALLOFF,
    );

    for (const hit of hits) {
      const applied = this.resolveLightningArcHit(casterId, hit.id, hit.damage, nowMs);
      if (!applied) continue; // target invalidated (e.g. concurrently killed) — no damage applied, no visual for a hit that didn't land
      this.broadcast(EventNames.DELTA, {
        type: 'ability:chain-hit' as const,
        casterId,
        fromX: hit.fromX,
        fromY: hit.fromY,
        toEnemyId: hit.id,
        chainIndex: hit.chainIndex,
      } satisfies DeltaEventMsg);
    }
  }

  // Tempest Hurl's blast AoE (Story 3.26): reused by both its primary-contact
  // resolution (a regular projectile-enemy contact) and its boss-proximity
  // detonation (the boss's fixture never generates a planck contact event, so
  // it needs its own per-tick manual check) — same enemy sweep, two triggers.
  // Boss damage is NOT applied here — each call site handles the boss hit
  // itself (the boss can never be `excludeEnemyId`'s contact target, but it CAN
  // be the detonation trigger itself in the proximity-check call site, which
  // would double-hit it if this helper also checked the boss).
  private resolveTempestHurlEnemyBlast(x: number, y: number, damage: number, ownerId: string, excludeEnemyId: string | undefined, nowMs: number): void {
    for (const enemy of this.gameState.enemies) {
      if (!enemy.isAlive || enemy.id === excludeEnemyId) continue;
      if (!isInHitZone(x, y, 0, 0, enemy.x, enemy.y, TEMPEST_HURL_BLAST_RADIUS_PX, 0, false)) continue;

      const ei = this.gameState.enemies.findIndex(e => e.id === enemy.id);
      const dropId = `drop-${this.tickCount}-${enemy.id}`;
      const blastResult = applyDamage(this.gameState.enemies[ei]!, damage, dropId, nowMs);
      if (!blastResult.ok) continue;
      this.gameState.enemies[ei] = blastResult.value.enemy;
      this.broadcast(EventNames.DELTA, {
        type: 'enemy:damaged' as const,
        enemyId: enemy.id,
        damage,
        remainingHp: blastResult.value.enemy.hp,
      } satisfies DeltaEventMsg);

      if (blastResult.value.killed) {
        this.broadcast(EventNames.DELTA, {
          type: 'enemy:killed' as const,
          enemyId: enemy.id,
          byPlayerId: ownerId,
        } satisfies DeltaEventMsg);
        const enemyBody = this.enemyBodies.get(enemy.id);
        if (enemyBody) {
          this.physicsWorld.destroyBody(enemyBody);
          this.enemyBodies.delete(enemy.id);
        }
        this.enemyAttackCooldowns.delete(enemy.id);

        if (blastResult.value.essenceDrop) {
          const drop = blastResult.value.essenceDrop;
          this.gameState.essenceDrops.push(drop);
          this.broadcast(EventNames.DELTA, { type: 'essence:dropped' as const, drop } satisfies DeltaEventMsg);
          const sensor = createEssenceSensorBody(this.physicsWorld, drop.id, drop.x, drop.y);
          this.essenceSensorBodies.set(drop.id, sensor);
        }
      }
    }
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

      if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
        logger.debug({ roomId: this.roomId, playerId: player.id, newX, newY }, 'skipped non-finite player position read-back');
        continue;
      }

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

    // ── Planck phase 3b: read back projectile positions, broadcast projectile:moved ─
    for (const projectile of this.gameState.projectiles) {
      const body = this.projectileBodies.get(projectile.id);
      if (!body) continue;

      const pos = body.getPosition();
      const newX = toPixels(pos.x);
      const newY = toPixels(pos.y);

      if (!Number.isFinite(newX) || !Number.isFinite(newY)) {
        logger.debug({ roomId: this.roomId, projectileId: projectile.id, newX, newY }, 'skipped non-finite projectile position read-back');
        continue;
      }

      if (Math.abs(newX - projectile.x) > 0.5 || Math.abs(newY - projectile.y) > 0.5) {
        projectile.x = newX;
        projectile.y = newY;
        const delta = {
          type: 'projectile:moved' as const,
          projectileId: projectile.id,
          x: projectile.x,
          y: projectile.y,
        } satisfies DeltaEventMsg;
        this.broadcast(EventNames.DELTA, delta);
      }
    }

    // ── Tempest Hurl boss-proximity detonation (Story 3.26) ──────────────────────
    // The boss body's fixture has filterMaskBits: 0 (GameRoom.ts boss setup) — it
    // structurally cannot generate a planck contact event, so a Tempest Hurl
    // projectile thrown straight at the boss (missing every regular enemy) would
    // otherwise never detonate. Scoped to Tempest Hurl's own projectiles only —
    // does NOT touch the boss's general physics posture or any other projectile
    // ability (Blood Spike/Void Pulse still cannot hit the boss, unchanged).
    if (this.gameState.boss && !this.gameState.boss.isDefeated) {
      for (let pi = this.gameState.projectiles.length - 1; pi >= 0; pi--) {
        const projectile = this.gameState.projectiles[pi]!;
        if (projectile.class !== PlayerClass.STORMCALLER || projectile.abilityIndex !== 1) continue;

        const dx = projectile.x - this.gameState.boss.position.x;
        const dy = projectile.y - this.gameState.boss.position.y;
        const triggerRadius = TEMPEST_HURL_PROJECTILE_RADIUS_PX + 48;
        if (dx * dx + dy * dy > triggerRadius * triggerRadius) continue;

        const rawDamage = ABILITY_DAMAGE[projectile.class][projectile.abilityIndex as 0 | 1 | 2 | 3] ?? 0;
        const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(projectile.ownerId), this.godModePlayerIds.has(projectile.ownerId));

        this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
        this.broadcast(EventNames.DELTA, {
          type: 'boss:damaged' as const,
          bossId: this.gameState.boss.id,
          newHp: this.gameState.boss.hp,
        } satisfies DeltaEventMsg);

        this.resolveTempestHurlEnemyBlast(projectile.x, projectile.y, damage, projectile.ownerId, undefined, tickNowMs);

        this.broadcast(EventNames.DELTA, {
          type: 'projectile:hit' as const,
          projectileId: projectile.id,
          x: projectile.x,
          y: projectile.y,
        } satisfies DeltaEventMsg);

        this.gameState.projectiles.splice(pi, 1);
        const projectileBody = this.projectileBodies.get(projectile.id);
        if (projectileBody) {
          this.physicsWorld.destroyBody(projectileBody);
          this.projectileBodies.delete(projectile.id);
        }
        this.projectileSpawnPositions.delete(projectile.id);
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
        this.zoneStrikeTimers.delete(zone.id);
        this.broadcast(EventNames.DELTA, { type: 'zone:expired' as const, zoneId: zone.id } satisfies DeltaEventMsg);
        continue;
      }

      const lastTick = this.zoneLastTickAtMs.get(zone.id) ?? 0;
      if (!shouldZoneTick(zone, tickNowMs, lastTick)) continue;
      this.zoneLastTickAtMs.set(zone.id, tickNowMs);

      if (zone.effectType === 'pull') {
        // Void Pulse (Story 3.19): pulls both allies and enemies toward the zone
        // center using Story 3.14's displacement primitive. Excludes isDown/
        // isSpirit/isFrozen players from being pulled — resolves D-3.14-A's
        // still-open player-side liveness gap, mirroring gatherPlayersInHitZone's
        // exact same three-flag exclusion. Dead enemies are skipped the same way
        // Story 3.16's Stone Wall gates its own displacement call.
        const overlapping = this.zoneOverlapping.get(zone.id);
        if (overlapping) {
          for (const targetId of overlapping) {
            const enemyIdx = this.gameState.enemies.findIndex(e => e.id === targetId);
            if (enemyIdx !== -1) {
              const enemy = this.gameState.enemies[enemyIdx]!;
              if (!enemy.isAlive) continue;
              const { dx, dy } = applyDisplacement(enemy.x, enemy.y, zone.x, zone.y, VOID_PULSE_PULL_STRENGTH_PX);
              this.applyDisplacementToEnemy(enemy, dx, dy);
              continue;
            }
            const player = this.gameState.players.find(p => p.id === targetId);
            if (!player || player.isDown || player.isSpirit || player.isFrozen) continue;
            const { dx, dy } = applyDisplacement(player.x, player.y, zone.x, zone.y, VOID_PULSE_PULL_STRENGTH_PX);
            this.applyDisplacementToPlayer(targetId, dx, dy);
          }
        }
      } else if (zone.effectType === 'damage') {
        const rawDamage = this.zoneDamagePerTick.get(zone.id) ?? 0;
        const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(zone.ownerId), this.godModePlayerIds.has(zone.ownerId));
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

        // Story 6.9: boss branch. The boss's physics fixture has filterMaskBits: 0
        // (hit-scan only, see GameRoom.ts:1054) so it never appears in zoneOverlapping —
        // this must run regardless of whether `overlapping` is empty/undefined, hence its
        // own `if`, not nested inside the `overlapping`-gated loop above. Mirrors Spirit
        // Nova's `bossInRing` direct-position check.
        if (damage > 0 && this.gameState.boss && !this.gameState.boss.isDefeated &&
            isInHitZone(zone.x, zone.y, 0, 0,
              this.gameState.boss.position.x, this.gameState.boss.position.y,
              zone.radius, 0, false)) {
          this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
          this.broadcast(EventNames.DELTA, {
            type: 'boss:damaged' as const,
            bossId: this.gameState.boss.id,
            newHp: this.gameState.boss.hp,
          } satisfies DeltaEventMsg);
        }
      }

      // Storm Eye bonus lightning strike (Story 3.20): a second, longer-period
      // cadence than the steady tick above. Presence in zoneStrikeTimers (set
      // only when Storm Eye creates the zone) is what scopes this to Storm Eye
      // specifically — every other zone's id is simply absent from the map, so
      // this block is a no-op for them without a class/index check.
      const lastStrikeAt = this.zoneStrikeTimers.get(zone.id);
      if (lastStrikeAt !== undefined && tickNowMs - lastStrikeAt >= STORM_EYE_STRIKE_INTERVAL_MS) {
        this.zoneStrikeTimers.set(zone.id, tickNowMs);
        const strikeDamage = resolveOutgoingDamage(STORM_EYE_STRIKE_DAMAGE, proximityBuffed.has(zone.ownerId), this.godModePlayerIds.has(zone.ownerId));
        // zoneOverlapping tracks both factions (the zone sensor's filterMaskBits
        // includes CAT_PLAYER, not just CAT_ENEMY — allies can stand in the zone
        // too), but Storm Eye's 'damage' effectType only ever targets enemies
        // (same scoping as the steady tick above). Filter to alive enemies before
        // picking, or a stray ally/corpse id silently wastes the whole interval.
        const overlapping = this.zoneOverlapping.get(zone.id);
        const aliveEnemyIds = overlapping
          ? Array.from(overlapping).filter(id => this.gameState.enemies.some(e => e.id === id && e.isAlive))
          : [];
        // Story 6.9: the boss never appears in `overlapping` (filterMaskBits: 0, see
        // the zone damage-tick boss branch above) — give it a chance at the strike
        // via the same direct-position check, added as one extra candidate so the
        // existing per-enemy pick distribution is unchanged when the boss is out of range.
        const bossInRange = this.gameState.boss !== null && !this.gameState.boss.isDefeated &&
          isInHitZone(zone.x, zone.y, 0, 0,
            this.gameState.boss.position.x, this.gameState.boss.position.y,
            zone.radius, 0, false);
        const strikeCandidates: string[] = bossInRange ? [...aliveEnemyIds, '__boss__'] : aliveEnemyIds;
        if (strikeCandidates.length > 0) {
          const targetId = strikeCandidates[pickRandomIndex(this.prng(), strikeCandidates.length)]!;

          if (targetId === '__boss__') {
            this.gameState.boss!.hp = Math.max(0, this.gameState.boss!.hp - strikeDamage);
            this.broadcast(EventNames.DELTA, {
              type: 'zone:strike' as const,
              zoneId: zone.id,
              targetId: this.gameState.boss!.id,
              damage: strikeDamage,
            } satisfies DeltaEventMsg);
            this.broadcast(EventNames.DELTA, {
              type: 'boss:damaged' as const,
              bossId: this.gameState.boss!.id,
              newHp: this.gameState.boss!.hp,
            } satisfies DeltaEventMsg);
          } else {
            const ei = this.gameState.enemies.findIndex(e => e.id === targetId);
            if (ei !== -1) {
              const dropId = `drop-${this.tickCount}-${targetId}-strike`;
              const dmgResult = applyDamage(this.gameState.enemies[ei]!, strikeDamage, dropId, tickNowMs);
              if (dmgResult.ok) {
                this.gameState.enemies[ei] = dmgResult.value.enemy;

                this.broadcast(EventNames.DELTA, {
                  type: 'zone:strike' as const,
                  zoneId: zone.id,
                  targetId,
                  damage: strikeDamage,
                } satisfies DeltaEventMsg);

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
                    damage: strikeDamage,
                    remainingHp: dmgResult.value.enemy.hp,
                  } satisfies DeltaEventMsg);
                }
              }
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
      const rawDamage = ABILITY_DAMAGE[projectile.class][projectile.abilityIndex as 0 | 1 | 2 | 3] ?? 0;
      const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(projectile.ownerId), this.godModePlayerIds.has(projectile.ownerId));
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

      // Tempest Hurl blast (Stormcaller slot 1, Story 3.26): the primary contacted
      // enemy above is resolved exactly as any other projectile hit; this additionally
      // sweeps every OTHER living enemy (and the boss, which never generates its own
      // contact event) within TEMPEST_HURL_BLAST_RADIUS_PX of the impact point.
      if (projectile.class === PlayerClass.STORMCALLER && projectile.abilityIndex === 1) {
        this.resolveTempestHurlEnemyBlast(projectile.x, projectile.y, damage, projectile.ownerId, enemyId, tickNowMs);
        if (this.gameState.boss && !this.gameState.boss.isDefeated &&
            isInHitZone(projectile.x, projectile.y, 0, 0, this.gameState.boss.position.x, this.gameState.boss.position.y, TEMPEST_HURL_BLAST_RADIUS_PX, 0, false)) {
          this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
          this.broadcast(EventNames.DELTA, {
            type: 'boss:damaged' as const,
            bossId: this.gameState.boss.id,
            newHp: this.gameState.boss.hp,
          } satisfies DeltaEventMsg);
        }
      }

      // Lifesteal (Blood Spike, Story 3.19): declarative, fires for any projectile
      // ability with a nonzero ABILITY_LIFESTEAL_PCT entry. Only on a hit — a miss
      // (projectile expiry, handled elsewhere) already paid the self-cost with no
      // compensating heal. Resolves D-3.15-A's still-open caster-only case: skips
      // the heal if the caster went down/entered spirit form mid-flight (projectile
      // travel time can outlast the caster's own survival), same isDown/isSpirit
      // exclusion gatherPlayersInHitZone already applies to ally heal targets.
      const lifestealPct = ABILITY_LIFESTEAL_PCT[projectile.class][projectile.abilityIndex as 0 | 1 | 2 | 3];
      if (lifestealPct > 0) {
        const casterIdx = this.gameState.players.findIndex(p => p.id === projectile.ownerId);
        if (casterIdx !== -1 && !this.gameState.players[casterIdx]!.isDown && !this.gameState.players[casterIdx]!.isSpirit) {
          this.gameState.players[casterIdx] = healPlayer(this.gameState.players[casterIdx]!, calculateLifesteal(damage, lifestealPct));
          this.broadcast(EventNames.DELTA, {
            type: 'player:hp-updated' as const,
            playerId: projectile.ownerId,
            hp: this.gameState.players[casterIdx]!.hp,
          } satisfies DeltaEventMsg);
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
          if (player.isDown || player.isSpirit || player.isFrozen || this.godModePlayerIds.has(player.id)) continue;
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
            player.bodyX = player.x;
            player.bodyY = player.y;
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
              bodyX: player.bodyX!,
              bodyY: player.bodyY!,
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
          if (!Number.isFinite(enemy.x) || !Number.isFinite(enemy.y)) {
            logger.debug({ roomId: this.roomId, enemyId: enemy.id }, 'skipped non-finite enemy position broadcast');
            continue;
          }
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
              if (!Number.isFinite(evt.x) || !Number.isFinite(evt.y)) {
                logger.debug({ roomId: this.roomId, bossId: evt.bossId }, 'skipped non-finite boss position broadcast');
                break;
              }
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
              // Story 7.7a: post-hoc charge notification for host VFX. tickBoss has already
              // applied the movement to this.gameState.boss.position (same object reference),
              // so this broadcast is purely additive — no state write here.
              this.broadcast(EventNames.DELTA, {
                type: 'boss:charged', bossId: evt.bossId, x: evt.x, y: evt.y,
              } satisfies DeltaEventMsg);
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

            default: {
              // Exhaustiveness guard: adding a new BossEvent variant without a case here causes a TS error.
              const _exhaustive: never = evt;
              void _exhaustive;
              break;
            }
          }
        }
      } else {
        logger.error({ roomId: this.roomId, error: bossResult.error }, 'tickBoss returned error');
      }
    }

    // Process ability inputs — valid anywhere in the hub, or in dungeon phase
    for (const { clientId, msg } of this.inputQueue) {
      if (msg.event.type !== 'ability') continue;
      const { abilityIndex, directionX, directionY } = msg.event.ability;

      const player = this.gameState.players.find(p => p.id === clientId);
      if (!player || player.class === null || player.isFrozen || player.isDown || player.isSpirit) continue;

      const inDungeon = this.gameState.session.phase === 'dungeon';

      const playerCooldowns = this.cooldownMap.get(clientId);
      if (!playerCooldowns) continue;

      const nowAbility = Date.now();

      // Soul Mend (Spiritcaller slot 2): AIM_CAST hold-to-channel, not an instant-
      // resolve ability — branch before dispatchAbility so it neither triggers the
      // normal cooldown gate/instant hit-scan path nor enters cooldown until the
      // channel actually completes (Story 3.18). The branch condition itself is
      // checked by inputType, not class/index, so a future AIM_CAST ability would
      // still get routed here instead of through the normal dispatch path — but
      // handleSoulMendFireAttempt's actual target-finding/revive logic is Soul-Mend-
      // specific, not generic; a future non-revive AIM_CAST ability would need its
      // own handler, not just a new case here.
      const abilityDefForInput = CLASS_DEFINITIONS[player.class].abilities[abilityIndex];
      if (abilityDefForInput?.inputType === 'AIM_CAST') {
        this.handleSoulMendFireAttempt(clientId, player, abilityIndex, directionX, directionY, playerCooldowns, nowAbility);
        continue;
      }

      const result = dispatchAbility({
        playerClass: player.class,
        abilityIndex,
        directionX,
        directionY,
        cooldownExpiresAt: playerCooldowns[abilityIndex] ?? 0,
        nowMs: nowAbility,
        casterHp: player.hp,
        casterMaxHp: player.maxHp,
      });

      if (!result.ok) continue;

      const { cooldownMs, expiresAt, directionX: dirX, directionY: dirY } = result.value;
      playerCooldowns[abilityIndex] = expiresAt;

      const targetClient = this.clients.find(c => c.sessionId === clientId);
      if (targetClient) {
        // expiresAt === nowAbility + cooldownMs (dispatchAbility), so nowAbility is
        // the true cooldown start — send both epochs, not a duration.
        this.sendCooldownUpdate(targetClient, abilityIndex, nowAbility, expiresAt);
      }

      // Self-cost (Blood Spike, Story 3.19): generic for any ability with a nonzero
      // ABILITY_SELF_COST_HP entry — dispatchAbility already computed the 1-HP-floored
      // amount, this just applies it. Runs regardless of dungeon/training-dummy phase,
      // same as the cooldown update above, since it's a caster-resource cost, not a
      // combat hit effect.
      if (result.value.selfCostHpApplied > 0) {
        player.hp -= result.value.selfCostHpApplied;
        this.broadcast(EventNames.DELTA, {
          type: 'player:hp-updated' as const,
          playerId: clientId,
          hp: player.hp,
        } satisfies DeltaEventMsg);
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

        // Projectile delivery (Blood Spike, Void Pulse — Story 3.19): spawns a
        // ProjectileState instead of resolving via the same-tick hit-scan below.
        // Branches BEFORE any hit-scan/status-effect logic — the projectile's own
        // hit resolution (Story 3.13's contact-listener path) handles damage later.
        if (ABILITY_DELIVERY[player.class][abilityIndex as 0 | 1 | 2 | 3] === 'projectile') {
          const mag = Math.hypot(dirX, dirY);
          if (mag === 0) continue; // no direction = no shot, same rule as every other directional ability
          const projDirX = dirX / mag;
          const projDirY = dirY / mag;
          const projectileId = `projectile-${this.tickCount}-${clientId}-${abilityIndex}`;
          const projectile: ProjectileState = {
            id: projectileId,
            ownerId: clientId,
            x: player.x,
            y: player.y,
            class: player.class,
            abilityIndex,
          };
          this.gameState.projectiles.push(projectile);
          // Tempest Hurl (Stormcaller slot 1, Story 3.26): bigger/slower body than
          // the shared projectile defaults — class/index-gated, same style as every
          // other per-ability special-case in this dispatch block.
          const isTempestHurl = player.class === PlayerClass.STORMCALLER && abilityIndex === 1;
          const projectileSpeed = isTempestHurl ? TEMPEST_HURL_SPEED_PX_S : PROJECTILE_SPEED_PX_S;
          // No radiusPx arg for non-Tempest-Hurl casts — createProjectileBody's own
          // default (12) applies, rather than re-stating that literal here too.
          const projectileBody = isTempestHurl
            ? createProjectileBody(this.physicsWorld, projectileId, player.x, player.y, projDirX, projDirY, projectileSpeed, TEMPEST_HURL_PROJECTILE_RADIUS_PX)
            : createProjectileBody(this.physicsWorld, projectileId, player.x, player.y, projDirX, projDirY, projectileSpeed);
          this.projectileBodies.set(projectileId, projectileBody);
          this.projectileSpawnPositions.set(projectileId, { x: player.x, y: player.y });
          // No dedicated "projectile:spawned" delta type exists (net-protocol is a
          // blocked path this story) — same situation as 'add:spawned' above: a new
          // entity needs full-state sync, so broadcast a SNAPSHOT, matching that
          // existing precedent instead of inventing a new wire type.
          this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
          continue;
        }

        // Zone delivery (Storm Eye — Story 3.20): places a ZoneState directly at the
        // aimed position, unlike the chained-from-projectile zones spawnChainedZone
        // creates (Void Pulse). Branches before any hit-scan/status-effect logic, same
        // as the projectile branch above — the zone's own tick phase (below) resolves
        // damage later, not this dispatch.
        if (ABILITY_DELIVERY[player.class][abilityIndex as 0 | 1 | 2 | 3] === 'zone') {
          const mag = Math.hypot(dirX, dirY);
          if (mag === 0) continue; // no direction = no placement, same rule as every other directional ability
          const normDirX = dirX / mag;
          const normDirY = dirY / mag;
          const hitRange = ABILITY_HIT_RANGE_PX[player.class][abilityIndex] ?? 0;
          const zoneX = player.x + normDirX * hitRange;
          const zoneY = player.y + normDirY * hitRange;
          const zoneId = `zone-${this.tickCount}-${clientId}-${this.nextZoneSeq++}`;
          const zone: ZoneState = {
            id: zoneId,
            ownerId: clientId,
            x: zoneX, y: zoneY,
            radius: STORM_EYE_ZONE_RADIUS_PX,
            effectType: 'damage',
            tickIntervalMs: STORM_EYE_TICK_MS,
            expiresAtMs: nowAbility + STORM_EYE_DURATION_MS,
          };
          this.gameState.zones.push(zone);
          const zoneBody = createZoneBody(this.physicsWorld, zoneId, zoneX, zoneY, STORM_EYE_ZONE_RADIUS_PX);
          this.zoneBodies.set(zoneId, zoneBody);
          this.zoneLastTickAtMs.set(zoneId, nowAbility);
          this.zoneOverlapping.set(zoneId, new Set());
          this.zoneDamagePerTick.set(zoneId, STORM_EYE_TICK_DAMAGE);
          this.zoneStrikeTimers.set(zoneId, nowAbility); // marks this zone strike-eligible — Storm Eye's only
          this.broadcast(EventNames.SNAPSHOT, { type: 'snapshot', state: this.gameState } satisfies SnapshotMsg);
          continue;
        }

        // Dark Pact (Souldrinker slot 2, Story 3.19): single-target ally drain, not
        // a hit-scan or a mixed-faction AoE — its own dispatch branch, before the
        // generic self-scope status-effect block below (the damageBuff half of its
        // effect is gated on a drain target actually being found).
        if (player.class === PlayerClass.SOULDRINKER && abilityIndex === 2) {
          this.handleDarkPact(clientId, player, dirX, dirY, nowAbility);
          continue;
        }

        // Lightning Arc (Stormcaller slot 0, Story 3.26): corridor-gather + chain,
        // not a single hit-zone query — its own dispatch branch, before the generic
        // hit-scan's hitRange/hitRadius computation. Never falls through to the
        // generic loop below.
        if (player.class === PlayerClass.STORMCALLER && abilityIndex === 0) {
          const chainDamage = resolveOutgoingDamage(result.value.damage, proximityBuffed.has(clientId), this.godModePlayerIds.has(clientId));
          this.handleLightningArc(clientId, player, dirX, dirY, chainDamage, nowAbility);
          continue;
        }

        // Self-scope status effect (e.g. Iron Skin) applies independently of
        // the damage hit-scan below — must run before the damage=0 guard,
        // since buff abilities carry no damage.
        const statusConfig = ABILITY_STATUS_EFFECT[player.class][abilityIndex];
        if (statusConfig?.scope === 'self') {
          const casterIdx = this.gameState.players.findIndex(p => p.id === clientId);
          if (casterIdx !== -1) {
            this.gameState.players[casterIdx] = this.applyStatusEffectToTarget(
              this.gameState.players[casterIdx]!,
              { type: statusConfig.effectType, magnitude: statusConfig.magnitude, expiresAtMs: nowAbility + statusConfig.durationMs },
              nowAbility,
            );
          }
        } else if (statusConfig?.scope === 'allies-in-zone') {
          // Warding Cry (Story 3.17): proximity radius, no direction/cone — uses Task 1's
          // players-gathering query instead of the enemy loop. Same "runs independent of
          // the damage hit-scan" rationale as the self-scope branch above.
          const allyHitRadius = ABILITY_HIT_RADIUS_PX[player.class][abilityIndex] ?? 60;
          for (const ally of this.gatherPlayersInHitZone(player.x, player.y, 0, 0, allyHitRadius, 0, false, clientId)) {
            const allyIdx = this.gameState.players.findIndex(p => p.id === ally.id);
            if (allyIdx === -1) continue;
            this.gameState.players[allyIdx] = this.applyStatusEffectToTarget(
              this.gameState.players[allyIdx]!,
              { type: statusConfig.effectType, magnitude: statusConfig.magnitude, expiresAtMs: nowAbility + statusConfig.durationMs },
              nowAbility,
            );
          }
        }

        // Spirit Nova (Spiritcaller slot 1): expanding-radius sweep, not an instant
        // hit-scan — tracked over its duration by the "Spirit Nova sweep" tick phase
        // below instead. Branch before the hit-scan path (Story 3.17, Task 3).
        if (player.class === PlayerClass.SPIRITCALLER && abilityIndex === 1) {
          this.activeSpiritNovas.push({
            casterId: clientId,
            x: player.x,
            y: player.y,
            startedAtMs: nowAbility,
            durationMs: SPIRIT_NOVA_DURATION_MS,
            maxRadiusPx: SPIRIT_NOVA_MAX_RADIUS_PX,
            hitIds: new Set(),
          });
          continue;
        }

        const isDirectional = abilityDef.inputType !== 'TAP';
        const hitRange  = ABILITY_HIT_RANGE_PX[player.class][abilityIndex] ?? 0;
        const hitRadius = ABILITY_HIT_RADIUS_PX[player.class][abilityIndex] ?? 60;
        const displacementStrength = ABILITY_DISPLACEMENT_STRENGTH[player.class][abilityIndex] ?? 0;
        const healAmount = ABILITY_HEAL_AMOUNT[player.class][abilityIndex] ?? 0;
        const casterX = player.x;
        const casterY = player.y;
        const rawDamage = result.value.damage;
        if (rawDamage <= 0 && healAmount <= 0) continue;  // ponytail: skip hit-scan for buff-only abilities (damage=0, heal=0)
        const damage = resolveOutgoingDamage(rawDamage, proximityBuffed.has(clientId), this.godModePlayerIds.has(clientId));

        // AC6: normalize direction so sub-unit joystick magnitude doesn't shrink hit range
        const mag = Math.hypot(dirX, dirY);
        // Story 3.11: hitRange=0 directional abilities (e.g. Stone Wall, Void
        // Pulse) hit at the player's own position regardless of direction —
        // don't require a drag for those, only for abilities whose hit
        // circle is actually offset by direction.
        if (isDirectional && mag === 0 && hitRange > 0) continue; // no direction = no hit
        const normDirX = isDirectional && mag > 0 ? dirX / mag : dirX;
        const normDirY = isDirectional && mag > 0 ? dirY / mag : dirY;

        // Ancestor's Voice (Spiritcaller slot 0): mixed-faction cone — gather enemies
        // and allies in the hit zone from one query, split via resolveMixedFactionTargets,
        // damage enemies / heal allies (Story 3.17, Task 2).
        if (player.class === PlayerClass.SPIRITCALLER && abilityIndex === 0) {
          const voiceShape = ABILITY_HIT_SHAPE[PlayerClass.SPIRITCALLER][0];
          const voiceConeAngleDeg = ABILITY_CONE_ANGLE_DEG[PlayerClass.SPIRITCALLER][0];
          const enemiesInZone = this.gameState.enemies.filter(e =>
            e.isAlive && this.isInAbilityHitZone(voiceShape, casterX, casterY, normDirX, normDirY, e.x, e.y, hitRadius, hitRange, voiceConeAngleDeg, isDirectional));
          const alliesInZone = this.gatherPlayersInHitZone(
            casterX, casterY, normDirX, normDirY, hitRadius, hitRange, isDirectional, clientId,
            voiceShape === 'cone' ? voiceConeAngleDeg : undefined,
          );
          const { allies, enemies } = resolveMixedFactionTargets(clientId, [...enemiesInZone, ...alliesInZone]);

          for (const target of enemies) {
            const ei = this.gameState.enemies.findIndex(e => e.id === target.id);
            if (ei === -1) continue;
            const dropId = `drop-${this.tickCount}-${target.id}`;
            const dmgResult = applyDamage(this.gameState.enemies[ei]!, damage, dropId, nowAbility);
            if (!dmgResult.ok) continue;
            this.gameState.enemies[ei] = dmgResult.value.enemy;

            this.broadcast(EventNames.DELTA, {
              type: 'enemy:damaged' as const,
              enemyId: target.id,
              damage,
              remainingHp: dmgResult.value.enemy.hp,
            } satisfies DeltaEventMsg);

            if (dmgResult.value.killed) {
              this.broadcast(EventNames.DELTA, {
                type: 'enemy:killed' as const,
                enemyId: target.id,
                byPlayerId: clientId,
              } satisfies DeltaEventMsg);

              const enemyBody = this.enemyBodies.get(target.id);
              if (enemyBody) {
                this.physicsWorld.destroyBody(enemyBody);
                this.enemyBodies.delete(target.id);
              }
              this.enemyAttackCooldowns.delete(target.id);

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

          // Story 6.7: boss hit-scan for the mixed-faction cone — same pattern as Task 1.
          if (this.gameState.boss && !this.gameState.boss.isDefeated &&
              this.isInAbilityHitZone(voiceShape, casterX, casterY, normDirX, normDirY,
                this.gameState.boss.position.x, this.gameState.boss.position.y,
                hitRadius, hitRange, voiceConeAngleDeg, isDirectional)) {
            this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
            this.broadcast(EventNames.DELTA, {
              type: 'boss:damaged' as const,
              bossId: this.gameState.boss.id,
              newHp: this.gameState.boss.hp,
            } satisfies DeltaEventMsg);
          }

          for (const ally of allies) {
            const pi = this.gameState.players.findIndex(p => p.id === ally.id);
            if (pi === -1) continue;
            this.gameState.players[pi] = healPlayer(this.gameState.players[pi]!, healAmount);
            this.broadcast(EventNames.DELTA, {
              type: 'player:hp-updated' as const,
              playerId: ally.id,
              hp: this.gameState.players[pi]!.hp,
            } satisfies DeltaEventMsg);
          }
          continue;
        }

        const hitShape = ABILITY_HIT_SHAPE[player.class][abilityIndex] ?? 'circle';
        const coneAngleDeg = ABILITY_CONE_ANGLE_DEG[player.class][abilityIndex] ?? 0;

        for (let ei = 0; ei < this.gameState.enemies.length; ei++) {
          const enemy = this.gameState.enemies[ei]!;
          if (!enemy.isAlive) continue;
          if (!this.isInAbilityHitZone(hitShape, player.x, player.y, normDirX, normDirY, enemy.x, enemy.y, hitRadius, hitRange, coneAngleDeg, isDirectional)) continue;

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

          if (!dmgResult.value.killed && statusConfig?.scope === 'enemies-in-zone') {
            this.gameState.enemies[ei] = this.applyStatusEffectToTarget(
              this.gameState.enemies[ei]!,
              { type: statusConfig.effectType, magnitude: statusConfig.magnitude, expiresAtMs: nowAbility + statusConfig.durationMs },
              nowAbility,
            );
          }

          if (!dmgResult.value.killed && displacementStrength > 0) {
            const { dx, dy } = applyDisplacement(enemy.x, enemy.y, casterX, casterY, displacementStrength);
            this.applyDisplacementToEnemy(this.gameState.enemies[ei]!, dx, dy);
          }

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

        // Story 6.7: boss hit-scan — closes D-6.3-0. Mirrors applyDamage's core math
        // directly (not a call to applyDamage() itself — BossState has no isAlive/x/y/
        // statusEffects; see this story's Non-goals for why). No essence drop, no
        // status-effect/displacement application — boss defeat/phase transitions are
        // handled entirely by tickBoss reading boss.hp on its own next tick.
        if (this.gameState.boss && !this.gameState.boss.isDefeated &&
            this.isInAbilityHitZone(hitShape, player.x, player.y, normDirX, normDirY,
              this.gameState.boss.position.x, this.gameState.boss.position.y,
              hitRadius, hitRange, coneAngleDeg, isDirectional)) {
          this.gameState.boss.hp = Math.max(0, this.gameState.boss.hp - damage);
          this.broadcast(EventNames.DELTA, {
            type: 'boss:damaged' as const,
            bossId: this.gameState.boss.id,
            newHp: this.gameState.boss.hp,
          } satisfies DeltaEventMsg);
        }
      }

      logger.debug({ roomId: this.roomId, clientId, abilityIndex, dirX, dirY }, 'ability fired');
    }

    // ── Spirit Nova sweep (Story 3.17) ────────────────────────────────────────
    // One-shot growing-ring sweep: each active entry's hit radius grows from 0 to
    // its max over its duration; each target is hit exactly once as the ring
    // passes over it (tracked via hitIds), not every tick for the whole duration.
    // Guarded to dungeon phase, matching every other per-tick combat block (bond
    // drain, revive timers, spirit-ability dispatch) — a sweep still in flight
    // when the phase flips to post-run (boss defeat / run failure) must not keep
    // dealing damage or healing into the post-run screen.
    if (this.gameState.session.phase === 'dungeon') {
      for (let si = this.activeSpiritNovas.length - 1; si >= 0; si--) {
        const nova = this.activeSpiritNovas[si]!;
        const currentRadius = resolveExpandingRadius(tickNowMs - nova.startedAtMs, nova.durationMs, nova.maxRadiusPx);

        const enemiesInRing = this.gameState.enemies.filter(e =>
          e.isAlive && !nova.hitIds.has(e.id) &&
          isInHitZone(nova.x, nova.y, 0, 0, e.x, e.y, currentRadius, 0, false));
        const alliesInRing = this.gatherPlayersInHitZone(nova.x, nova.y, 0, 0, currentRadius, 0, false, nova.casterId)
          .filter(p => !nova.hitIds.has(p.id));
        // Story 6.7: boss participates in this sweep's once-per-activation hit tracking too.
        // Computed here (not inside the `if` below) so a boss-only ring — zero enemies,
        // zero allies — still enters the block and computes novaDamage.
        const bossInRing = this.gameState.boss !== null && !this.gameState.boss.isDefeated &&
          !nova.hitIds.has(this.gameState.boss.id) &&
          isInHitZone(nova.x, nova.y, 0, 0,
            this.gameState.boss.position.x, this.gameState.boss.position.y, currentRadius, 0, false);

        if (enemiesInRing.length > 0 || alliesInRing.length > 0 || bossInRing) {
          const { allies, enemies } = resolveMixedFactionTargets(nova.casterId, [...enemiesInRing, ...alliesInRing]);
          const rawNovaDamage = ABILITY_DAMAGE[PlayerClass.SPIRITCALLER][1];
          // Same Bond proximity-damage-buff treatment as every other damaging ability
          // (see Ancestor's Voice a few lines above) — heal is intentionally unbuffed,
          // matching Ancestor's Voice's heal side (BOND_DAMAGE_MULT is a damage-only buff).
          const novaDamage = resolveOutgoingDamage(rawNovaDamage, proximityBuffed.has(nova.casterId), this.godModePlayerIds.has(nova.casterId));
          const novaHeal = ABILITY_HEAL_AMOUNT[PlayerClass.SPIRITCALLER][1];

          for (const target of enemies) {
            nova.hitIds.add(target.id);
            const ei = this.gameState.enemies.findIndex(e => e.id === target.id);
            if (ei === -1) continue;
            const dropId = `drop-${this.tickCount}-${target.id}`;
            const dmgResult = applyDamage(this.gameState.enemies[ei]!, novaDamage, dropId, tickNowMs);
            if (!dmgResult.ok) continue;
            this.gameState.enemies[ei] = dmgResult.value.enemy;

            this.broadcast(EventNames.DELTA, {
              type: 'enemy:damaged' as const,
              enemyId: target.id,
              damage: novaDamage,
              remainingHp: dmgResult.value.enemy.hp,
            } satisfies DeltaEventMsg);

            if (dmgResult.value.killed) {
              this.broadcast(EventNames.DELTA, {
                type: 'enemy:killed' as const,
                enemyId: target.id,
                byPlayerId: nova.casterId,
              } satisfies DeltaEventMsg);

              const enemyBody = this.enemyBodies.get(target.id);
              if (enemyBody) {
                this.physicsWorld.destroyBody(enemyBody);
                this.enemyBodies.delete(target.id);
              }
              this.enemyAttackCooldowns.delete(target.id);

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

          // Story 6.7: boss hit — placed after the enemy loop, before the ally heal loop.
          if (bossInRing) {
            nova.hitIds.add(this.gameState.boss!.id);
            this.gameState.boss!.hp = Math.max(0, this.gameState.boss!.hp - novaDamage);
            this.broadcast(EventNames.DELTA, {
              type: 'boss:damaged' as const,
              bossId: this.gameState.boss!.id,
              newHp: this.gameState.boss!.hp,
            } satisfies DeltaEventMsg);
          }

          for (const ally of allies) {
            nova.hitIds.add(ally.id);
            const pi = this.gameState.players.findIndex(p => p.id === ally.id);
            if (pi === -1) continue;
            this.gameState.players[pi] = healPlayer(this.gameState.players[pi]!, novaHeal);
            this.broadcast(EventNames.DELTA, {
              type: 'player:hp-updated' as const,
              playerId: ally.id,
              hp: this.gameState.players[pi]!.hp,
            } satisfies DeltaEventMsg);
          }
        }

        if (tickNowMs >= nova.startedAtMs + nova.durationMs) {
          this.activeSpiritNovas.splice(si, 1);
        }
      }
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
          // spiritCooldownMap was just set to nowSpirit + SPIRIT_ABILITY_COOLDOWN_MS.
          this.sendCooldownUpdate(targetClient, 3, nowSpirit, nowSpirit + SPIRIT_ABILITY_COOLDOWN_MS);
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
          if (player.isDown || player.isSpirit || player.isFrozen || this.godModePlayerIds.has(player.id)) continue;
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
            bodyX: dmgResult.value.player.bodyX!,
            bodyY: dmgResult.value.player.bodyY!,
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
                if (this.godModePlayerIds.has(partner.id)) continue;
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
                  bodyX: wipeResult.value.player.bodyX!,
                  bodyY: wipeResult.value.player.bodyY!,
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
          if (!player || player.isDown || player.isSpirit || player.isFrozen || this.godModePlayerIds.has(player.id)) continue;
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
        // Story 3.21b: must admit isSpirit players too, not just isDown — otherwise
        // a player who has already transitioned to spirit form never re-enters this
        // loop on any later tick, and the proximity-revive check below (which now
        // targets bodyX/bodyY) never runs for them at all. The "Timer expiry" branch
        // immediately below is itself gated on reviveTimerExpiresAt > 0, which is
        // already 0 for an isSpirit player, so it's skipped safely and falls through
        // to the proximity-revive check.
        if (!player.isDown && !player.isSpirit) continue;

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

        // Proximity revive: first living teammate in range wins. Targets bodyX/bodyY
        // (Story 3.21b) — the fixed down location — not player.x/y, which has been
        // moving independently under the spirit's own input since timer expiry.
        let revivedBy: string | null = null;
        const targetX = player.bodyX ?? player.x;
        const targetY = player.bodyY ?? player.y;
        for (const teammate of this.gameState.players) {
          if (teammate.id === player.id) continue;
          if (teammate.isDown || teammate.isSpirit || teammate.isFrozen) continue;
          const dx = teammate.x - targetX;
          const dy = teammate.y - targetY;
          if (Math.sqrt(dx * dx + dy * dy) <= REVIVE_RADIUS_PX) {
            revivedBy = teammate.id;
            break;
          }
        }

        if (revivedBy !== null) {
          const piRevive = this.gameState.players.findIndex(p => p.id === player.id);
          // x/y snap back to the body location (Story 3.21b) — a spirit revived
          // after wandering must resume at the body, not wherever the spirit stood.
          // Must also reposition the physics body: otherwise the next tick's
          // Planck phase-3 position read-back would overwrite x/y right back to
          // wherever the body actually still is (the spirit's last physical spot),
          // undoing this snap (same reasoning as applyDisplacementToPlayer above).
          this.gameState.players[piRevive] = { ...this.gameState.players[piRevive]!, isDown: false, isSpirit: false, hp: REVIVE_HP, reviveTimerExpiresAt: 0, x: targetX, y: targetY };
          const reviveBody = this.playerBodies.get(player.id);
          if (reviveBody) reviveBody.setPosition(Vec2(toMeters(targetX), toMeters(targetY)));

          this.broadcast(EventNames.DELTA, {
            type: 'player:revived' as const,
            playerId: player.id,
          } satisfies DeltaEventMsg);

          this.broadcast(EventNames.DELTA, {
            type: 'player:moved' as const,
            playerId: player.id,
            x: targetX,
            y: targetY,
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

    // ── Soul Mend hold-to-channel progression (Story 3.18) ───────────────────
    // Runs after proximity revive above so a target already revived by proximity
    // (or someone else's Soul Mend) this same tick is correctly seen as no-longer-
    // isDown and cancels here rather than double-reviving.
    if (this.gameState.session.phase === 'dungeon') {
      for (const caster of this.gameState.players) {
        const channel = caster.channelingAbility;
        if (channel === null) continue;

        const target = this.gameState.players.find(p => p.id === channel.targetPlayerId);
        const hitRange = ABILITY_HIT_RANGE_PX[caster.class as PlayerClass][channel.abilityIndex as 0 | 1 | 2 | 3] ?? 0;
        const hitRadius = ABILITY_HIT_RADIUS_PX[caster.class as PlayerClass][channel.abilityIndex as 0 | 1 | 2 | 3] ?? 0;
        const lastInput = this.lastSoulMendInputAt.get(caster.id) ?? 0;
        const casterIncapacitated = caster.isDown || caster.isFrozen || caster.isSpirit;

        if (shouldCancelSoulMendChannel(target, caster.x, caster.y, casterIncapacitated, lastInput, tickNowMs, SOUL_MEND_LIVENESS_MS, hitRange + hitRadius)) {
          this.cancelSoulMendChannel(caster.id);
          continue;
        }

        if (tickNowMs >= channel.startedAt + channel.durationMs) {
          this.completeSoulMendChannel(caster.id, target!.id, channel.abilityIndex);
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
            this.sendCooldownUpdate(targetClient, i, 0, 0); // cleared
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
          this.sendCooldownUpdate(targetClient, 3, 0, 0); // cleared
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

  // Emit a cooldown:update carrying server epochs (cooldown-sync fix 2026-07-25,
  // ADR-0004) rather than a duration. The client corrects for host↔phone wall-clock
  // skew via serverNowMs. Pass startedAtMs===expiresAtMs (e.g. both 0) to signal
  // "cleared / ready now" — the client then clears the slot.
  private sendCooldownUpdate(
    target: { send(type: string, message: CooldownUpdateMsg): void },
    abilityIndex: number,
    startedAtMs: number,
    expiresAtMs: number,
  ): void {
    target.send(EventNames.COOLDOWN_UPDATE, {
      type: 'cooldown:update',
      abilityIndex,
      startedAtMs,
      expiresAtMs,
      serverNowMs: Date.now(),
    } satisfies CooldownUpdateMsg);
  }

  // Send a "cleared" cooldown:update for class slots 0-2 that expired while the player
  // was in spirit form (server cleared cooldowns[i] to 0 but skipped the message per AC7).
  private flushExpiredClassCooldowns(playerId: string): void {
    const cooldowns = this.cooldownMap.get(playerId);
    if (!cooldowns) return;
    const targetClient = this.clients.find(c => c.sessionId === playerId);
    if (!targetClient) return;
    for (let i = 0; i < 3; i++) {
      if (cooldowns[i] === 0) {
        this.sendCooldownUpdate(targetClient, i, 0, 0); // cleared
      }
    }
  }

  // ── Soul Mend hold-to-channel (Story 3.18) ──────────────────────────────────
  // Called once per AIM_CAST fire-attempt (mobile resends every 33ms while held —
  // same continuous-send pattern AUTO abilities already use). First fire-attempt
  // for a not-yet-channeling caster starts the channel; subsequent fire-attempts
  // while already channeling just refresh the liveness timestamp.
  private handleSoulMendFireAttempt(
    casterId: string,
    caster: PlayerState,
    abilityIndex: number,
    dirX: number,
    dirY: number,
    playerCooldowns: number[],
    nowMs: number,
  ): void {
    if (caster.channelingAbility !== null) {
      this.lastSoulMendInputAt.set(casterId, nowMs);
      return;
    }

    if ((playerCooldowns[abilityIndex] ?? 0) > nowMs) return;

    const hitRange = ABILITY_HIT_RANGE_PX[caster.class as PlayerClass][abilityIndex as 0 | 1 | 2 | 3] ?? 0;
    const hitRadius = ABILITY_HIT_RADIUS_PX[caster.class as PlayerClass][abilityIndex as 0 | 1 | 2 | 3] ?? 0;
    const mag = Math.hypot(dirX, dirY);
    if (mag === 0 && hitRange > 0) return; // no aim direction = no target, same rule as every other directional ability
    const normDirX = mag > 0 ? dirX / mag : dirX;
    const normDirY = mag > 0 ? dirY / mag : dirY;

    const downedAllies = this.gameState.players.filter(p => p.id !== casterId && p.isDown);
    const target = findSoulMendTarget(caster.x, caster.y, normDirX, normDirY, downedAllies, hitRange, hitRadius);
    if (!target) return;

    const casterIdx = this.gameState.players.findIndex(p => p.id === casterId);
    if (casterIdx === -1) return;
    this.gameState.players[casterIdx] = {
      ...this.gameState.players[casterIdx]!,
      channelingAbility: { abilityIndex, targetPlayerId: target.id, startedAt: nowMs, durationMs: SOUL_MEND_CHANNEL_DURATION_MS },
    };
    this.lastSoulMendInputAt.set(casterId, nowMs);

    this.broadcast(EventNames.DELTA, {
      type: 'cast:started' as const,
      casterId,
      targetPlayerId: target.id,
      abilityIndex,
      startedAt: nowMs,
      durationMs: SOUL_MEND_CHANNEL_DURATION_MS,
    } satisfies DeltaEventMsg);
  }

  private cancelSoulMendChannel(casterId: string): void {
    const casterIdx = this.gameState.players.findIndex(p => p.id === casterId);
    if (casterIdx !== -1) {
      this.gameState.players[casterIdx] = { ...this.gameState.players[casterIdx]!, channelingAbility: null };
    }
    this.lastSoulMendInputAt.delete(casterId);
    this.broadcast(EventNames.DELTA, { type: 'cast:cancelled' as const, casterId } satisfies DeltaEventMsg);
  }

  // Copies the existing proximity-revive block's 4 actions exactly (state mutation,
  // player:revived broadcast, player:hp-updated broadcast, SPIRIT_FORM message) —
  // Soul Mend bypasses the walk-to-body proximity flow but produces the same result.
  private completeSoulMendChannel(casterId: string, targetId: string, abilityIndex: number): void {
    const targetIdx = this.gameState.players.findIndex(p => p.id === targetId);
    if (targetIdx !== -1) {
      this.gameState.players[targetIdx] = reviveBySoulMend(this.gameState.players[targetIdx]!, REVIVE_HP);
      // No physics-body reposition needed here (unlike the proximity-revive block):
      // Soul Mend only ever targets isDown players, whose physics body never moves
      // while down (isSensor fixtures, velocity zeroed every tick), so it's already
      // sitting exactly at bodyX/bodyY — reviveBySoulMend's x/y snap is a no-op.

      this.broadcast(EventNames.DELTA, { type: 'player:revived' as const, playerId: targetId } satisfies DeltaEventMsg);
      this.broadcast(EventNames.DELTA, { type: 'player:hp-updated' as const, playerId: targetId, hp: REVIVE_HP } satisfies DeltaEventMsg);

      const revivedClient = this.clients.find(c => c.sessionId === targetId);
      if (revivedClient) {
        revivedClient.send(EventNames.SPIRIT_FORM, { type: 'spirit:form', isActive: false } satisfies SpiritFormMsg);
      }
    }

    const casterIdx = this.gameState.players.findIndex(p => p.id === casterId);
    const caster = casterIdx !== -1 ? this.gameState.players[casterIdx] : undefined;
    if (casterIdx !== -1 && caster) {
      this.gameState.players[casterIdx] = { ...caster, channelingAbility: null };
    }
    this.lastSoulMendInputAt.delete(casterId);
    this.broadcast(EventNames.DELTA, { type: 'cast:completed' as const, casterId } satisfies DeltaEventMsg);

    if (caster?.class) {
      const cooldowns = this.cooldownMap.get(casterId);
      if (cooldowns) {
        const cooldownMs = ABILITY_COOLDOWNS_MS[caster.class][abilityIndex as 0 | 1 | 2 | 3];
        const nowCd = Date.now();
        cooldowns[abilityIndex] = nowCd + cooldownMs;
        const casterClient = this.clients.find(c => c.sessionId === casterId);
        if (casterClient) {
          this.sendCooldownUpdate(casterClient, abilityIndex, nowCd, nowCd + cooldownMs);
        }
      }
    }
  }
}
