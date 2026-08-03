import { Container, Graphics } from 'pixi.js';
import { progress, type EffectHandle, type VfxTriggerParams } from './types';

// Every primitive: create its own display objects on trigger, mutate them each
// frame (never allocate a display object per tick), destroy on complete.
// Rendering only — no game logic, no cooldowns, no collision.
//
// None of them reads a clock: `startedAt` is captured from the first
// `update(now)` unless the caller passes one explicitly. See the CLOCK CONTRACT
// note on VfxTriggerParams — this is what makes mixing Date.now()/performance.now()
// impossible rather than silently fatal.

const pickColor = (color: number | readonly number[], i: number): number =>
  typeof color === 'number' ? color : (color[i % color.length] ?? 0xffffff);

// ── Particle burst ───────────────────────────────────────────────────────────
// Generalized from the reward-reveal burst in DungeonScreen.tsx.

export interface ParticleBurstParams extends Omit<VfxTriggerParams, 'color'> {
  /** Single color, or a palette cycled across particles. */
  color: number | readonly number[];
  /** Particle count. Default 10. */
  count?: number;
  /** Outward speed in px/ms. Default 0.15. */
  speed?: number;
  /** Random angle jitter in radians. Default 0.5. */
  spread?: number;
  /** Base particle radius in px; each particle lands in 1x-2x of it. Default 8. */
  particleRadius?: number;
}

interface Particle {
  graphic: Graphics;
  vx: number;
  vy: number;
}

export function createParticleBurst(params: ParticleBurstParams): EffectHandle {
  const {
    x, y, color, durationMs,
    alpha = 1,
    count = 10,
    speed = 0.15,
    spread = 0.5,
    particleRadius = 8,
  } = params;
  let startedAt = params.startedAt;

  // One Graphics per particle, drawn once — per frame only `position` and
  // `alpha` are touched, so no geometry is re-tessellated (matches the prior
  // art in DungeonScreen.tsx, which also allocates its circles up front).
  const view = new Container();
  view.position.set(x, y);

  const particles: Particle[] = [];
  for (let i = 0; i < count; i++) {
    // Math.random() is permitted here — cosmetic host-side effect only.
    const angle = (Math.PI * 2 * i) / count + (Math.random() - 0.5) * spread;
    const s = speed * (0.7 + Math.random() * 0.6);
    const graphic = new Graphics();
    graphic
      .circle(0, 0, particleRadius + Math.random() * particleRadius)
      .fill({ color: pickColor(color, i) });
    view.addChild(graphic);
    particles.push({ graphic, vx: Math.cos(angle) * s, vy: Math.sin(angle) * s });
  }

  return {
    view,
    update(now) {
      startedAt ??= now;
      const t = progress(now, startedAt, durationMs);
      // Clamped elapsed — a stalled ticker or a backdated start must not fling
      // particles off-origin or send them inward.
      const elapsed = t * durationMs;
      view.alpha = alpha * (1 - t);
      for (const p of particles) {
        p.graphic.position.set(p.vx * elapsed, p.vy * elapsed);
      }
      return t < 1;
    },
    dispose() {
      view.destroy({ children: true });
    },
  };
}

// ── Trail ────────────────────────────────────────────────────────────────────

export interface TrailParams extends VfxTriggerParams {
  /** Stroke width of the newest segment. Default 6. */
  width?: number;
  /** Ring-buffer capacity for the point history. Minimum 2, default 16. */
  pointCount?: number;
}

export interface TrailHandle extends EffectHandle {
  /** True once the engine has reaped and destroyed this trail — further
   *  `moveTo` calls are no-ops, so the caller must re-create to restart. */
  readonly disposed: boolean;
  /** Push the next point of the followed entity, timestamped in the same clock
   *  as `update(now)`. Keeping this called keeps the trail alive; stop calling
   *  it and the trail expires point-by-point. */
  moveTo(x: number, y: number, now: number): void;
}

interface TrailPoint {
  x: number;
  y: number;
  t: number;
}

export function createTrail(params: TrailParams): TrailHandle {
  const {
    x, y, color, durationMs,
    alpha = 1,
    width = 6,
  } = params;
  // Two points is the minimum that can draw a segment; below that the trail
  // would be permanently invisible but still report itself alive.
  const pointCount = Math.max(2, Math.floor(params.pointCount ?? 16));

  const view = new Graphics();

  // Fixed-size ring buffer — no allocation once primed.
  const points: TrailPoint[] = [];
  for (let i = 0; i < pointCount; i++) points.push({ x, y, t: NaN });
  let head = 0;
  let seeded = params.startedAt !== undefined;
  if (seeded) points[0]!.t = params.startedAt!;
  let disposed = false;

  return {
    view,
    get disposed() {
      return disposed;
    },
    moveTo(px, py, now) {
      if (disposed) return;
      if (!seeded) {
        // No explicit startedAt: the seed point takes the first timestamp it sees.
        points[0]!.t = now;
        seeded = true;
      }
      head = (head + 1) % pointCount;
      const slot = points[head]!;
      slot.x = px;
      slot.y = py;
      slot.t = now;
    },
    update(now) {
      if (!seeded) {
        points[0]!.t = now;
        seeded = true;
      }
      view.clear();
      let alive = 0;
      // Walk oldest → newest so segments stack naturally.
      let prev: TrailPoint | null = null;
      for (let i = 1; i <= pointCount; i++) {
        const p = points[(head + i) % pointCount]!;
        const age = progress(now, p.t, durationMs);
        if (age >= 1) {
          prev = null;
          continue;
        }
        alive++;
        if (prev) {
          const fade = 1 - age;
          view
            .moveTo(prev.x, prev.y)
            .lineTo(p.x, p.y)
            .stroke({ color, width: width * fade, alpha: alpha * fade });
        }
        prev = p;
      }
      return alive > 0;
    },
    dispose() {
      disposed = true;
      view.destroy();
    },
  };
}

