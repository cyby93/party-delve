import type { TelemetryEvent } from './events';

export function track(event: TelemetryEvent): void {
  console.log(`[telemetry] ${JSON.stringify(event)}`);
}
