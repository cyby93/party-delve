import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import { startTestServer, stopTestServer, TEST_URL } from '../helpers/server.js';
import { waitForDelta } from '../helpers/messages.js';

const raceTimeout = <T>(p: Promise<T>, ms: number, label: string): Promise<T> =>
  Promise.race([p, new Promise<T>((_, reject) =>
    setTimeout(() => reject(new Error(`timeout after ${ms}ms: ${label}`)), ms)
  )]);

describe('full run happy path', { timeout: 120_000 }, () => {
  let client: Colyseus.Client;

  beforeAll(async () => {
    await startTestServer();
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  it('session creation → 3 players → run vote → 3 levels → post-run → hub', async () => {
    // ── 1. Create session ─────────────────────────────────────────────────────
    const host = await client.create('game_room', { isHost: true });
    const roomId = host.roomId;

    const allJoinedSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length >= 3) { unsub(); resolve(snap); }
      });
    });
    const p1 = await client.joinById(roomId, { playerName: 'Alice' });
    const p2 = await client.joinById(roomId, { playerName: 'Bob' });
    const p3 = await client.joinById(roomId, { playerName: 'Charlie' });

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

    // ── 9. Level 4 — Boss placeholder: move east to victory trigger ───────────
    // Players respawn at DUNGEON_SPAWN_POSITIONS[0] = (300, 540).
    // Victory trigger at (1700, 540, r=120). Distance ~1400px at 200px/s = ~7s.
    const runComplete = waitForDelta<any>(host, (d) => d.type === 'run:complete', 15_000);
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 1.0, y: 0 } } });
    const runCompleteData = await runComplete;
    expect(typeof runCompleteData.totalEssence).toBe('number');
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });

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

    await Promise.all([host.leave(), p1.leave(), p2.leave(), p3.leave()]);
  });
});
