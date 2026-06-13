export class TickLoop {
  private tickCount = 0;
  private handle: ReturnType<typeof setInterval> | null = null;

  constructor(readonly tickRateHz: number) {}

  start(onTick: (tick: number) => void): void {
    const intervalMs = 1000 / this.tickRateHz;
    this.handle = setInterval(() => {
      this.tickCount++;
      onTick(this.tickCount);
    }, intervalMs);
  }

  stop(): void {
    if (this.handle !== null) {
      clearInterval(this.handle);
      this.handle = null;
    }
  }

  get currentTick(): number {
    return this.tickCount;
  }
}
