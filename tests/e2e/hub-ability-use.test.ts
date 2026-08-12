import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg, CooldownUpdateMsg, DeltaEventMsg } from 'net-protocol';
import { startTestServer, stopTestServer, TEST_URL } from '../helpers/server.js';
import { waitForDelta, waitForMessage } from '../helpers/messages.js';
import { raceTimeout } from '../helpers/race-timeout.js';

// Story 2.8 (AC1): the ability-processing guard previously required
// `player.nearPoiId === 'training-dummy'` outside a dungeon; firing anywhere
// else in the hub was silently dropped server-side with zero feedback. This
// proves the fix: a player who never navigates toward any POI (still at
// spawn, `nearPoiId === null`, session phase 'lobby') can fire an ability and
// receive a real COOLDOWN_UPDATE — the exact message the old guard prevented.
//
// Story 7.14a extends this file. Story 2.8 unblocked the *input* path only —
// the `ability:fired` broadcast, and every combat effect with it, stayed inside
// `if (inDungeon)`, so a hub cast produced a cooldown and nothing observable on
// the host. The tests below pin the new boundary from both sides: the cast is
// now announced, and it is still not combat.
describe('live-room hub ability use (Story 2.8)', { timeout: 60_000 }, () => {
  let client: Colyseus.Client;

  beforeAll(async () => {
    await startTestServer();
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  /** Host + one classed player, both still at spawn away from every POI. */
  async function joinClassedPlayer(classId: 'stormcaller' | 'stonehide' | 'souldrinker') {
    const host = await client.create('game_room', { isHost: true });
    const roomId = host.roomId;

    const joinedSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length >= 1) { unsub(); resolve(snap); }
      });
    });
    const player: Room = await client.joinById(roomId, { playerName: 'Solo' });
    const snap = await raceTimeout(joinedSnap, 10_000, 'player joined');

    const classUpdated = waitForDelta<any>(
      host,
      (d) => d.type === 'player:class-updated' && d.playerId === player.sessionId && d.class === classId,
    );
    player.send(EventNames.CLASS_SELECT, { classId });
    await classUpdated;

    return { host, player, snap };
  }

  it('fires an ability from spawn, away from every POI, without entering a dungeon (AC1)', async () => {
    const { host, player, snap } = await joinClassedPlayer('stormcaller');

    expect(snap.state.session.phase).toBe('lobby');
    const self = snap.state.players.find((p: any) => p.id === player.sessionId);
    expect(self?.nearPoiId).toBeNull();

    // Thunder Clap (Stormcaller ability index 2) — TAP, no direction needed.
    const cooldownUpdate = waitForMessage<CooldownUpdateMsg>(player, EventNames.COOLDOWN_UPDATE);
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 2, directionX: 0, directionY: 0 } },
    });

    const update = await raceTimeout(cooldownUpdate, 5_000, 'COOLDOWN_UPDATE after hub ability fire');
    expect(update.abilityIndex).toBe(2);
    // ADR-0004: an active cooldown is expiresAtMs > serverNowMs (was remainingMs > 0).
    expect(update.expiresAtMs).toBeGreaterThan(update.serverNowMs);
    expect(update.startedAtMs).toBeLessThanOrEqual(update.serverNowMs);

    await Promise.all([host.leave(), player.leave()]);
  });

  // Story 7.14a AC1 — the delta the whole hub-VFX feature depends on.
  it('broadcasts ability:fired for a hub cast, carrying the caster, index and direction (7.14a AC1)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const fired = waitForDelta<any>(
      host,
      (d) => d.type === 'ability:fired' && d.playerId === player.sessionId,
    );
    // Lightning Arc (index 0) with a deliberately non-unit direction. The delta
    // carries `result.value.directionX/Y` from dispatchAbility, which passes the
    // caster's vector through unnormalized (it only zeroes it for TAP, see
    // abilities.ts:78-79) — normalization happens later, per delivery branch, in
    // GameRoom. So the wire contract is "the direction the player expressed",
    // not "a unit vector", and this assertion pins that rather than assuming.
    // In practice the phone always sends a unit vector (ControllerScreen.tsx
    // uses cos/sin of the drag angle), but nothing on the wire enforces it.
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 0, directionX: 3, directionY: 4 } },
    });

    const delta = await raceTimeout(fired, 5_000, 'ability:fired after hub cast');
    expect(delta.abilityIndex).toBe(0);
    expect(delta.directionX).toBeCloseTo(3, 5);
    expect(delta.directionY).toBeCloseTo(4, 5);

    await Promise.all([host.leave(), player.leave()]);
  });

  // Story 7.14a AC2 — zero-aim stays silent, matching the dungeon path and the
  // host's SILENT rule (a delta the host cannot honestly render is worse than none).
  it('broadcasts no ability:fired for a zero-aim directional hub cast (7.14a AC2)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const seen: DeltaEventMsg[] = [];
    host.onMessage<DeltaEventMsg>('delta', (d) => seen.push(d));

    // Storm Eye (index 3) is directional; dispatchAbility rejects a zero vector.
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 3, directionX: 0, directionY: 0 } },
    });
    await new Promise<void>((r) => setTimeout(r, 1_000));

    expect(seen.filter(d => d.type === 'ability:fired')).toHaveLength(0);

    await Promise.all([host.leave(), player.leave()]);
  });

  // Story 7.14a AC4 — the negative half of the boundary. This is the test that
  // stops a future refactor from quietly widening `if (inDungeon)`.
  it('resolves no combat for a hub cast — no projectiles, zones, or damage (7.14a AC4)', async () => {
    const { host, player } = await joinClassedPlayer('souldrinker');

    const seen: DeltaEventMsg[] = [];
    host.onMessage<DeltaEventMsg>('delta', (d) => seen.push(d));
    let latest: SnapshotMsg | null = null;
    host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (s) => { latest = s; });

    // Blood Spike (souldrinker[0]) is projectile-delivery; Void Pulse (index 3)
    // spawns a chained zone on hit. Neither may produce an entity in the hub.
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 0, directionX: 1, directionY: 0 } },
    });
    await new Promise<void>((r) => setTimeout(r, 1_000));

    // The cast itself IS announced (7.14a AC1) …
    expect(seen.some(d => d.type === 'ability:fired')).toBe(true);
    // … but nothing downstream of it resolved.
    const forbidden = seen.filter(d =>
      d.type === 'projectile:moved' || d.type === 'projectile:hit' || d.type === 'projectile:expired' ||
      d.type === 'zone:tick' || d.type === 'zone:strike' || d.type === 'zone:expired' ||
      d.type === 'enemy:damaged' || d.type === 'enemy:killed' || d.type === 'ability:chain-hit'
    );
    expect(forbidden.map(d => d.type)).toEqual([]);

    // Blood Spike carries selfCostHp, so a snapshot is expected regardless; assert
    // on the entity arrays it must have left empty.
    if (latest !== null) {
      const snapshot = latest as SnapshotMsg;
      expect(snapshot.state.projectiles).toEqual([]);
      expect(snapshot.state.zones).toEqual([]);
    }

    await Promise.all([host.leave(), player.leave()]);
  });

  // Story 7.14a AC3 — self-scope status effects are caster-resource effects, in
  // the same category as the cooldown and self-cost that already worked in hub.
  it('applies and expires a self-scope status effect from a hub cast (7.14a AC3)', async () => {
    const { host, player } = await joinClassedPlayer('stonehide');

    const applied = waitForDelta<any>(
      host,
      (d) => d.type === 'status:applied' && d.targetId === player.sessionId && d.effectType === 'damageReduction',
    );
    // Iron Skin (stonehide[2]) — TAP, scope 'self', damageReduction 0.3 / 3000ms.
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 2, directionX: 0, directionY: 0 } },
    });
    const appliedDelta = await raceTimeout(applied, 5_000, 'status:applied after hub Iron Skin');
    expect(appliedDelta.magnitude).toBeCloseTo(0.3, 5);

    // It expires on its own — the status tick is already phase-agnostic, so no
    // hub-specific expiry path was needed and none must be silently required.
    const expired = waitForDelta<any>(
      host,
      (d) => d.type === 'status:expired' && d.targetId === player.sessionId && d.effectType === 'damageReduction',
      8_000,
    );
    await raceTimeout(expired, 9_000, 'status:expired for hub Iron Skin');
    // The `status:expired` delta IS the expiry contract — no snapshot follows it
    // (snapshots are broadcast on entity-shape changes, not on status ticks), and
    // clients converge by applying the delta. Asserting on a post-expiry snapshot
    // here would be asserting on a broadcast the server never makes.

    await Promise.all([host.leave(), player.leave()]);
  });
});
