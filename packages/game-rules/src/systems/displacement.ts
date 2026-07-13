// Pure — no planck, no Colyseus, no I/O. Shared by Stone Wall's pull (Story
// 3.16) and Void Pulse's vacuum zone (Story 3.19). Always succeeds (plain
// return, no Result) — the zero-vector case is a valid, non-error input.
export function applyDisplacement(
  targetX: number, targetY: number,
  sourceX: number, sourceY: number,
  strength: number,
): { dx: number; dy: number } {
  const dx = sourceX - targetX;
  const dy = sourceY - targetY;
  const len = Math.sqrt(dx * dx + dy * dy);
  // Epsilon, not exact equality — near-coincident points still divide, just
  // with a numerically unstable (though magnitude-bounded) direction.
  if (len < 1e-6) return { dx: 0, dy: 0 };
  return { dx: (dx / len) * strength, dy: (dy / len) * strength };
}
