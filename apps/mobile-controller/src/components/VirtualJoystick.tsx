import { useRef, useState } from 'react';

const OUTER_DIAMETER = 140;
const KNOB_DIAMETER = 52;
const OUTER_RADIUS = OUTER_DIAMETER / 2;
const KNOB_RADIUS = KNOB_DIAMETER / 2;
const MAX_OFFSET = OUTER_RADIUS - KNOB_RADIUS;

interface Props {
  onDirectionChange: (dir: { x: number; y: number }) => void;
  onRelease: () => void;
}

export function VirtualJoystick({ onDirectionChange, onRelease }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const activePointerRef = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  function fromPointer(clientX: number, clientY: number) {
    const el = containerRef.current;
    if (!el) return { rawX: 0, rawY: 0, mag: 0 };
    const rect = el.getBoundingClientRect();
    const rawX = clientX - (rect.left + OUTER_RADIUS);
    const rawY = clientY - (rect.top + OUTER_RADIUS);
    return { rawX, rawY, mag: Math.hypot(rawX, rawY) };
  }

  function clampedKnob(clientX: number, clientY: number) {
    const { rawX, rawY, mag } = fromPointer(clientX, clientY);
    if (mag <= MAX_OFFSET) return { x: rawX, y: rawY };
    return { x: (rawX / mag) * MAX_OFFSET, y: (rawY / mag) * MAX_OFFSET };
  }

  function unitDir(clientX: number, clientY: number): { x: number; y: number } {
    const { rawX, rawY, mag } = fromPointer(clientX, clientY);
    if (mag === 0) return { x: 0, y: 0 };
    const clampedMag = Math.min(mag, MAX_OFFSET);
    const norm = clampedMag / MAX_OFFSET;
    return { x: (rawX / mag) * norm, y: (rawY / mag) * norm };
  }

  function handlePointerDown(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== null) return;
    activePointerRef.current = e.pointerId;
    e.currentTarget.setPointerCapture(e.pointerId);
    setKnobOffset(clampedKnob(e.clientX, e.clientY));
    onDirectionChange(unitDir(e.clientX, e.clientY));
  }

  function handlePointerMove(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== e.pointerId) return;
    setKnobOffset(clampedKnob(e.clientX, e.clientY));
    onDirectionChange(unitDir(e.clientX, e.clientY));
  }

  function handlePointerUp(e: React.PointerEvent<HTMLDivElement>) {
    if (activePointerRef.current !== e.pointerId) return;
    activePointerRef.current = null;
    setKnobOffset({ x: 0, y: 0 });
    onRelease();
  }

  return (
    <div
      ref={containerRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        position: 'relative',
        width: OUTER_DIAMETER,
        height: OUTER_DIAMETER,
        borderRadius: '50%',
        background: 'rgba(255,255,255,0.08)',
        border: '2px solid rgba(255,255,255,0.18)',
        touchAction: 'none',
        userSelect: 'none',
        flexShrink: 0,
      }}
    >
      <div
        style={{
          position: 'absolute',
          width: KNOB_DIAMETER,
          height: KNOB_DIAMETER,
          borderRadius: '50%',
          background: 'rgba(255,255,255,0.55)',
          border: '2px solid rgba(255,255,255,0.8)',
          left: OUTER_RADIUS - KNOB_RADIUS + knobOffset.x,
          top: OUTER_RADIUS - KNOB_RADIUS + knobOffset.y,
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}
