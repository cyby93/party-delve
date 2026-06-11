import { useEffect, useState } from 'react';

type SocketStatus = 'connecting' | 'connected' | 'offline';

export function useSimulationSocket(url: string) {
  const [status, setStatus] = useState<SocketStatus>('connecting');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let cancelled = false;

    try {
      ws = new WebSocket(url);

      ws.onopen = () => {
        if (!cancelled) setStatus('connected');
      };

      ws.onerror = () => {
        if (!cancelled) setStatus('offline');
      };

      ws.onclose = () => {
        if (!cancelled) setStatus('offline');
      };
    } catch {
      setStatus('offline');
    }

    return () => {
      cancelled = true;
      ws?.close();
    };
  }, [url]);

  return status;
}
