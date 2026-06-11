import { WebSocket } from 'ws';
import type { MessageEnvelope } from 'net-protocol';

export function send<T>(socket: WebSocket, envelope: MessageEnvelope<T>): void {
  if (socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(envelope));
  }
}

export function broadcast<T>(sockets: Iterable<WebSocket>, envelope: MessageEnvelope<T>): void {
  for (const s of sockets) send(s, envelope);
}