// ── Ring / shockwave ─────────────────────────────────────────────────────────
// Generalized from the purification pulse and the `boss:stomped` ring.

export interface RingShockwaveParams extends VfxTriggerParams {
  /** Radius reached at completion. */
  maxRadius: number;
  /** Radius at trigger. Default 0. */
  startRadius?: number;
  /** Stroke width; ignored when `filled`. Default 3. */
  lineWidth?: number;
  /** Filled disc instead of an outline. Default false. */
  filled?: boolean;
}

export function createRingShockwave(params: RingShockwaveParams): EffectHandle {
  const {
    x, y, color, durationMs, maxRadius,
    alpha = 1,
    startRadius = 0,
    lineWidth = 3,
    filled = false,
  } = params;
  let startedAt = params.startedAt;

  const view = new Graphics();
  view.position.set(x, y);

  return {
    view,
    update(now) {
      startedAt ??= now;
      const t = progress(now, startedAt, durationMs);
      // Clamped: an implode (maxRadius < startRadius) must not reach a negative radius.
      const radius = Math.max(0, startRadius + t * (maxRadius - startRadius));
      const a = alpha * (1 - t);
      view.clear();
      if (filled) {
        view.circle(0, 0, radius).fill({ color, alpha: a });
      } else {
        view.circle(0, 0, radius).stroke({ color, width: lineWidth, alpha: a });
      }
      return t < 1;
    },
    dispose() {
      view.destroy();
    },
  };
}

// ── Cone / wedge ─────────────────────────────────────────────────────────────
// Sibling to createRingShockwave: same apex-anchored expand/implode + fade
// lifecycle, but swept across only `angleDeg` (full angle) around a direction
// instead of the full 360°. Story 7.13.

export interface ConeWedgeParams extends VfxTriggerParams {
  /** Normalized aim direction — must already be a unit vector (like `place.normX/normY`);
   *  the wedge does not renormalize it. */
  dirX: number;
  dirY: number;
  /** Full angular span of the wedge, in degrees. `0` degenerates to a line along
   *  `(dirX, dirY)` rather than a zero-area shape. */
  angleDeg: number;
  /** Radius reached at completion. */
  maxRadius: number;
  /** Radius at trigger. Default 0. */
  startRadius?: number;
  /** Stroke width; ignored when `filled`. Default 3. */
  lineWidth?: number;
  /** Filled sector instead of an outline. Default false. */
  filled?: boolean;
}

