import { describe, it, beforeAll, afterAll, afterEach, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import { PURIFICATION_PULSE_DURATION_MS, REWARD_REVEAL_DURATION_MS, PlayerClass } from 'shared-types';
import { ABILITY_GEOMETRY } from 'game-rules';
import { startTestServer, stopTestServer, TEST_URL } from '../helpers/server.js';
import { waitForDelta } from '../helpers/messages.js';
import { raceTimeout } from '../helpers/race-timeout.js';

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

// Must match GameRoom.ts's tick loop `SPEED` constant (pixels/second in virtual
// 1920x1080 space) — not exported, since it's private to the tick loop. Mirrors
// ability-dispatch.test.ts's helper of the same name (module-private there, so
// inlined here rather than imported — see Story 6.7 Task 4).
const PLAYER_SPEED_PX_S = 200;

// Live x/y for p1 and the boss, refreshed by 'player:moved'/'boss:moved' deltas —
// needed because the boss patrols/charges (tickBoss), so a single snapshot read
// goes stale. Mirrors ability-dispatch.test.ts's trackPositions, narrowed to the
// two ids this test's aim-and-move step needs.
function trackPlayerAndBossPositions(host: Room): { positions: Map<string, { x: number; y: number }>; stop: () => void } {
  const positions = new Map<string, { x: number; y: number }>();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const unsub = host.onMessage(EventNames.DELTA, (d: any) => {
    if (d.type === 'player:moved') positions.set(d.playerId, { x: d.x, y: d.y });
    if (d.type === 'boss:moved') positions.set(d.bossId, { x: d.x, y: d.y });
  });
  return { positions, stop: unsub };
}

// Single timed joystick burst covering most of the distance to (toX,toY), stopping
// `stopShortPx` short of it — same pattern as ability-dispatch.test.ts's helper.
async function moveTowardPoint(
  mover: Room,
  fromX: number, fromY: number,
  toX: number, toY: number,
  stopShortPx: number,
): Promise<void> {
  const dx = toX - fromX;
  const dy = toY - fromY;
  const dist = Math.hypot(dx, dy);
  const travelPx = Math.max(0, dist - stopShortPx);
  if (travelPx === 0) return;
  const mag = dist || 1;
  mover.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: dx / mag, y: dy / mag } } });
  await sleep((travelPx / PLAYER_SPEED_PX_S) * 1000);
  mover.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });
  await sleep(300); // let velocity settle to zero and the final player:moved delta arrive
}

// Short closed-loop fine-tune pass — same pattern as ability-dispatch.test.ts's helper.
async function fineTuneToDistanceBand(
  mover: Room,
  positions: Map<string, { x: number; y: number }>,
  selfId: string,
  targetId: string,
  minDist: number,
  maxDist: number,
  timeoutMs: number,
): Promise<void> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const self = positions.get(selfId);
    const target = positions.get(targetId);
    if (self && target) {
      const dx = target.x - self.x;
      const dy = target.y - self.y;
      const dist = Math.hypot(dx, dy);
      if (dist >= minDist && dist <= maxDist) {
        mover.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });
        await sleep(200);
        return;
      }
      const sign = dist > maxDist ? 1 : -1; // too far → approach, too close → retreat
      const mag = dist || 1; // guard exact-overlap (dist=0) from producing a NaN joystick vector
      mover.send(EventNames.INPUT, {
        type: 'input',
        event: { type: 'joystick', joystick: { x: sign * (dx / mag), y: sign * (dy / mag) } },
      });
    }
    await sleep(150);
  }
  throw new Error(`fineTuneToDistanceBand: never reached [${minDist},${maxDist}] from ${targetId} within ${timeoutMs}ms`);
}

