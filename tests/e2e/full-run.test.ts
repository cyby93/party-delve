import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg } from 'net-protocol';
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
    // ponytail: debug:kill-all is a server-side debug hook that kills all enemies instantly
    const l1Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 1, 5_000);
    host.send('debug:kill-all', {});
    const l1 = await l1Complete;
    expect(l1.levelIndex).toBe(1);

    // ── 7. Level 2 — Survive Waves (3 waves, WAVE_PAUSE_MS=2500ms each) ───────
    // Wave 1 is spawned synchronously inside loadLevel(2). Register all wave listeners
    // and l2Complete BEFORE sending kill commands to avoid any race.
    const l2Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 2, 15_000);
    const wave2 = waitForDelta<any>(host, (d) => d.type === 'wave:started' && d.waveIndex === 2, 8_000);
    const wave3 = waitForDelta<any>(host, (d) => d.type === 'wave:started' && d.waveIndex === 3, 8_000);
    host.send('debug:kill-all', {}); // kill wave 1
    await wave2;
    host.send('debug:kill-all', {}); // kill wave 2
    await wave3;
    host.send('debug:kill-all', {}); // kill wave 3
    await l2Complete;

    // ── 8. Level 3 — Clear (late tier enemies) ────────────────────────────────
    const l3Complete = waitForDelta<any>(host, (d) => d.type === 'level:complete' && d.levelIndex === 3, 5_000);
    host.send('debug:kill-all', {});
    await l3Complete;

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