export function createConeWedge(params: ConeWedgeParams): EffectHandle {
  const {
    x, y, dirX, dirY, angleDeg, color, durationMs, maxRadius,
    alpha = 1,
    startRadius = 0,
    lineWidth = 3,
    filled = false,
  } = params;
  let startedAt = params.startedAt;

  const view = new Graphics();
  view.position.set(x, y);

  // Half-angle rotation of the direction vector, both ways — the two edge rays
  // of the sector (see Dev Notes: standard 2D rotation of (dirX, dirY)). Clamped
  // to [0, 360] — code review 2026-07-30 (Edge Case Hunter): beyond 360 the
  // half-angle exceeds 180°, flipping leftAngle/rightAngle's atan2 ordering and
  // sweeping the arc's reflex side instead of the intended sector.
  const halfAngleRad = (Math.min(360, Math.max(0, angleDeg)) / 2) * (Math.PI / 180);
  const cosH = Math.cos(halfAngleRad);
  const sinH = Math.sin(halfAngleRad);
  const leftX = dirX * cosH - dirY * sinH;
  const leftY = dirX * sinH + dirY * cosH;
  const rightX = dirX * cosH + dirY * sinH;
  const rightY = -dirX * sinH + dirY * cosH;
  const leftAngle = Math.atan2(leftY, leftX);
  const rightAngle = Math.atan2(rightY, rightX);
  const degenerate = !(angleDeg > 0);

  return {
    view,
    update(now) {
      startedAt ??= now;
      const t = progress(now, startedAt, durationMs);
      // Clamped: an implode (maxRadius < startRadius) must not reach a negative radius.
      const radius = Math.max(0, startRadius + t * (maxRadius - startRadius));
      const a = alpha * (1 - t);
      view.clear();
      if (degenerate) {
        // A 0° cone has no area to fill/stroke as a sector — draw the line the
        // apex-point edge case reduces to instead of rendering nothing. A
        // filled caller legitimately passes `lineWidth: 0` (it never intends to
        // stroke); floor the degenerate line's width so it stays visible either
        // way — code review 2026-07-29 (Blind Hunter): `lineWidth: 0` would
        // otherwise stroke an invisible line, silently violating the "never
        // renders nothing" contract for the one input this branch exists to handle.
        view.moveTo(0, 0).lineTo(dirX * radius, dirY * radius).stroke({ color, width: Math.max(lineWidth, 2), alpha: a });
      } else if (filled) {
        // The initial lineTo must land on the arc's own start point (rightAngle),
        // not the far edge — PixiJS's Graphics.arc() (unlike HTML5 Canvas2D) never
        // inserts an implicit connecting segment from the current point to the
        // arc's start; it only appends the arc's own points (`buildArc` in
        // PixiJS's GraphicsPath). Landing on the wrong tip first left an
        // unwanted chord across the circle plus a canceling apex-to-tip edge
        // pair, which shoelace-area-tested at ~12% of the intended sector — a
        // thin sliver near the rim, not a wedge (code review 2026-07-30, live
        // manual test: cone shapes reported invisible).
        view.moveTo(0, 0)
          .lineTo(rightX * radius, rightY * radius)
          .arc(0, 0, radius, rightAngle, leftAngle)
          .lineTo(0, 0)
          .fill({ color, alpha: a });
      } else {
        // Same floor as the degenerate branch above — a `filled: false,
        // lineWidth: 0` caller would otherwise stroke an invisible sector,
        // silently violating the "never renders nothing" contract on this
        // sibling path (code review 2026-07-30, Blind Hunter + Edge Case Hunter).
        view.moveTo(0, 0)
          .lineTo(rightX * radius, rightY * radius)
          .arc(0, 0, radius, rightAngle, leftAngle)
          .lineTo(0, 0)
          .stroke({ color, width: Math.max(lineWidth, 2), alpha: a });
      }
      return t < 1;
    },
    dispose() {
      view.destroy();
    },
  };
}

// ── Beam ─────────────────────────────────────────────────────────────────────

export interface BeamParams extends VfxTriggerParams {
  toX: number;
  toY: number;
  /** Beam thickness. Default 4. */
  width?: number;
}

/** Origin→target beam that fades out. Use `angle`+`length` by computing the
 *  endpoint at the call site — the primitive stays a plain two-point line. */
export function createBeam(params: BeamParams): EffectHandle {
  const {
    x, y, toX, toY, color, durationMs,
    alpha = 1,
    width = 4,
  } = params;
  let startedAt = params.startedAt;

  // Static geometry drawn once in local space (like burst and ring, so that
  // repositioning the view moves the effect); only `alpha` changes per frame.
  const view = new Graphics();
  view.position.set(x, y);
  view.moveTo(0, 0).lineTo(toX - x, toY - y).stroke({ color, width });
  view.alpha = alpha;

  return {
    view,
    update(now) {
      startedAt ??= now;
      const t = progress(now, startedAt, durationMs);
      view.alpha = alpha * (1 - t);
      return t < 1;
    },
    dispose() {
      view.destroy();
    },
  };
}

// ── Tint pulse ───────────────────────────────────────────────────────────────
// Generalized from the ability-cast flash in DungeonScreen.tsx.

/** A display object that can be tinted — Graphics, Sprite, and friends. */
export type TintTarget = Container & { tint?: number };

export interface TintPulseParams {
  /** Display object to pulse. Owned by the caller — never destroyed here. */
  target: TintTarget;
  durationMs: number;
  /** Tint applied for the duration of the pulse. Omit to pulse alpha only. */
  color?: number;
  /** Alpha at the trough of the pulse. Default 0.2. */
  minAlpha?: number;
  /** Alpha at the peaks of the pulse. Default 1. */
  maxAlpha?: number;
  startedAt?: number;
}

export function createTintPulse(params: TintPulseParams): EffectHandle {
  const { target, durationMs, color, minAlpha = 0.2, maxAlpha = 1 } = params;
  let startedAt = params.startedAt;

  // Captured, not assumed: the caller's object may already be dimmed (frozen
  // player at 0.3, spirit form, mid-fade) and must come back to exactly that.
  const baseAlpha = target.alpha;
  const baseTint = target.tint;
  if (color !== undefined) target.tint = color;

  return {
    // Borrowed object: the engine must not add or remove it from the stage.
    view: null,
    update(now) {
      startedAt ??= now;
      const t = progress(now, startedAt, durationMs);
      // `1 - t` is the remaining fraction — same curve as the prior art's
      // 0.2 + 0.8 * |cos(π * remaining / duration)|, without dividing by duration.
      target.alpha = minAlpha + (maxAlpha - minAlpha) * Math.abs(Math.cos(Math.PI * (1 - t)));
      return t < 1;
    },
    dispose() {
      target.alpha = baseAlpha;
      if (color !== undefined && baseTint !== undefined) target.tint = baseTint;
    },
  };
}
