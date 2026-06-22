import { Server } from 'colyseus';
import { WebSocketTransport } from '@colyseus/ws-transport';
import { RedisPresence } from '@colyseus/redis-presence';
import { GameRoom } from './rooms/GameRoom.js';
import { logger } from './logger.js';

const PORT = Number(process.env['PORT'] ?? 3000);

// Use RedisPresence only when REDIS_HOST is set (cloud/production).
// Local Party Mode uses Colyseus's default LocalPresence — no Redis required.
const gameServer = process.env['REDIS_HOST']
  ? new Server({
      presence: new RedisPresence({
        host: process.env['REDIS_HOST'],
        port: Number(process.env['REDIS_PORT'] ?? 6379),
      }),
      transport: new WebSocketTransport(),
    })
  : new Server({ transport: new WebSocketTransport() });

gameServer.define('game_room', GameRoom);

gameServer.listen(PORT).then(() => {
  logger.info({ port: PORT, presence: process.env['REDIS_HOST'] ? 'redis' : 'local' }, 'simulation-server listening');
}).catch((err: unknown) => {
  logger.error({ err }, 'failed to start simulation-server');
  process.exit(1);
});
