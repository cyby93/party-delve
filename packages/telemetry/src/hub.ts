import { track } from './logger';

interface HubPlayerEnteredPayload {
  player_id: string;
  session_id: string;
  slot_index: number;
  timestamp: number;
  build_version?: string;
  mode?: 'local' | 'remote';
  region?: string | null;
  platform?: 'host' | 'mobile' | 'server';
}

/**
 * KPI funnel step: fires once per player per session when they first enter the hub.
 * Follows session.player_joined in the funnel.
 */
export function trackHubPlayerEntered(payload: HubPlayerEnteredPayload): void {
  track({
    event: 'hub.player_entered',
    timestamp: payload.timestamp,
    session_id: payload.session_id,
    build_version: payload.build_version ?? '0.1.0',
    mode: payload.mode ?? 'local',
    region: payload.region ?? null,
    platform: payload.platform ?? 'server',
    player_id: payload.player_id,
    slot_index: payload.slot_index,
  });
}
