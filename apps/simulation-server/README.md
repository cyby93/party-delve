# simulation-server

The authoritative simulation process for party-delve. It owns the tick loop, session state, and WebSocket connections. The server runs at 20 Hz and accepts connections from host-client and mobile-controller applications. No gameplay logic is wired up yet — this scaffold provides the WebSocket listener and fixed-rate tick loop that subsequent tasks (session join, input routing, movement, combat) will build on top of.
