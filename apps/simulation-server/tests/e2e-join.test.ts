/**
 * E2E smoke test for the join-room happy path.
 *
 * Strategy: start createWsServer in-process on a high port, then drive it
 * with real ws WebSocket clients.  No Playwright, no subprocesses.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { SessionStore } from '../src/session-store.js';
import { createWsServer } from '../src/server.js';
import type { WsServerWithTick } from '../src/server.js';

const TEST_PORT = 18765;

// ---------------------------------------------------------------------------
// Client helper
// ---------------------------------------------------------------------------

interface TestClient {
  /** Send any object as a JSON WS message. */
  send(obj: unknown): void;
  /**
   * Returns the next JSON message from the server.  If one is already
   * buffered (arrived before this call) it is returned immediately;
   * otherwise the promise resolves when the next message arrives.
   */
  nextMessage(): Promise<unknown>;
  /** Close the underlying WebSocket. */
  close(): void;
}

/**
 * Consume messages from `client` until one whose `t` field matches `type`.
 * Discards any interleaved messages (e.g. PlayerStateSnapshot tick broadcasts).
 */
async function findMessage(client: TestClient, type: string): Promise<unknown> {
  for (;;) {
    const msg = await client.nextMessage() as { t: string };
    if (msg.t === type) return msg;
  }
}

function makeClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);

    // Messages that arrived before nextMessage() was called
    const buffer: unknown[] = [];
    // Resolvers waiting for the next message
    const waiters: Array<(msg: unknown) => void> = [];

    ws.on('message', (data) => {
      const msg: unknown = JSON.parse(data.toString());
      if (waiters.length > 0) {
        // Wake the oldest waiter immediately
        waiters.shift()!(msg);
      } else {
        buffer.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        send(obj) {
          ws.send(JSON.stringify(obj));
        },
        nextMessage() {
          if (buffer.length > 0) {
            return Promise.resolve(buffer.shift()!);
          }
          return new Promise<unknown>((res) => waiters.push(res));
        },
        close() {
          ws.close();
        },
      });
    });

    ws.on('error', reject);
  });
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('e2e join-room happy path', () => {
  let wss: WsServerWithTick;

  beforeAll(() => {
    const store = new SessionStore();
    wss = createWsServer(TEST_PORT, store);
    // Wait until the socket is truly listening before running tests
    return new Promise<void>((resolve) => wss.on('listening', resolve));
  });

  afterAll(() => {
    return new Promise<void>((resolve) => wss.close(() => resolve()));
  });

  // -------------------------------------------------------------------------
  // Test 1: host join → session-start with 4-char roomCode
  // -------------------------------------------------------------------------
  it('host join → receives SessionStateEvent session-start with 4-char roomCode', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });

    const msg = await host.nextMessage() as { v: number; t: string; p: Record<string, unknown> };

    expect(msg.v).toBe(1);
    expect(msg.t).toBe('SessionStateEvent');
    expect(msg.p.event).toBe('session-start');
    expect(typeof msg.p.sessionId).toBe('string');
    expect(typeof msg.p.roomCode).toBe('string');
    expect((msg.p.roomCode as string).length).toBe(4);
    expect(typeof msg.p.tick).toBe('number');

    host.close();
  });

  // -------------------------------------------------------------------------
  // Test 2: player joins valid roomCode → both host and player receive
  //         player-joined
  // -------------------------------------------------------------------------
  it('player join valid roomCode → both host and player receive player-joined', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });

    const sessionStart = await host.nextMessage() as {
      t: string;
      p: { roomCode: string };
    };
    const roomCode = sessionStart.p.roomCode;

    const player = await makeClient(TEST_PORT);
    player.send({ v: 1, t: 'join', p: { role: 'player', roomCode } });

    const [hostMsg, playerMsg] = await Promise.all([
      findMessage(host, 'SessionStateEvent') as Promise<{ t: string; p: Record<string, unknown> }>,
      findMessage(player, 'SessionStateEvent') as Promise<{ t: string; p: Record<string, unknown> }>,
    ]);

    for (const msg of [hostMsg, playerMsg]) {
      expect(msg.t).toBe('SessionStateEvent');
      expect(msg.p.event).toBe('player-joined');
      expect(typeof msg.p.affectedPlayerId).toBe('string');
      expect(typeof msg.p.reconnectToken).toBe('string');
      expect(typeof msg.p.tick).toBe('number');
    }

    // Both sides see the same player id and reconnect token
    expect(hostMsg.p.affectedPlayerId).toBe(playerMsg.p.affectedPlayerId);
    expect(hostMsg.p.reconnectToken).toBe(playerMsg.p.reconnectToken);

    host.close();
    player.close();
  });

  // -------------------------------------------------------------------------
  // Test 3: player disconnect → host receives player-left
  // -------------------------------------------------------------------------
  it('player disconnect → host receives SessionStateEvent player-left', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });

    const sessionStart = await host.nextMessage() as {
      t: string;
      p: { roomCode: string };
    };
    const roomCode = sessionStart.p.roomCode;

    const player = await makeClient(TEST_PORT);
    player.send({ v: 1, t: 'join', p: { role: 'player', roomCode } });

    // Consume player-joined on both sides (discard any snapshot messages)
    const joinedOnHost = await findMessage(host, 'SessionStateEvent') as { p: { affectedPlayerId: string } };
    await findMessage(player, 'SessionStateEvent'); // player's own join ack

    const leavingPlayerId = joinedOnHost.p.affectedPlayerId;

    // Close the player socket; give the TCP close event a moment to propagate
    player.close();
    await new Promise<void>((r) => setTimeout(r, 50));

    // Drain any PlayerStateSnapshot messages that arrived during the wait
    const leftMsg = await findMessage(host, 'SessionStateEvent') as {
      t: string;
      p: { event: string; affectedPlayerId: string };
    };

    expect(leftMsg.t).toBe('SessionStateEvent');
    expect(leftMsg.p.event).toBe('player-left');
    expect(leftMsg.p.affectedPlayerId).toBe(leavingPlayerId);

    host.close();
  });

  // -------------------------------------------------------------------------
  // Test 4: invalid room code → ROOM_NOT_FOUND error
  // -------------------------------------------------------------------------
  it('player join invalid roomCode → receives error ROOM_NOT_FOUND', async () => {
    const player = await makeClient(TEST_PORT);
    player.send({ v: 1, t: 'join', p: { role: 'player', roomCode: 'ZZZZ' } });

    const msg = await player.nextMessage() as { t: string; p: { code: string } };

    expect(msg.t).toBe('error');
    expect(msg.p.code).toBe('ROOM_NOT_FOUND');

    player.close();
  });

  // -------------------------------------------------------------------------
  // Test 5: two players join → distinct affectedPlayerIds, second slot fills
  // -------------------------------------------------------------------------
  it('two players join → both appear with distinct affectedPlayerIds', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });

    const sessionStart = await host.nextMessage() as {
      t: string;
      p: { roomCode: string };
    };
    const roomCode = sessionStart.p.roomCode;

    // First player
    const p1 = await makeClient(TEST_PORT);
    p1.send({ v: 1, t: 'join', p: { role: 'player', roomCode } });

    const join1OnHost = await host.nextMessage() as {
      t: string;
      p: { event: string; affectedPlayerId: string };
    };
    await p1.nextMessage(); // p1's own ack

    expect(join1OnHost.t).toBe('SessionStateEvent');
    expect(join1OnHost.p.event).toBe('player-joined');

    // Second player
    const p2 = await makeClient(TEST_PORT);
    p2.send({ v: 1, t: 'join', p: { role: 'player', roomCode } });

    // Host receives p2's join; p1 also receives a broadcast; p2 gets its own ack
    const [join2OnHost, join2OnP1, join2OnP2] = await Promise.all([
      findMessage(host, 'SessionStateEvent') as Promise<{ t: string; p: { event: string; affectedPlayerId: string } }>,
      findMessage(p1, 'SessionStateEvent') as Promise<{ t: string; p: { affectedPlayerId: string } }>,
      findMessage(p2, 'SessionStateEvent') as Promise<{ t: string; p: { affectedPlayerId: string } }>,
    ]);

    expect(join2OnHost.t).toBe('SessionStateEvent');
    expect(join2OnHost.p.event).toBe('player-joined');

    // All three views agree on the same player id for p2
    expect(join2OnHost.p.affectedPlayerId).toBe(join2OnP1.p.affectedPlayerId);
    expect(join2OnHost.p.affectedPlayerId).toBe(join2OnP2.p.affectedPlayerId);

    // The two players got distinct IDs
    expect(join1OnHost.p.affectedPlayerId).not.toBe(join2OnHost.p.affectedPlayerId);

    host.close();
    p1.close();
    p2.close();
  });
});
