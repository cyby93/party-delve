import { useEffect, useRef, useState, useCallback } from 'react';
import type { InputEventMsg } from 'net-protocol';
import type { MobileSession } from '../session/mobile-session';
import type { GameState } from 'shared-types';

interface ControllerScreenProps {
  session: MobileSession | null;
  gameState: GameState | null;
}

const JOYSTICK_MAX_RADIUS = 60;
const DEADZONE_RADIUS = 8;
const INPUT_INTERVAL_MS = 33; // ~30hz throttle to match sim tick rate

interface InteractButtonProps {
  visible: boolean;
  onTap: () => void;
}

function InteractButton({ visible, onTap }: InteractButtonProps) {
  return (
    <div
      style={{
        position: 'absolute',
        top: 'env(safe-area-inset-top, 0px)',
        left: '10%',
        right: '10%',
        transform: visible ? 'translateY(0)' : 'translateY(-150%)',
        transition: 'transform 200ms ease-out',
        background: 'var(--bg-surface)',
        border: '2px solid var(--accent-spirit)',
        borderRadius: 8,
        minHeight: 44,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 30,
        boxShadow: '0 0 12px rgba(110,168,216,0.4)',
        pointerEvents: visible ? 'auto' : 'none',
        touchAction: 'manipulation',
      }}
      onPointerDown={e => { e.preventDefault(); onTap(); }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-md)',
          color: 'var(--text-primary)',
        }}
      >
        Interact
      </span>
    </div>
  );
}

