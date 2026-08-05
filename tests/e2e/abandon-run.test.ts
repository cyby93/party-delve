import { describe, it, beforeAll, afterAll, afterEach, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg } from 'net-protocol';
import { startTestServer, stopTestServer } from '../helpers/server.js';
import { waitForDelta } from '../helpers/messages.js';
import { raceTimeout } from '../helpers/race-timeout.js';

// Distinct port so this file can run in parallel with the other e2e suites.
const PORT = 2570;
const TEST_URL = `ws://localhost:${PORT}`;

async function waitForSnapshotWhere(
  room: Room,
  predicate: (snap: SnapshotMsg) => boolean,
  timeoutMs = 8_000
): Promise<SnapshotMsg> {
  const p = new Promise<SnapshotMsg>((resolve) => {
    const unsub = room.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
      if (predicate(snap)) { unsub(); resolve(snap); }
    });
  });
  return raceTimeout(p, timeoutMs, 'matching snapshot');
}

describe('abandon-run resolution', { timeout: 120_000 }, () => {
  let client: Colyseus.Client;
  // Describe-scoped: every room created by a test is pushed here and force-left
  // in afterEach, so a thrown assertion or a wait timeout can't leak a live
  // room/subscription into the next test.
  const liveRooms: Room[] = [];

  beforeAll(async () => {
    await startTestServer(PORT);
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  afterEach(async () => {
    // Cap each leave() at 3s — a room whose connection is already dead (e.g. a
    // manually-closed socket) can leave its leave() promise unsettled forever,
    // which would otherwise hang this hook past its default 10s timeout.
    await Promise.allSettled(liveRooms.splice(0).map((r) => raceTimeout(r.leave(), 3_000, 'room.leave')));
  });

  // Copies full-run.test.ts:118-175's setup shape — host + three joinById players,
  // CLASS_SELECT for all three, drive p1 into dungeon-entrance, RUN_PROPOSE, three
  // VOTE accepts, await the phase === 'dungeon' snapshot.
  async function setupDungeonRun(): Promise<{ host: Room; p1: Room; p2: Room; p3: Room }> {
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
    await raceTimeout(allJoinedSnap, 10_000, 'all 3 players joined snapshot');

    const classUpdates = Promise.all([
      waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p1.sessionId),
      waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p2.sessionId),
      waitForDelta<any>(host, (d) => d.type === 'player:class-updated' && d.playerId === p3.sessionId),
    ]);
    p1.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    p2.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    p3.send(EventNames.CLASS_SELECT, { classId: 'stormcaller' });
    await classUpdates;

    const poiEntered = waitForDelta<any>(
      p1,
      (d) => d.type === 'player:poi-entered' && d.poiId === 'dungeon-entrance',
      8_000
    );
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: -1.0 } } });
    await poiEntered;
    p1.send(EventNames.INPUT, { type: 'input', event: { type: 'joystick', joystick: { x: 0, y: 0 } } });

    const runProposed = waitForDelta<any>(host, (d) => d.type === 'run:proposed', 5_000);
    p1.send(EventNames.RUN_PROPOSE, { biome: 'grassland', difficulty: 'easy' });
    await runProposed;

    const dungeonSnapP = waitForSnapshotWhere(host, (snap) => snap.state.session.phase === 'dungeon', 10_000);
    const runStarting = waitForDelta<any>(host, (d) => d.type === 'run:starting', 5_000);
    p1.send(EventNames.VOTE, { accept: true });
    p2.send(EventNames.VOTE, { accept: true });
    p3.send(EventNames.VOTE, { accept: true });
    await runStarting;
    await dungeonSnapP;

    return { host, p1, p2, p3 };
  }

  // Reaches the boss level (levelIndex 4) the way full-run.test.ts does: clear/wave
  // levels 1-3 via debug:kill-all, and drive each bond-moment CONTINUE with p1.
  async function reachBossLevel(host: Room, p1: Room): Promise<SnapshotMsg> {
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
    const l4SnapP = waitForSnapshotWhere(host, (snap) => snap.state.session.levelIndex === 4, 8_000);
    p1.send(EventNames.CONTINUE, {});
    host.send('debug:kill-all', {});
    await l3Complete;
    await bondAfterL3;
    p1.send(EventNames.CONTINUE, {});
    return l4SnapP;
  }

  it('unanimous accept → hub', async () => {
    const { host, p1, p2, p3 } = await setupDungeonRun();

    const abandoned = waitForDelta<any>(host, (d) => d.type === 'run:abandoned', 5_000);
    const hubSnapP = waitForSnapshotWhere(host, (snap) => snap.state.session.phase === 'hub', 8_000);

    // Propose has no delta of its own — wait for the pending snapshot before p2/p3
    // vote so their votes can't race ahead of the server registering the proposal
    // (p1's own vote is safe to send immediately: same connection, so ordered).
    const pendingSnapP = waitForSnapshotWhere(
      host,
      (snap) => snap.state.abandonProposal?.proposedBy === p1.sessionId,
      5_000
    );
    p1.send(EventNames.RUN_ABANDON_PROPOSE, {});
    p1.send(EventNames.RUN_ABANDON_VOTE, { accept: true });
    await pendingSnapP;
    p2.send(EventNames.RUN_ABANDON_VOTE, { accept: true });
    p3.send(EventNames.RUN_ABANDON_VOTE, { accept: true });

    await abandoned;
    const hubSnap = await hubSnapP;

    expect(hubSnap.state.session.phase).toBe('hub');
    expect(hubSnap.state.session.levelIndex).toBe(0);
    expect(hubSnap.state.enemies.length).toBe(0);
    expect(hubSnap.state.activeBonds.length).toBe(0);
    expect(hubSnap.state.boss).toBeNull();
    expect(hubSnap.state.abandonProposal).toBeNull();
    expect(hubSnap.state.players.every((p: any) => p.hp === p.maxHp && !p.isDown)).toBe(true);
  });

  it('single decline cancels', async () => {
    const { host, p1, p2, p3 } = await setupDungeonRun();

    // Confirm the proposal actually landed before racing to watch it disappear —
    // otherwise a spurious pre-proposal snapshot (abandonProposal already null)
    // could satisfy the "cancelled" predicate before the propose is even sent.
    const pendingSnapP = waitForSnapshotWhere(
      host,
      (snap) => snap.state.abandonProposal?.proposedBy === p1.sessionId,
      5_000
    );
    p1.send(EventNames.RUN_ABANDON_PROPOSE, {});
    await pendingSnapP;

    const cancelledSnapP = waitForSnapshotWhere(host, (snap) => snap.state.abandonProposal === null, 5_000);
    p2.send(EventNames.RUN_ABANDON_VOTE, { accept: true });
    p3.send(EventNames.RUN_ABANDON_VOTE, { accept: false });

    const cancelledSnap = await cancelledSnapP;
    expect(cancelledSnap.state.abandonProposal).toBeNull();
    expect(cancelledSnap.state.session.phase).toBe('dungeon');

    // A stale accept from p2 after the proposal is gone must not resolve anything.
    // resolveAbandonVoteIfComplete's first guard (abandonProposal === null) makes this
    // a total no-op — assert directly that it doesn't fire a run:abandoned delta,
    // rather than racing an arbitrary "next snapshot" against the 5s periodic cadence.
    const spuriousAbandon = waitForDelta<any>(host, (d) => d.type === 'run:abandoned', 1_500);
    p2.send(EventNames.RUN_ABANDON_VOTE, { accept: true });
    await expect(spuriousAbandon).rejects.toThrow();
  });

  it('disconnect during vote cancels', async () => {
    const { host, p1, p2, p3 } = await setupDungeonRun();

    const pendingSnapP = waitForSnapshotWhere(
      host,
      (snap) => snap.state.abandonProposal?.proposedBy === p1.sessionId,
      5_000
    );
    p1.send(EventNames.RUN_ABANDON_PROPOSE, {});
    await pendingSnapP;
    p2.send(EventNames.RUN_ABANDON_VOTE, { accept: true });

    // Register both listeners before the drop — same discipline as reconnect.test.ts.
    const disconnectedP = waitForDelta<any>(host, (d) => d.type === 'player:disconnected' && d.playerId === p3.sessionId, 5_000);
    const cancelledSnapP = waitForSnapshotWhere(host, (snap) => snap.state.abandonProposal === null, 5_000);
    p3.connection.close();
    await disconnectedP;

    const snap = await cancelledSnapP;
    expect(snap.state.abandonProposal).toBeNull();
    expect(snap.state.session.phase).toBe('dungeon');
  });

  it('no boss gate — proposal during boss level is accepted', { timeout: 60_000 }, async () => {
    const { host, p1, p2, p3 } = await setupDungeonRun();

    const l4Snap = await reachBossLevel(host, p1);
    expect(l4Snap.state.boss).not.toBeNull();
    expect(l4Snap.state.session.levelIndex).toBe(4);

    const abandoned = waitForDelta<any>(host, (d) => d.type === 'run:abandoned', 5_000);
    const hubSnapP = waitForSnapshotWhere(host, (snap) => snap.state.session.phase === 'hub', 8_000);

    const pendingSnapP = waitForSnapshotWhere(
      host,
      (snap) => snap.state.abandonProposal?.proposedBy === p1.sessionId,
      5_000
    );
    p1.send(EventNames.RUN_ABANDON_PROPOSE, {});
    p1.send(EventNames.RUN_ABANDON_VOTE, { accept: true });
    await pendingSnapP;
    p2.send(EventNames.RUN_ABANDON_VOTE, { accept: true });
    p3.send(EventNames.RUN_ABANDON_VOTE, { accept: true });

    await abandoned;
    const hubSnap = await hubSnapP;

    expect(hubSnap.state.session.phase).toBe('hub');
    expect(hubSnap.state.boss).toBeNull();
    expect(hubSnap.state.abandonProposal).toBeNull();
  });

  // Regression guard for the code-review finding: a boss-defeat phase transition
  // ('dungeon' → 'post-run') must not leave a pending abandonProposal stuck forever
  // (every abandon handler gates on phase === 'dungeon', so nothing could otherwise
  // clear it until the next resetToHub()).
  it('boss defeat cancels a pending abandon proposal', { timeout: 60_000 }, async () => {
    const { host, p1 } = await setupDungeonRun();

    const l4Snap = await reachBossLevel(host, p1);
    expect(l4Snap.state.boss).not.toBeNull();

    const pendingSnapP = waitForSnapshotWhere(
      host,
      (snap) => snap.state.abandonProposal?.proposedBy === p1.sessionId,
      5_000
    );
    p1.send(EventNames.RUN_ABANDON_PROPOSE, {});
    await pendingSnapP;

    const postRunSnapP = waitForSnapshotWhere(host, (snap) => snap.state.session.phase === 'post-run', 12_000);
    host.send('debug:kill-boss', {});
    const postRunSnap = await postRunSnapP;

    expect(postRunSnap.state.session.phase).toBe('post-run');
    expect(postRunSnap.state.abandonProposal).toBeNull();
  });
});