describe('full run happy path', { timeout: 120_000 }, () => {
  let client: Colyseus.Client;
  // Describe-scoped: every room created by a test is pushed here and force-left
  // in afterEach, so a thrown assertion or a waitForDelta/raceTimeout timeout
  // can't leak a live room into the next test.
  const liveRooms: Room[] = [];

  beforeAll(async () => {
    await startTestServer();
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  afterEach(async () => {
    // Cap each leave() at 3s — a room whose connection is already dead (e.g. a
    // manually-closed socket) can leave its leave() promise unsettled forever,
    // which would otherwise hang this hook past its default 10s timeout.
    await Promise.allSettled(liveRooms.splice(0).map((r) => raceTimeout(r.leave(), 3_000, 'room.leave')));
  });

  it('session creation → 3 players → run vote → 3 levels → post-run → hub', async () => {
    // ── 1. Create session ─────────────────────────────────────────────────────
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const roomId = host.roomId;

    const allJoinedSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length >= 3) { unsub(); resolve(snap); }
      });
    });
    const p1 = await client.joinById(roomId, { playerName: 'Alice' });
    const p2 = await client.joinById(roomId, { playerName: 'Bob' });
    const p3 = await client.joinById(roomId, { playerName: 'Charlie' });
    liveRooms.push(p1, p2, p3);

    const initialSnap = await raceTimeout(allJoinedSnap, 10_000, 'all 3 players joined snapshot');
    expect(initialSnap.state.session.phase).toBe('lobby');
    expect(initialSnap.state.players.length).toBe(3);

    // ── 2. All select Stormcaller ─────────────────────────────────────────────
    const classUpdates = Promise.all([
      waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p1.sessionId),
      waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p2.sessionId),
      waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p3.sessionId),
    ]);
    p1.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    p2.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    p3.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    const [cu1, cu2, cu3] = await classUpdates;
    expect(cu1.class).toBe('stormcaller');
    expect(cu2.class).toBe('stormcaller');
    expect(cu3.class).toBe('stormcaller');

    // ── 3. Navigate p1 to dungeon entrance ────────────────────────────────────
    // p1 spawns at (960, 540); dungeon entrance at (960, 180, r=120); move north.
    const poiEntered = waitForDelta<any>(
      p1,
      (d) => d.type === 'player:poi-entered' && d.poiId === 'dungeon-entrance',
      8_000
    );
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: -1.0 } } });
    await poiEntered;
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });

    // ── 4. Propose run ────────────────────────────────────────────────────────
    const runProposed = waitForDelta<any>(host, (d) => d.type === 'run:proposed', 5_000);
    p1.send(EventNames.RUN_PROPOSE, { biome: 'grassland', difficulty: 'easy' });
    await runProposed;

    // ── 5. All vote accept → dungeon loaded ───────────────────────────────────
    const dungeonSnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.phase === 'dungeon') { unsub(); resolve(snap); }
      });
    });
    const runStarting = waitForDelta<any>(host, (d) => d.type === 'run:starting', 5_000);
    p1.send(EventNames.VOTE, { accept: true });
    p2.send(EventNames.VOTE, { accept: true });
    p3.send(EventNames.VOTE, { accept: true });
    await runStarting;
    const dungeonSnap = await raceTimeout(dungeonSnapP, 10_000, 'dungeon phase snapshot');
    expect(dungeonSnap.state.session.phase).toBe('dungeon');
    expect(dungeonSnap.state.session.levelIndex).toBe(1);

    // ── 6. Level 1 — Clear ────────────────────────────────────────────────────
    // bond:assigned arrives in the same synchronous tick as level:complete, so register
    // each bondAfterLX listener BEFORE the previous bond-moment CONTINUE so it's active
    // when that level eventually completes.
    const bondAfterL1 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 8_000);
    // ponytail: debug:kill-all is a server-side debug hook that kills all enemies instantly
    const l1Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 1, 5_000);
    host.send('debug:kill-all', {});
    const l1 = await l1Complete;
    expect(l1.levelIndex).toBe(1);

    // ── L1 bond-moment ────────────────────────────────────────────────────────
    // Register l2 listeners AND bondAfterL2 before sending CONTINUE.
    // bondAfterL2 must be registered BEFORE CONTINUE (not after l2Complete) because
    // bond:assigned fires in the same tick as level:complete and would be missed otherwise.
    const l2Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 2, 20_000);
    const wave2 = waitForDelta<any>(host, (d) => d.type === 'wave:started' && d.waveIndex === 2, 12_000);
    const wave3 = waitForDelta<any>(host, (d) => d.type === 'wave:started' && d.waveIndex === 3, 12_000);
    const l2StartSnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.levelIndex === 2) { unsub(); resolve(snap); }
      });
    });
    const l1Bond = await bondAfterL1;
    expect(l1Bond.playerA).toBeDefined();
    // Register bondAfterL2 AFTER bondAfterL1 unsubscribes (to avoid double-resolve on same event)
    // but BEFORE CONTINUE (so it's active long before level 2 ever completes)
    const bondAfterL2 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 8_000);
    p1.send(EventNames.CONTINUE, {});
    const l2StartSnap = await raceTimeout(l2StartSnapP, 8_000, 'level 2 snapshot after l1 CONTINUE');
    expect(l2StartSnap.state.session.levelIndex).toBe(2);
    expect(l2StartSnap.state.activeBonds.length).toBe(1);

    // ── 7. Level 2 — Survive Waves (3 waves, WAVE_PAUSE_MS=2500ms each) ───────
    host.send('debug:kill-all', {}); // kill wave 1
    await wave2;
    host.send('debug:kill-all', {}); // kill wave 2
    await wave3;
    host.send('debug:kill-all', {}); // kill wave 3
    // bondAfterL2 is already registered; level 2's bond:assigned arrives same tick as l2Complete
    await l2Complete;

    // ── L2 bond-moment ────────────────────────────────────────────────────────
    const l3Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 3, 10_000);
    const l3StartSnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.levelIndex === 3) { unsub(); resolve(snap); }
      });
    });
    const l2Bond = await bondAfterL2;
    expect(l2Bond.playerA).toBeDefined();
    // Register bondAfterL3 AFTER bondAfterL2 unsubscribes, BEFORE CONTINUE
    const bondAfterL3 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 8_000);
    p1.send(EventNames.CONTINUE, {});
    const l3StartSnap = await raceTimeout(l3StartSnapP, 8_000, 'level 3 snapshot after l2 CONTINUE');
    expect(l3StartSnap.state.session.levelIndex).toBe(3);
    expect(l3StartSnap.state.activeBonds.length).toBe(2);

    // ── 8. Level 3 — Clear (late tier enemies) ────────────────────────────────
    const l4StartSnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.levelIndex === 4) { unsub(); resolve(snap); }
      });
    });
    // bondAfterL3 already registered; level 3's bond:assigned arrives same tick as l3Complete
    host.send('debug:kill-all', {});
    await l3Complete;

    // ── L3 bond-moment ────────────────────────────────────────────────────────
    const l3Bond = await bondAfterL3;
    expect(l3Bond.playerA).toBeDefined();
    p1.send(EventNames.CONTINUE, {});
    const l4StartSnap = await raceTimeout(l4StartSnapP, 8_000, 'level 4 snapshot after l3 CONTINUE');
    expect(l4StartSnap.state.session.levelIndex).toBe(4);
    expect(l4StartSnap.state.activeBonds.length).toBe(3);

    // ── 9. Level 4 — Boss defeat via debug endpoint ───────────────────────────
    // run:complete arrives after PURIFICATION_PULSE_DURATION_MS + REWARD_REVEAL_DURATION_MS (5500ms)
    const runComplete = waitForDelta<any>(host, (d) => d.type === 'run:complete', 12_000);
    host.send('debug:kill-boss', {});
    const runCompleteData = await runComplete;
    expect(typeof runCompleteData.totalEssence).toBe('number');

    // ── 10. Post-run: wait for periodic snapshot (within 5s) ─────────────────
    const postRunSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.phase === 'post-run') { unsub(); resolve(snap); }
      });
    });
    const pr = await raceTimeout(postRunSnap, 8_000, 'post-run phase snapshot');
    expect(pr.state.session.phase).toBe('post-run');

    // ── 11. Return to Camp ────────────────────────────────────────────────────
    const hubSnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.phase === 'hub') { unsub(); resolve(snap); }
      });
    });
    p1.send(EventNames.RETURN_TO_CAMP, {});
    p2.send(EventNames.RETURN_TO_CAMP, {});
    p3.send(EventNames.RETURN_TO_CAMP, {});
    const hubSnap = await raceTimeout(hubSnapP, 10_000, 'hub phase snapshot');
    expect(hubSnap.state.session.phase).toBe('hub');
    expect(hubSnap.state.enemies.length).toBe(0);
    expect(hubSnap.state.players.every((p: any) => !p.isDown && !p.isSpirit)).toBe(true);
  });

  // ponytail: boss defeat e2e is partial — verifies delta timing, not full AI simulation
  it('boss defeat path: BossDefeatedDelta then run:complete after delay', async () => {
    // ── Bring game to boss level (same setup as main test through L3 bond-moment) ─
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const roomId = host.roomId;

    const allJoinedSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length >= 2) { unsub(); resolve(snap); }
      });
    });
    const p1 = await client.joinById(roomId, { playerName: 'Alice' });
    const p2 = await client.joinById(roomId, { playerName: 'Bob' });
    liveRooms.push(p1, p2);
    await raceTimeout(allJoinedSnap, 10_000, 'players joined');

    p1.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    p2.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });

    const poiEntered = waitForDelta<any>(p1, (d) => d.type === 'player:poi-entered' && d.poiId === 'dungeon-entrance', 8_000);
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: -1.0 } } });
    await poiEntered;
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });

    p1.send(EventNames.RUN_PROPOSE, { biome: 'grassland', difficulty: 'easy' });
    await waitForDelta<any>(host, (d) => d.type === 'run:proposed', 5_000);

    const dungeonSnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.phase === 'dungeon') { unsub(); resolve(snap); }
      });
    });
    p1.send(EventNames.VOTE, { accept: true });
    p2.send(EventNames.VOTE, { accept: true });
    await waitForDelta<any>(host, (d) => d.type === 'run:starting', 5_000);
    await raceTimeout(dungeonSnapP, 10_000, 'dungeon phase');

    // L1 clear → bond → L2 waves → bond → L3 clear → bond → boss level
    const bondAfterL1 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 8_000);
    const l1Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 1, 8_000);
    host.send('debug:kill-all', {});
    await l1Complete;
    await bondAfterL1;

    const bondAfterL2 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 10_000);
    const wave2 = waitForDelta<any>(host, (d) => d.type === 'wave:started' && d.waveIndex === 2, 12_000);
    const wave3 = waitForDelta<any>(host, (d) => d.type === 'wave:started' && d.waveIndex === 3, 12_000);
    const l2Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 2, 20_000);
    p1.send(EventNames.CONTINUE, {});
    host.send('debug:kill-all', {});
    await wave2;
    host.send('debug:kill-all', {});
    await wave3;
    host.send('debug:kill-all', {});
    await l2Complete;
    await bondAfterL2;

    const bondAfterL3 = waitForDelta<any>(host, (d) => d.type === 'bond:assigned', 8_000);
    const l3Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 3, 10_000);
    const l4SnapP = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.session.levelIndex === 4) { unsub(); resolve(snap); }
      });
    });
    p1.send(EventNames.CONTINUE, {});
    host.send('debug:kill-all', {});
    await l3Complete;
    await bondAfterL3;
    p1.send(EventNames.CONTINUE, {});
    const l4Snap = await raceTimeout(l4SnapP, 8_000, 'boss level loaded');

    // ── Boss level assertions ─────────────────────────────────────────────────
    expect(l4Snap.state.boss).not.toBeNull();
    expect(l4Snap.state.session.levelIndex).toBe(4);

    // ── Story 6.7 (AC1+AC2): real ability damage actually reduces boss.hp ─────
    // Move p1 into Stormcaller ability 0's (Lightning Arc) hit-scan range of the
    // boss and cast it, then assert a real boss:damaged delta arrives — proving
    // the hit-resolution loops now check gameState.boss, not just gameState.enemies.
    const boss = l4Snap.state.boss!;
    const p1Start = l4Snap.state.players.find((p: any) => p.id === p1.sessionId)!;
    const { positions, stop } = trackPlayerAndBossPositions(host);
    positions.set(p1.sessionId, p1Start);
    positions.set(boss.id, boss.position);

    const hitRange = ABILITY_GEOMETRY[PlayerClass.STORMCALLER][0].hitRangePx; // 160
    const hitRadius = ABILITY_GEOMETRY[PlayerClass.STORMCALLER][0].hitRadiusPx; // 60
    const band = hitRadius - 10; // safety margin inside the true hit-radius tolerance

    await moveTowardPoint(p1, p1Start.x, p1Start.y, boss.position.x, boss.position.y, hitRange);
    await fineTuneToDistanceBand(p1, positions, p1.sessionId, boss.id, Math.max(0, hitRange - band), hitRange + band, 8_000);

    const p1Pos = positions.get(p1.sessionId)!;
    const bossPos = positions.get(boss.id)!;
    const dirX = bossPos.x - p1Pos.x;
    const dirY = bossPos.y - p1Pos.y;

    const bossDamagedP = waitForDelta<any>(host, (d) => d.type === 'boss:damaged', 5_000);
    p1.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 0, directionX: dirX, directionY: dirY } },
    });
    const bossDamaged = await bossDamagedP;
    expect(bossDamaged.newHp).toBeLessThan(boss.maxHp);
    stop();

    // ── Defeat boss via debug endpoint ────────────────────────────────────────
    const defeatDeltaP = waitForDelta<any>(host, (d) => d.type === 'boss:defeated', 4_000);
    host.send('debug:kill-boss', {});
    const defeatDelta = await defeatDeltaP;
    expect(defeatDelta.type).toBe('boss:defeated');
    expect(typeof defeatDelta.reward?.essenceTotal).toBe('number');
    const t0 = Date.now();

    // ── run:complete arrives after full purification delay ────────────────────
    const expectedDelay = PURIFICATION_PULSE_DURATION_MS + REWARD_REVEAL_DURATION_MS;
    const completeDelta = await raceTimeout(
      waitForDelta<any>(host, (d) => d.type === 'run:complete', expectedDelay + 1000),
      expectedDelay + 1500,
      'run:complete after boss defeat delay',
    );
    const elapsed = Date.now() - t0;
    expect(completeDelta.type).toBe('run:complete');
    // ponytail: WSL2 event-loop jitter can absorb ~600ms before client records t0
    expect(elapsed).toBeGreaterThanOrEqual(expectedDelay - 800);
    expect(elapsed).toBeLessThanOrEqual(expectedDelay + 1000);

    // ── Phase transitions to post-run ─────────────────────────────────────────
    const postRunSnap = await raceTimeout(
      new Promise<SnapshotMsg>((resolve) => {
        const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
          if (snap.state.session.phase === 'post-run') { unsub(); resolve(snap); }
        });
      }),
      8_000,
      'post-run phase after boss defeat',
    );
    expect(postRunSnap.state.session.phase).toBe('post-run');
  });
});
