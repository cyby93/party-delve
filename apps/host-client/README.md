# host-client

The host client is the shared TV/monitor screen that all couch players watch during a session. It renders the game world, displays session state, and shows a connection-status indicator for the authoritative simulation server. It connects to `simulation-server` over WebSocket but holds no gameplay authority — all game state originates from the simulation server and is rendered here for display only.
