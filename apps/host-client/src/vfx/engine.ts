import type { EffectHandle, VfxStage } from './types';

/**
 * Owns every live effect. Call `update(now)` once per ticker frame; completed
 * effects remove themselves from the stage and are destroyed.
 *
 * No allocation per frame for an already-active effect — handles are mutated in
 * place, exactly like the Map-and-mutate entity rendering in DungeonScreen.tsx.
 */
export class VfxEngine {
  private readonly effects = new Map<number, EffectHandle>();
  private nextId = 1;

  constructor(private readonly stage: VfxStage) {}

  /** Number of live effects — the count that must return to its pre-trigger value. */
  get size(): number {
    return this.effects.size;
  }

  /** Hand an effect to the engine. Returns its id so callers can cancel early. */
  add(handle: EffectHandle): number {
    const id = this.nextId++;
    if (handle.view) this.stage.addChild(handle.view);
    this.effects.set(id, handle);
    return id;
  }

  update(now: number): void {
    for (const [id, handle] of this.effects) {
      // A single misbehaving effect must not abort the loop: everything after it
      // would then never advance or be reaped, and the throw would repeat every
      // frame. Reap the offender instead and keep the rest of the frame alive.
      let alive: boolean;
      try {
        alive = handle.update(now);
      } catch (err) {
        console.error('[vfx] effect update failed, reaping it', err);
        alive = false;
      }
      if (!alive) this.remove(id);
    }
  }

  /** Stop and destroy a single effect early (e.g. its source entity vanished). */
  remove(id: number): void {
    const handle = this.effects.get(id);
    if (!handle) return;
    this.effects.delete(id);
    try {
      if (handle.view) this.stage.removeChild(handle.view);
      handle.dispose();
    } catch (err) {
      console.error('[vfx] effect disposal failed', err);
    }
  }

  /** Tear everything down — call when the Pixi app is destroyed. */
  clear(): void {
    for (const id of [...this.effects.keys()]) this.remove(id);
  }
}
