import { describe, it, beforeAll, afterAll, expect } from 'vitest';
import * as Colyseus from '@colyseus/sdk';
import type { Room } from '@colyseus/sdk';
import { EventNames } from 'net-protocol';
import type { SnapshotMsg, DeltaEventMsg } from 'net-protocol';
import { startTestServer, stopTestServer, TEST_URL } from '../helpers/server.js';
import { waitForDelta, waitForMessage } from '../helpers/messages.js';
import { raceTimeout } from '../helpers/race-timeout.js';

// Story 7.15b (ADR-0008): the sim resolves an in-progress aim into a broadcast
// `ability:aim-preview` delta. These drive the real WebSocket path rather than
// calling GameRoom directly, because the thing most likely to break is the wire
// shape and the per-tick collapse, not the arithmetic (which tests/unit/aim-preview
// covers directly).
//
// Note these send `input:aim-preview` by hand. Story 7.15d is what makes a real
// phone send it; this file does not depend on 7.15d having shipped.
describe('live-room aim preview (Story 7.15b)', { timeout: 60_000 }, () => {
  let client: Colyseus.Client;

  beforeAll(async () => {
    await startTestServer();
    client = new Colyseus.Client(TEST_URL);
  }, 65_000);

  afterAll(() => stopTestServer());

  async function joinClassedPlayer(classId: 'stormcaller' | 'stonehide') {
    const host = await client.create('game_room', { isHost: true });
    const joinedSnap = new Promise<SnapshotMsg>((resolve) => {
      const unsub = host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (snap) => {
        if (snap.state.players.length >= 1) { unsub(); resolve(snap); }
      });
    });
    const player: Room = await client.joinById(host.roomId, { playerName: 'Aimer' });
    const snap = await raceTimeout(joinedSnap, 10_000, 'player joined');

    const classUpdated = waitForDelta<any>(
      host,
      (d) => d.type === 'player:class-updated' && d.playerId === player.sessionId && d.class === classId,
    );
    player.send(EventNames.CLASS_SELECT, { classId });
    await classUpdated;
    return { host, player, snap };
  }

  const sendAimPreview = (player: Room, abilityIndex: number, dx: number, dy: number) =>
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'aim-preview', abilityIndex, directionX: dx, directionY: dy },
    });

  // AC1 + AC2: Storm Eye is RELEASE + zone-delivery, so it gets both an arrow
  // direction and a destination point.
  it('broadcasts ability:aim-preview with a target for Storm Eye, normalizing the direction (AC1, AC2)', async () => {
    const { host, player, snap } = await joinClassedPlayer('stormcaller');
    const self = snap.state.players.find(p => p.id === player.sessionId)!;

    const preview = waitForDelta<any>(
      host,
      (d) => d.type === 'ability:aim-preview' && d.playerId === player.sessionId,
    );
    // Non-unit direction on purpose: the wire carries whatever the client sent,
    // so the sim must normalize before applying hitRangePx.
    sendAimPreview(player, 3, 0, 5);

    const delta = await raceTimeout(preview, 5_000, 'ability:aim-preview for Storm Eye');
    expect(delta.abilityIndex).toBe(3);
    expect(Math.hypot(delta.directionX, delta.directionY)).toBeCloseTo(1, 5);
    // Storm Eye's placement range is 160px (ABILITY_GEOMETRY stormcaller[3]).
    expect(delta.targetX).toBeCloseTo(self.x, 3);
    expect(delta.targetY).toBeCloseTo(self.y + 160, 3);

    await Promise.all([host.leave(), player.leave()]);
  });

  // AC2: Tempest Hurl is RELEASE but projectile-delivery — arrow only, no target.
  it('omits targetX/targetY for a projectile-delivery RELEASE ability (AC2)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const preview = waitForDelta<any>(
      host,
      (d) => d.type === 'ability:aim-preview' && d.playerId === player.sessionId,
    );
    sendAimPreview(player, 1, 1, 0); // Tempest Hurl

    const delta = await raceTimeout(preview, 5_000, 'ability:aim-preview for Tempest Hurl');
    expect(delta.abilityIndex).toBe(1);
    expect(delta.directionX).toBeCloseTo(1, 5);
    expect(delta).not.toHaveProperty('targetX');
    expect(delta).not.toHaveProperty('targetY');

    await Promise.all([host.leave(), player.leave()]);
  });

  // Story 7.15e: an AUTO ability is held continuously, and its cast input is
  // suppressed while on cooldown (the 2026-07-25 anti-flood fix). Without a
  // separate signal the sim broadcasts nothing during that gap and the host's
  // staleness window clears the arrow, making it blink at the cooldown cadence.
  // The phone now sends `aim-preview` instead of a cast during the gap; this
  // proves the sim accepts it for an AUTO ability and answers with a
  // direction-only preview (no target — an AUTO ability's landing point is not
  // knowable while aiming).
  it('broadcasts a direction-only preview for a held AUTO ability during its cooldown (7.15e)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    // Lightning Arc (stormcaller[0], AUTO, 1000ms cooldown). Fire it to start a
    // real cooldown, exactly as holding the cell would.
    const fired = waitForDelta<any>(
      host,
      (d) => d.type === 'ability:fired' && d.playerId === player.sessionId,
    );
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 0, directionX: 1, directionY: 0 } },
    });
    await raceTimeout(fired, 5_000, 'ability:fired for Lightning Arc');

    // Now mid-cooldown: the phone would send previews rather than casts.
    const previews: any[] = [];
    host.onMessage<any>('delta', (d) => {
      if (d.type === 'ability:aim-preview' && d.playerId === player.sessionId) previews.push(d);
    });
    sendAimPreview(player, 0, 0, 1);
    await new Promise<void>((r) => setTimeout(r, 300));
    sendAimPreview(player, 0, 1, 0);
    await new Promise<void>((r) => setTimeout(r, 300));

    // Both arrived — the aim keeps refreshing through the cooldown gap.
    expect(previews.length).toBeGreaterThanOrEqual(2);
    expect(previews[previews.length - 1].directionX).toBeCloseTo(1, 5);
    // Arrow only: AUTO abilities never carry a destination.
    expect(previews[0]).not.toHaveProperty('targetX');

    await Promise.all([host.leave(), player.leave()]);
  });

  // AC6: zero aim is suppressed entirely, not broadcast direction-only.
  it('broadcasts nothing for a zero-magnitude aim (AC6, SILENT rule)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const seen: DeltaEventMsg[] = [];
    host.onMessage<DeltaEventMsg>('delta', (d) => seen.push(d));

    sendAimPreview(player, 3, 0, 0);
    await new Promise<void>((r) => setTimeout(r, 700));

    expect(seen.filter(d => d.type === 'ability:aim-preview')).toHaveLength(0);

    await Promise.all([host.leave(), player.leave()]);
  });

  // The non-finite case the 7.15a review surfaced: JSON turns NaN into null, so
  // the sim really can receive `null` in a field typed `number`.
  //
  // Both shapes are sent explicitly. `NaN` alone is NOT sufficient coverage —
  // Colyseus's own transport is msgpack, not `net-protocol`'s JSON wrappers, so
  // NaN survives the wire as NaN and never exercises the null path (code review
  // 2026-08-06 caught this test asserting the wrong thing). The `null` case is
  // the dangerous one: `??` treats it as nullish, and a fallthrough there once
  // threw inside the tick — which, because the input queue is drained after this
  // point, would have re-thrown every 33ms and wedged the room permanently.
  it('broadcasts nothing, and does not wedge the tick, for NaN or null directions', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const seen: DeltaEventMsg[] = [];
    host.onMessage<DeltaEventMsg>('delta', (d) => seen.push(d));

    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'aim-preview', abilityIndex: 3, directionX: NaN, directionY: NaN },
    });
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'aim-preview', abilityIndex: 3, directionX: null, directionY: null },
    });
    await new Promise<void>((r) => setTimeout(r, 700));

    expect(seen.filter(d => d.type === 'ability:aim-preview')).toHaveLength(0);

    // The tick loop must still be running. The probe has to be something the sim
    // does DOWNSTREAM of the aim-preview broadcast, because that is what a throw
    // there would halt — the periodic full snapshot qualifies.
    //
    // Do NOT probe this by sending another valid aim and waiting for a preview:
    // that passes even when the loop is wedged. `inputQueue` is cleared after the
    // broadcast point, so a throw leaves the poisoned event queued and re-drained
    // every tick — but the per-player Map collapse means a later valid input
    // simply overwrites it, and the broadcast starts succeeding again while the
    // queue keeps growing without bound. That false-negative is exactly what an
    // earlier version of this test hit (verified by instrumenting the throw).
    const snapshotAfter = waitForMessage<SnapshotMsg>(host, EventNames.SNAPSHOT, 8_000);
    await raceTimeout(snapshotAfter, 9_000, 'periodic snapshot after a poisoned aim input');

    await Promise.all([host.leave(), player.leave()]);
  });

  // AC5: several aim-preview inputs inside one tick collapse to one broadcast
  // carrying the latest direction.
  it('collapses a burst of aim-preview inputs to one broadcast per tick, keeping the latest (AC5)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const previews: any[] = [];
    host.onMessage<any>('delta', (d) => { if (d.type === 'ability:aim-preview') previews.push(d); });

    // Six sends with no await between them land well inside one 33ms tick.
    sendAimPreview(player, 3, 1, 0);
    sendAimPreview(player, 3, 0, 1);
    sendAimPreview(player, 3, -1, 0);
    sendAimPreview(player, 3, 0, -1);
    sendAimPreview(player, 3, 1, 1);
    sendAimPreview(player, 3, -1, 0); // the latest — this is the one that must win
    await new Promise<void>((r) => setTimeout(r, 700));

    // Far fewer broadcasts than inputs, and the surviving one carries the last
    // direction sent. Asserting "<= 2" rather than "=== 1" leaves room for the
    // burst straddling a tick boundary, which is a scheduling accident rather
    // than a contract violation; the collapse property is what matters.
    expect(previews.length).toBeGreaterThanOrEqual(1);
    expect(previews.length).toBeLessThanOrEqual(2);
    const last = previews[previews.length - 1];
    expect(last.directionX).toBeCloseTo(-1, 5);
    expect(last.directionY).toBeCloseTo(0, 5);

    await Promise.all([host.leave(), player.leave()]);
  });

  // Story 7.15d's actual gesture, end to end: a RELEASE drag streams previews at
  // the joystick cadence and then fires on release. The mobile code that produces
  // this sequence cannot be driven from here (apps/mobile-controller has no
  // component-test harness, deliberately — see 7.15d Dev Notes), so this asserts
  // the wire contract that code implements rather than the code itself.
  it('a RELEASE drag streams previews and then fires, in that order (Story 7.15d gesture)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const ordered: string[] = [];
    host.onMessage<any>('delta', (d) => {
      if (d.type === 'ability:aim-preview' && d.playerId === player.sessionId) ordered.push('preview');
      if (d.type === 'ability:fired' && d.playerId === player.sessionId) ordered.push('fired');
    });

    // Mid-drag: several previews at the real ~33ms cadence, direction changing.
    for (const [dx, dy] of [[1, 0], [0.7, 0.7], [0, 1]] as const) {
      sendAimPreview(player, 3, dx, dy);
      await new Promise<void>((r) => setTimeout(r, 40));
    }
    // Release → the real cast, on the existing untouched `ability` input.
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 3, directionX: 0, directionY: 1 } },
    });
    await new Promise<void>((r) => setTimeout(r, 700));

    expect(ordered).toContain('preview');
    expect(ordered).toContain('fired');
    // Every preview precedes the fire — the phone stops sending on release, so
    // nothing may trail the cast.
    expect(ordered.lastIndexOf('preview')).toBeLessThan(ordered.indexOf('fired'));

    await Promise.all([host.leave(), player.leave()]);
  });

  // The same-tick variant, which is the case that actually matters and which the
  // test above CANNOT catch: its 40ms sleeps guarantee a tick boundary between
  // the last preview and the fire. Real drags do not — the phone sends previews
  // every ~33ms and the tick is ~33ms, so the final preview and the release land
  // in the same input drain roughly half the time. Without the sim suppressing
  // the preview for a player who fired this tick, the host would clear the aim on
  // `ability:fired` and then immediately re-insert it from a preview broadcast
  // later in the same tick, leaving a ghost arrow over the cast VFX for ~150ms.
  // Regression test for a code-review finding, 2026-08-06.
  it('never broadcasts a preview after the fire when both land in one tick (no-sleep release)', async () => {
    const { host, player } = await joinClassedPlayer('stormcaller');

    const ordered: string[] = [];
    host.onMessage<any>('delta', (d) => {
      if (d.type === 'ability:aim-preview' && d.playerId === player.sessionId) ordered.push('preview');
      if (d.type === 'ability:fired' && d.playerId === player.sessionId) ordered.push('fired');
    });

    // Establish an aim, then release with NO sleep — both messages land in the
    // same drain, which is exactly the ordering the phone produces on release.
    sendAimPreview(player, 3, 0, 1);
    await new Promise<void>((r) => setTimeout(r, 40));
    sendAimPreview(player, 3, 0, 1);
    player.send(EventNames.INPUT, {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex: 3, directionX: 0, directionY: 1 } },
    });
    await new Promise<void>((r) => setTimeout(r, 800));

    expect(ordered).toContain('fired');
    // Nothing may follow the fire. Asserting on the tail rather than on counts,
    // because how many previews precede it is timing-dependent and irrelevant.
    expect(ordered[ordered.length - 1]).toBe('fired');

    await Promise.all([host.leave(), player.leave()]);
  });

  // AC4: presentation-only — nothing about this delta touches persistent state.
  it('never mutates GameState (AC4)', async () => {
    const { host, player } = await joinClassedPlayer('stonehide');

    let latest: SnapshotMsg | null = null;
    host.onMessage<SnapshotMsg>(EventNames.SNAPSHOT, (s) => { latest = s; });

    const preview = waitForDelta<any>(
      host,
      (d) => d.type === 'ability:aim-preview' && d.playerId === player.sessionId,
    );
    sendAimPreview(player, 0, 1, 0); // Stone Wall
    await raceTimeout(preview, 5_000, 'ability:aim-preview for Stone Wall');

    if (latest !== null) {
      const snapshot = latest as SnapshotMsg;
      const self = snapshot.state.players.find(p => p.id === player.sessionId);
      expect(self?.statusEffects).toEqual([]);
      expect(snapshot.state.projectiles).toEqual([]);
      expect(snapshot.state.zones).toEqual([]);
    }

    await Promise.all([host.leave(), player.leave()]);
  });
});
