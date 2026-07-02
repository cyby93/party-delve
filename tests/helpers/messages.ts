import type { Room } from '@colyseus/sdk';

// Resolves on the first matching message for eventName. Rejects on timeout (default 8s).
export function waitForMessage<T>(
  room: Room,
  eventName: string,
  timeout = 8_000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`timeout after ${timeout}ms waiting for "${eventName}"`));
    }, timeout);
    const unsub = room.onMessage<T>(eventName, (msg) => {
      clearTimeout(timer);
      unsub();
      resolve(msg);
    });
  });
}

// Resolves on the first 'delta' message where predicate returns true. Rejects on timeout.
export function waitForDelta<T extends { type: string }>(
  room: Room,
  predicate: (delta: T) => boolean,
  timeout = 8_000
): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      unsub();
      reject(new Error(`timeout after ${timeout}ms waiting for matching delta`));
    }, timeout);
    const unsub = room.onMessage<T>('delta', (msg) => {
      if (predicate(msg)) {
        clearTimeout(timer);
        unsub();
        resolve(msg);
      }
    });
  });
}

// Polls condition() every intervalMs until it returns true or timeout elapses.
export async function waitUntil(
  condition: () => boolean,
  timeout = 5_000,
  intervalMs = 100
): Promise<void> {
  const deadline = Date.now() + timeout;
  while (Date.now() < deadline) {
    if (condition()) return;
    await new Promise<void>((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`waitUntil: condition not met after ${timeout}ms`);
}
