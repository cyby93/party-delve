import { Room, Client, CloseCode } from 'colyseus';
import type { GameState, PlayerState } from 'shared-types';
import { TICK_RATE_HZ, RECONNECT_GRACE_S, SNAPSHOT_INTERVAL_S, MAX_PLAYERS, PlayerClass, SessionColor, INTERACTIVE_HUB_POIS } from 'shared-types';
import { EventNames } from 'net-protocol';
import type { InputEventMsg, SnapshotMsg, DeltaEventMsg, CooldownUpdateMsg, SpiritFormMsg } from 'net-protocol';
import { randomInt } from 'node:crypto';
import { Vec2, Body, Contact } from 'planck';
import type { World } from 'planck';
import {
  createPhysicsWorld, createPlayerBody, createPoiSensorBody, createEssenceSensorBody,
  extractPoiBeginContact, extractPoiEndContact, extractEssenceBeginContact, toMeters, toPixels,
} from '../physics/world.js';
import type { PoiBeginContactEvent, PoiEndContactEvent, EssenceBeginContactEvent } from '../physics/world.js';
import { createRng, tickEnemy, dispatchAbility, getEnemyCount, applyDamage, isInHitZone, ABILITY_HIT_RANGE_PX, ABILITY_HIT_RADIUS_PX, applyPlayerDamage, ENEMY_MELEE_DAMAGE, ENEMY_MELEE_RANGE_PX, ENEMY_ATTACK_COOLDOWN_MS, REVIVE_RADIUS_PX, REVIVE_HP } from 'game-rules';
import type { BehaviorLayer, EnemyContext, EnemyAIEvent } from 'game-rules';
import { CLASS_DEFINITIONS } from 'shared-types';
import type { EnemyState } from 'shared-types';
import { EnemyType, DifficultyTier, EnemyFSMState, OFFSET_ENEMY_SPAWN } from 'shared-types';
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
      this.gameState.session.phase = 'dungeon';
      this.gameState.session.levelIndex = 1;
      for (const p of this.gameState.players) p.nearPoiId = null;
      this.spawnEnemies();
      const snapshot: SnapshotMsg = { type: 'snapshot', state: this.gameState };
      this.broadcast(EventNames.SNAPSHOT, snapshot);
      logger.info({ roomId: this.roomId }, 'dungeon phase started');
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
      this.lastKnownJoystick.delete(client.sessionId);
      const expireBody = this.playerBodies.get(client.sessionId);
      if (expireBody) {
        this.physicsWorld.destroyBody(expireBody);
        this.playerBodies.delete(client.sessionId);
      }
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
    for (const body of this.essenceSensorBodies.values()) {
      this.physicsWorld.destroyBody(body);
    }
    this.essenceSensorBodies.clear();
    this.pendingPoiBeginContacts.length = 0;
    this.pendingPoiEndContacts.length = 0;
    this.pendingEssenceBeginContacts.length = 0;
    logger.info({ roomId: this.roomId }, 'GameRoom disposed');
  }

  private spawnEnemies(): void {
    const count = getEnemyCount(this.gameState.players.length, 'early');
    const enemyPrng = createRng(this.gameState.session.runSeed ^ OFFSET_ENEMY_SPAWN);
    for (let i = 0; i < count; i++) {
      const id = `enemy-${i}`;
      const x = 200 + enemyPrng() * 1520;
      const y = 200 + enemyPrng() * 680;
      const enemy: EnemyState = {
        id,
        type: EnemyType.GRUNT,
        x,
        y,
        hp: 60,
        maxHp: 60,
        difficultyTier: DifficultyTier.EASY,
        isAlive: true,
        fsmState: EnemyFSMState.IDLE,
        attackCooldownTicks: 0,
      };
      this.gameState.enemies.push(enemy);
      const body = createEnemyBody(this.physicsWorld, id, x, y);
      this.enemyBodies.set(id, body);
      this.enemyAttackCooldowns.set(id, 0);
    }
    logger.info({ roomId: this.roomId, count }, 'enemies spawned');
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

      if (player.isFrozen) {
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
