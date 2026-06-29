import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence } from '@colyseus/redis-presence';
import { networkInterfaces } from 'node:os';
import { GameRoom } from './rooms/GameRoom.js';
import { logger } from './logger.js';

const PORT = Number(process.env['PORT'] ?? 2567);

function getLocalIp(): string {
  const candidates: string[] = [];
  for (const ifaces of Object.values(networkInterfaces())) {
    for (const iface of ifaces ?? []) {
      if (iface.family === 'IPv4' && !iface.internal) candidates.push(iface.address);
    }
  }
  // Prefer common LAN ranges: 192.168.x.x > 10.x.x.x > 172.16–31.x.x (avoids Docker bridges first)
  return (
    candidates.find(ip => ip.startsWith('192.168.')) ??
    candidates.find(ip => ip.startsWith('10.')) ??
    candidates.find(ip => /^172\.(1[6-9]|2\d|3[01])\./.test(ip)) ??
    candidates[0] ??
    'localhost'
  );
}

const transport = new WebSocketTransport();
// Only register /local-ip in local mode — not needed (and exposes LAN topology) in cloud deployments.
if (!process.env['REDIS_HOST']) {
  const app = transport.getExpressApp();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  app.get('/local-ip', (_req: any, res: any) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.json({ localIp: getLocalIp() });
  });
}

// Use RedisPresence only when REDIS_HOST is set (cloud/production).
// Local Party Mode uses Colyseus's default LocalPresence — no Redis required.
const gameServer = process.env['REDIS_HOST']
  ? new Server({
      presence: new RedisPresence({
        host: process.env['REDIS_HOST'],
        port: Number(process.env['REDIS_PORT'] ?? 6379),
      }),
      transport,
    })
  : new Server({ transport });

gameServer.define('game_room', GameRoom);

gameServer.listen(PORT).then(() => {
  logger.info({ port: PORT, presence: process.env['REDIS_HOST'] ? 'redis' : 'local' }, 'simulation-server listening');
}).catch((err: unknown) => {
  logger.error({ err }, 'failed to start simulation-server');
  process.exit(1);
});
