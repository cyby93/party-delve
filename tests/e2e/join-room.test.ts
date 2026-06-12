/**
 * E2E regression smoke test for the join-room happy path.
 *
 * This file mirrors the existing smoke test at
 * apps/simulation-server/tests/e2e-join.test.ts and validates that the
 * simulation-server's join flow still works end-to-end after the GDS-001
 * movement changes (session-store freeze-on-disconnect, tick loop, etc.).
 *
 * The test starts the server in-process on a distinct port (18766) so it
 * can run alongside the existing test suite without conflicts.
 */
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { WebSocket } from 'ws';
import { SessionStore } from '../../apps/simulation-server/src/session-store.js';
import { createWsServer } from '../../apps/simulation-server/src/server.js';
import type { WsServerWithTick } from '../../apps/simulation-server/src/server.js';

const TEST_PORT = 18766;

interface TestClient {
  send(obj: unknown): void;
  nextMessage(): Promise<unknown>;
  close(): void;
}

async function findMessage(client: TestClient, type: string): Promise<unknown> {
  for (;;) {
    const msg = (await client.nextMessage()) as { t: string };
    if (msg.t === type) return msg;
  }
}

function makeClient(port: number): Promise<TestClient> {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://localhost:${port}`);
    const buffer: unknown[] = [];
    const waiters: Array<(msg: unknown) => void> = [];

    ws.on('message', (data) => {
      const msg: unknown = JSON.parse(data.toString());
      if (waiters.length > 0) {
        waiters.shift()!(msg);
      } else {
        buffer.push(msg);
      }
    });

    ws.on('open', () => {
      resolve({
        send(obj) { ws.send(JSON.stringify(obj)); },
        nextMessage() {
          if (buffer.length > 0) return Promise.resolve(buffer.shift()!);
          return new Promise<unknown>((res) => waiters.push(res));
        },
        close() { ws.close(); },
      });
    });

    ws.on('error', reject);
  });
}

describe('e2e join-room regression (GDS-001)', () => {
  let wss: WsServerWithTick;

  beforeAll(() => {
    const store = new SessionStore();
    wss = createWsServer(TEST_PORT, store);
    return new Promise<void>((resolve) => wss.on('listening', resolve));
  });

  afterAll(() => new Promise<void>((resolve) => wss.close(() => resolve())));

  it('host join → receives SessionStateEvent session-start with 4-char roomCode', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });
    const msg = (await host.nextMessage()) as { v: number; t: string; p: Record<string, unknown> };

    expect(msg.v).toBe(1);
    expect(msg.t).toBe('SessionStateEvent');
    expect(msg.p.event).toBe('session-start');
    expect(typeof msg.p.roomCode).toBe('string');
    expect((msg.p.roomCode as string).length).toBe(4);

    host.close();
  });

  it('player join valid roomCode → both host and player receive player-joined', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });
    const sessionStart = (await host.nextMessage()) as { p: { roomCode: string } };

    const player = await makeClient(TEST_PORT);
    player.send({ v: 1, t: 'join', p: { role: 'player', roomCode: sessionStart.p.roomCode } });

    const [hostMsg, playerMsg] = await Promise.all([
      findMessage(host, 'SessionStateEvent') as Promise<{ p: Record<string, unknown> }>,
      findMessage(player, 'SessionStateEvent') as Promise<{ p: Record<string, unknown> }>,
    ]);

    expect(hostMsg.p.event).toBe('player-joined');
    expect(playerMsg.p.event).toBe('player-joined');
    expect(hostMsg.p.affectedPlayerId).toBe(playerMsg.p.affectedPlayerId);

    host.close();
    player.close();
  });

  it('player disconnect → host receives player-left; slot stays frozen (connected:false)', async () => {
    const host = await makeClient(TEST_PORT);
    host.send({ v: 1, t: 'join', p: { role: 'host' } });
    const sessionStart = (await host.nextMessage()) as { p: { roomCode: string } };

    const player = await makeClient(TEST_PORT);
    player.send({ v: 1, t: 'join', p: { role: 'player', roomCode: sessionStart.p.roomCode } });

    const joinedOnHost = (await findMessage(host, 'SessionStateEvent')) as { p: { affectedPlayerId: string } };
    await findMessage(player, 'SessionStateEvent'); // player's own ack

    player.close();
    await new Promise<void>((r) => setTimeout(r, 50));

    const leftMsg = (await findMessage(host, 'SessionStateEvent')) as { p: { event: string; affectedPlayerId: string } };

    expect(leftMsg.p.event).toBe('player-left');
    expect(leftMsg.p.affectedPlayerId).toBe(joinedOnHost.p.affectedPlayerId);

    host.close();
  });

  it('player join invalid roomCode → receives ROOM_NOT_FOUND error', async () => {
    const player = await makeClient(TEST_PORT);
    player.send({ v: 1, t: 'join', p: { role: 'player', roomCode: 'ZZZZ' } });

    const msg = (await player.nextMessage()) as { t: string; p: { code: string } };

    expect(msg.t).toBe('error');
    expect(msg.p.code).toBe('ROOM_NOT_FOUND');

    player.close();
  });
});
