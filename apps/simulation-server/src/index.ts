import { createWsServer } from './server.js';
import { SessionStore } from './session-store.js';
import { TickLoop } from './tick-loop.js';

const PORT = parseInt(process.env['PORT'] ?? '8081', 10);

const store = new SessionStore();
const loop = new TickLoop(20);
const wss = createWsServer(PORT, store);

loop.start((tick) => {
  wss.setTick(tick);
  if (tick % 100 === 0) {
    console.log(`[tick] tick=${tick}`);
  }
});

process.on('SIGINT', () => {
  console.log('[server] shutting down');
  loop.stop();
  wss.close(() => process.exit(0));
});
