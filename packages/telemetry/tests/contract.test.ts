import { describe, it, expect } from 'vitest';
import { track } from '../src/index';
import type {
  SessionCreateStarted,
  SessionCreateSucceeded,
  JoinAttemptStarted,
  JoinAttemptSucceeded,
  JoinAttemptFailed,
} from '../src/index';

const BASE = {
  timestamp: Date.now(),
  session_id: 'test-session-id',
  build_version: '0.1.0',
  mode: 'local' as const,
  region: null,
};

function hasBaseFields(event: Record<string, unknown>): void {
  expect(typeof event.event).toBe('string');
  expect(typeof event.timestamp).toBe('number');
  expect(typeof event.session_id).toBe('string');
  expect(typeof event.build_version).toBe('string');
  expect(['local', 'remote']).toContain(event.mode);
  expect(['host', 'mobile', 'server']).toContain(event.platform);
  expect(event.region === null || typeof event.region === 'string').toBe(true);
}

describe('session funnel event contracts', () => {
  it('session_create_started has all base fields', () => {
    const e: SessionCreateStarted = { ...BASE, event: 'session_create_started', platform: 'host' };
    hasBaseFields(e as unknown as Record<string, unknown>);
    expect(e.event).toBe('session_create_started');
    expect(e.platform).toBe('host');
    expect(() => track(e)).not.toThrow();
  });

  it('session_create_succeeded has base fields + room_code + duration_ms', () => {
    const e: SessionCreateSucceeded = { ...BASE, event: 'session_create_succeeded', platform: 'host', room_code: 'ABCD', duration_ms: 120 };
    hasBaseFields(e as unknown as Record<string, unknown>);
    expect(e.room_code).toMatch(/^[A-Z0-9]{4}$/);
    expect(e.duration_ms).toBeGreaterThanOrEqual(0);
    expect(() => track(e)).not.toThrow();
  });

  it('join_attempt_started has base fields + player_id + room_code', () => {
    const e: JoinAttemptStarted = { ...BASE, event: 'join_attempt_started', platform: 'mobile', player_id: 'pid-1', room_code: 'ABCD' };
    hasBaseFields(e as unknown as Record<string, unknown>);
    expect(typeof e.player_id).toBe('string');
    expect(typeof e.room_code).toBe('string');
    expect(() => track(e)).not.toThrow();
  });

  it('join_attempt_succeeded has base fields + player_id + duration_ms', () => {
    const e: JoinAttemptSucceeded = { ...BASE, event: 'join_attempt_succeeded', platform: 'mobile', player_id: 'pid-1', duration_ms: 80 };
    hasBaseFields(e as unknown as Record<string, unknown>);
    expect(e.duration_ms).toBeGreaterThanOrEqual(0);
    expect(() => track(e)).not.toThrow();
  });

  it('join_attempt_failed has base fields + player_id + error_code + duration_ms', () => {
    const e: JoinAttemptFailed = { ...BASE, event: 'join_attempt_failed', platform: 'mobile', player_id: 'pid-1', room_code: 'ZZZZ', error_code: 'ROOM_NOT_FOUND', duration_ms: 45 };
    hasBaseFields(e as unknown as Record<string, unknown>);
    expect(typeof e.error_code).toBe('string');
    expect(e.duration_ms).toBeGreaterThanOrEqual(0);
    expect(() => track(e)).not.toThrow();
  });
});
