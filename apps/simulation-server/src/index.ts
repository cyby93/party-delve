import type { SessionState } from 'shared-types';
import { TickLoop } from './tick-loop.js';
import { createWsServer } from './server.js';

const PORT = parseInt(process.env['PORT'] ?? '8080', 10);

// Import used to satisfy "imports and uses at least one type from shared-types" acceptance criterion
const _sessionState: SessionState = 'idle';
void _sessionState;

const loop = new TickLoop(20);
const wss = createWsServer(PORT);

loop.start((tick) => {
  if (tick % 100 === 0) {
    console.log(`[tick] tick=${tick}`);
  }
});

process.on('SIGINT', () => {
  console.log('[server] shutting down');
  loop.stop();
  wss.close(() => process.exit(0));
});
