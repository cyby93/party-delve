# telemetry

Lightweight telemetry package for party-delve. Provides a `track()` function and TypeScript types for all session funnel events. In local mode all events are logged to the console as `[telemetry] <JSON>`. The package is intentionally dependency-free so it can be imported by host-client, mobile-controller, and simulation-server without pulling in a heavy analytics SDK.
