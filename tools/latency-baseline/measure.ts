#!/usr/bin/env npx tsx
/**
 * Latency baseline — measures round-trip from INPUT send to player:moved delta.
 * Usage: npx tsx measure.ts [--url ws://localhost:2567] [--samples 100]
 * Requires a running simulation server (npm run dev in apps/simulation-server).
 */
import * as Colyseus from '@colyseus/sdk';

const args = process.argv.slice(2);
const getArg = (flag: string, fallback: string): string => {
  const idx = args.indexOf(flag);
  return idx !== -1 && args[idx + 1] ? args[idx + 1]! : fallback;
};
const url = getArg('--url', 'ws://localhost:2567');
const samples = parseInt(getArg('--samples', '100'), 10);

async function measure(): Promise<void> {
  const colyseusClient = new Colyseus.Client(url);
  const host = await colyseusClient.create('game_room', { isHost: true });
  const player = await colyseusClient.joinById(host.roomId, { playerName: 'latency-probe' });

  player.send('class:select', { classId: 'stormcaller' });
  await new Promise<void>((r) => setTimeout(r, 500));

  const latencies: number[] = [];

  for (let i = 0; i < samples; i++) {
    const sentAt = Date.now();
    player.send('input', { type: 'input', event: { type: 'joystick', joystick: { x: 0.5, y: 0 } } });

    await new Promise<void>((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error(`sample ${i}: timeout`)), 1_000);
      const unsub = player.onMessage('delta', (msg: any) => {
        if (msg.type === 'player:moved' && msg.playerId === player.sessionId) {
          clearTimeout(timer);
          unsub();
          latencies.push(Date.now() - sentAt);
          resolve();
        }
      });
    });

    await new Promise<void>((r) => setTimeout(r, 50));
  }

  await player.leave();
  await host.leave();

  latencies.sort((a, b) => a - b);
  const p50 = latencies[Math.floor(latencies.length * 0.5)]!;
  const p95 = latencies[Math.floor(latencies.length * 0.95)]!;

  console.log(`\np50: ${p50}ms   p95: ${p95}ms   samples: ${samples}`);
  console.log(`min: ${latencies[0]}ms   max: ${latencies[latencies.length - 1]}ms`);

  if (p95 > 100) {
    console.warn(`\n⚠ WARNING: p95 (${p95}ms) exceeds 100ms target (NFR1).`);
  }
}

measure().catch((err) => {
  console.error('measure failed:', err);
  process.exit(0);
});
