import { describe, it, expect, vi, afterEach } from 'vitest';
import { TickLoop } from '../src/tick-loop.js';

describe('TickLoop', () => {
  afterEach(() => vi.useRealTimers());

  it('increments tick count on each tick', () => {
    vi.useFakeTimers();
    const loop = new TickLoop(20);
    const onTick = vi.fn();

    loop.start(onTick);
    vi.advanceTimersByTime(200); // 4 ticks at 20Hz (50ms each)
    loop.stop();

    expect(onTick).toHaveBeenCalledTimes(4);
    expect(loop.currentTick).toBe(4);
  });

  it('stops firing after stop() is called', () => {
    vi.useFakeTimers();
    const loop = new TickLoop(20);
    const onTick = vi.fn();

    loop.start(onTick);
    vi.advanceTimersByTime(100);
    loop.stop();
    vi.advanceTimersByTime(500);

    expect(onTick).toHaveBeenCalledTimes(2);
  });
});
