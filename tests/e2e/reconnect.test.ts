import { describe, it, beforeAll, afterAll, afterEach, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg } from 'net-protocol';
import { startTestServer, stopTestServer } from '../helpers/server.js';
import { waitForMessage, waitForDelta } from '../helpers/messages.js';
import { raceTimeout } from '../helpers/race-timeout.js';

// Use a distinct port so this file can run in parallel with full-run.test.ts
const PORT = 2569;
const TEST_URL = `ws://localhost:${PORT}`;

const GRACE_MS = 30_000; // RECONNECT_GRACE_S from shared-types/constants.ts

describe('reconnect flow', { timeout: 40_000 }, () => {
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
    // Cap each leave() at 3s — a room whose connection was manually closed
    // (this file's disconnect scenarios) can leave its leave() promise
    // unsettled forever, which would otherwise hang this hook past its
    // default 10s timeout.
    await Promise.allSettled(liveRooms.splice(0).map((r) => raceTimeout(r.leave(), 3_000, 'room.leave')));
  });

  it('player drops and rejoins within grace period — slot restored and snapshot received', async () => {
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const p1JoinedSnap = waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 5_000);
    const p1 = await client.joinById(host.roomId, { playerName: 'Dropper' });
    liveRooms.push(p1);
    await p1JoinedSnap;

    const token = p1.reconnectionToken;
    const disconnectP = waitForDelta<any>(host, (d) => d.type === 'player:disconnected', 3_000);
    p1.connection.close();
    await disconnectP; // player is now frozen in server state

    // Register predicate on host snapshot — resolves when player is unfrozen (= after reconnect).
    // Periodic snapshot fires every 5s; reconnect snapshot is unicast to p1Back so we use host instead.
    const unfrozenSnapP = new Promise<SnapshotMsg>((resolve, reject) => {
      const timer = setTimeout(() => { unsub(); reject(new Error('timeout: unfrozen snapshot not received within 8000ms')); }, 8_000);
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        const player = snap.state.players.find((p: any) => p.id === p1.sessionId);
        if (player && !player.isFrozen) { clearTimeout(timer); unsub(); resolve(snap); }
      });
    });

    const p1Back = await client.reconnect(token);
    liveRooms.push(p1Back);
    const snap = await unfrozenSnapP; // arrives within 5s (periodic snapshot interval)
    expect(snap.state.players.find((p: any) => p.id === p1.sessionId)?.isFrozen).toBe(false);
  });

  it('host receives player:disconnected delta immediately on drop', async () => {
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const p1JoinedSnap = waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 5_000);
    const p1 = await client.joinById(host.roomId, { playerName: 'Dropper' });
    liveRooms.push(p1);
    await p1JoinedSnap;

    // Register delta handler BEFORE dropping so we don't miss it
    const disconnectP = waitForDelta<any>(
      host,
      (d) => d.type === 'player:disconnected' && d.playerId === p1.sessionId,
      5_000
    );
    p1.connection.close();

    const delta = await disconnectP;
    expect(delta.type).toBe('player:disconnected');
    expect(delta.playerId).toBe(p1.sessionId);

    const token = p1.reconnectionToken;
    const p1Back = await client.reconnect(token);
    liveRooms.push(p1Back);
  });

  it('host receives player:reconnected delta on successful rejoin', async () => {
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const p1JoinedSnap = waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 5_000);
    const p1 = await client.joinById(host.roomId, { playerName: 'Rejoin' });
    liveRooms.push(p1);
    await p1JoinedSnap;

    const token = p1.reconnectionToken;
    const disconnectP = waitForDelta<any>(host, (d) => d.type === 'player:disconnected', 3_000);
    p1.connection.close();
    await disconnectP;

    const reconnectDeltaP = waitForDelta<any>(
      host,
      (d) => d.type === 'player:reconnected' && d.playerId === p1.sessionId,
      5_000
    );
    const p1Back = await client.reconnect(token);
    liveRooms.push(p1Back);
    const delta = await reconnectDeltaP;
    expect(delta.playerId).toBe(p1.sessionId);
  });

  // ponytail: 35s wait — exclude from short CI runs via: vitest run --exclude 'e2e/reconnect*'
  it('grace period expires — player:left broadcast, slot released from GameState', { timeout: 45_000 }, async () => {
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const p1JoinedSnap = waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 5_000);
    const p1 = await client.joinById(host.roomId, { playerName: 'Timeout' });
    liveRooms.push(p1);
    await p1JoinedSnap;

    // Register player:left listener BEFORE drop so we don't miss it after 30s
    const leftP = waitForDelta<any>(
      host,
      (d) => d.type === 'player:left' && d.playerId === p1.sessionId,
      GRACE_MS + 5_000
    );
    p1.connection.close();

    const leftDelta = await leftP;
    expect(leftDelta.playerId).toBe(p1.sessionId);

    // After grace expiry the slot is gone — confirmed by next periodic snapshot
    const snap = await waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 8_000);
    expect(snap.state.players.find((p: any) => p.id === p1.sessionId)).toBeUndefined();
  });

  // ponytail: 35s wait — exclude from short CI runs via: vitest run --exclude 'e2e/reconnect*'
  it('reconnect attempt after grace expiry throws — player can rejoin fresh', { timeout: 45_000 }, async () => {
    const host = await client.create('game_room', { isHost: true });
    liveRooms.push(host);
    const p1JoinedSnap = waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 5_000);
    const p1 = await client.joinById(host.roomId, { playerName: 'GraceExpired' });
    liveRooms.push(p1);
    await p1JoinedSnap;

    const token = p1.reconnectionToken;
    const leftP = waitForDelta<any>(host, (d) => d.type === 'player:left', GRACE_MS + 5_000);
    p1.connection.close();
    await leftP;

    // Reconnect with expired token should fail
    await expect(client.reconnect(token)).rejects.toThrow();

    // Fresh join succeeds as a new player slot.
    // After grace expiry players.length=0; join snapshot has length=1 — use predicate to avoid catching periodic empty snapshot.
    const freshJoinedSnap = new Promise<SnapshotMsg>((resolve, reject) => {
      const timer = setTimeout(() => { unsub(); reject(new Error('timeout: fresh join snapshot not received within 6000ms')); }, 6_000);
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length > 0) { clearTimeout(timer); unsub(); resolve(snap); }
      });
    });
    const p1Fresh = await client.joinById(host.roomId, { playerName: 'GraceExpiredFresh' });
    liveRooms.push(p1Fresh);
    const snap = await freshJoinedSnap;
    expect(p1Fresh.sessionId).not.toBe(p1.sessionId);
    expect(snap.state.players.find((p: any) => p.id === p1Fresh.sessionId)).toBeDefined();
  });
});