export function ControllerScreen({ session, gameState }: ControllerScreenProps) {
  const myPlayer = gameState?.players.find(p => p.id === session?.playerId);
  const activePoi = myPlayer?.nearPoiId ?? null;
  const joystickZoneRef = useRef<HTMLDivElement>(null);

  // Refs for values read inside event handlers — avoids stale closure issues
  const activeTouchIdRef = useRef<number | null>(null);
  const joystickOriginRef = useRef<{ x: number; y: number } | null>(null);
  const lastSendTimeRef = useRef(0);
  const sessionRef = useRef(session);

  // State for visual rendering only; origin starts null so knob is hidden until first touch
  const [joystickOriginState, setJoystickOriginState] = useState<{ x: number; y: number } | null>(null);
  const [joystickKnobOffset, setJoystickKnobOffset] = useState({ x: 0, y: 0 });

  // Keep sessionRef in sync so event handlers always have the latest session
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  const sendJoystick = useCallback((nx: number, ny: number) => {
    const now = Date.now();
    if (now - lastSendTimeRef.current < INPUT_INTERVAL_MS) return;
    lastSendTimeRef.current = now;
    const s = sessionRef.current;
    if (!s) return;
    const msg: InputEventMsg = {
      type: 'input',
      event: { type: 'joystick', joystick: { x: nx, y: ny } },
    };
    s.sendInput(msg);
  }, []);

  const stopJoystick = useCallback(() => {
    activeTouchIdRef.current = null;
    joystickOriginRef.current = null;
    setJoystickOriginState(null);
    setJoystickKnobOffset({ x: 0, y: 0 });
    const s = sessionRef.current;
    if (!s) return;
    const msg: InputEventMsg = {
      type: 'input',
      event: { type: 'joystick', joystick: { x: 0, y: 0 } },
    };
    s.sendInput(msg);
  }, []);

  useEffect(() => {
    const el = joystickZoneRef.current;
    if (!el) return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (activeTouchIdRef.current !== null) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const origin = { x: touch.clientX - rect.left, y: touch.clientY - rect.top };
      activeTouchIdRef.current = touch.identifier;
      joystickOriginRef.current = origin;
      setJoystickKnobOffset({ x: 0, y: 0 });
      setJoystickOriginState(origin); // non-null → renders ring + knob
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      if (activeTouchIdRef.current === null) return;
      let activeTouch: Touch | undefined;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i]!.identifier === activeTouchIdRef.current) {
          activeTouch = e.touches[i];
          break;
        }
      }
      if (!activeTouch) return;

      const rect = el.getBoundingClientRect();
      const origin = joystickOriginRef.current;
      if (!origin) return;
      const dx = activeTouch.clientX - rect.left - origin.x;
      const dy = activeTouch.clientY - rect.top - origin.y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      const angle = Math.atan2(dy, dx);

      if (dist < DEADZONE_RADIUS) {
        setJoystickKnobOffset({ x: 0, y: 0 });
        sendJoystick(0, 0);
      } else {
        const clampedDist = Math.min(dist, JOYSTICK_MAX_RADIUS);
        setJoystickKnobOffset({
          x: Math.cos(angle) * clampedDist,
          y: Math.sin(angle) * clampedDist,
        });
        const norm = clampedDist / JOYSTICK_MAX_RADIUS;
        sendJoystick(Math.cos(angle) * norm, Math.sin(angle) * norm);
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i]!.identifier === activeTouchIdRef.current) {
          stopJoystick();
          break;
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });

    return () => {
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [sendJoystick, stopJoystick]);

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        background: 'var(--bg-base)',
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      <InteractButton
        visible={activePoi !== null}
        onTap={() => { /* TODO Story 2.2 — open POI UI */ }}
      />
      {/* Left zone — floating joystick (40% width) */}
      <div
        ref={joystickZoneRef}
        style={{
          width: '40%',
          height: '100%',
          position: 'relative',
          touchAction: 'none',
        }}
      >
        {joystickOriginState !== null ? (
          <>
            {/* Joystick outer ring at touch origin */}
            <div
              style={{
                position: 'absolute',
                left: joystickOriginState.x - JOYSTICK_MAX_RADIUS,
                top: joystickOriginState.y - JOYSTICK_MAX_RADIUS,
                width: JOYSTICK_MAX_RADIUS * 2,
                height: JOYSTICK_MAX_RADIUS * 2,
                borderRadius: '50%',
                border: '3px solid var(--interactive)',
                boxSizing: 'border-box',
                pointerEvents: 'none',
                opacity: 0.6,
              }}
            />
            {/* Joystick knob */}
            <div
              style={{
                position: 'absolute',
                left: joystickOriginState.x + joystickKnobOffset.x - 24,
                top: joystickOriginState.y + joystickKnobOffset.y - 24,
                width: 48,
                height: 48,
                borderRadius: '50%',
                background: 'var(--interactive)',
                boxShadow: '0 0 16px var(--interactive)',
                pointerEvents: 'none',
              }}
            />
          </>
        ) : (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 10,
              pointerEvents: 'none',
            }}
          >
            {/* Visible hint ring so the touch target is discoverable */}
            <div
              style={{
                width: JOYSTICK_MAX_RADIUS * 2,
                height: JOYSTICK_MAX_RADIUS * 2,
                borderRadius: '50%',
                border: '2px dashed var(--interactive)',
                opacity: 0.3,
                flexShrink: 0,
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-sm)',
                color: 'var(--text-secondary)',
                opacity: 0.4,
              }}
            >
              Move
            </span>
          </div>
        )}
      </div>

      {/* Right zone — 2×2 skill grid (60% width), non-interactive in hub */}
      <div
        style={{
          width: '60%',
          height: '100%',
          display: 'grid',
          gridTemplateColumns: '1fr 1fr',
          gridTemplateRows: '1fr 1fr',
          gap: 4,
          padding: 8,
          boxSizing: 'border-box',
        }}
      >
        {[0, 1, 2, 3].map(i => (
          <div
            key={i}
            style={{
              background: 'var(--bg-subtle)',
              borderRadius: 6,
              border: '1px solid var(--border)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              opacity: 0.6,
              pointerEvents: 'none',
            }}
          >
            <span
              style={{
                fontFamily: 'var(--font-body)',
                fontStyle: 'italic',
                fontSize: 'var(--text-base)',
                color: 'var(--text-secondary)',
              }}
            >
              —
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
