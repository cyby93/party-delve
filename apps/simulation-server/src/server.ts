import { WebSocketServer } from 'ws';
import { isMessageEnvelope } from 'net-protocol';

export function createWsServer(port: number): WebSocketServer {
  const wss = new WebSocketServer({ port });

  wss.on('listening', () => {
    console.log(`[server] WebSocket listening on port ${port}`);
  });

  wss.on('connection', (socket, req) => {
    const remote = req.socket.remoteAddress ?? 'unknown';
    console.log(`[server] client connected from ${remote}`);

    socket.on('message', (data) => {
      try {
        const msg: unknown = JSON.parse(data.toString());
        if (!isMessageEnvelope(msg)) {
          console.warn('[server] received invalid envelope — ignoring');
          return;
        }
        // P1-8 will route msg.t to handlers; for now just log
        console.log(`[server] received event: ${msg.t}`);
      } catch {
        console.warn('[server] failed to parse message');
      }
    });

    socket.on('close', () => {
      console.log(`[server] client disconnected from ${remote}`);
    });
  });

  return wss;
}
