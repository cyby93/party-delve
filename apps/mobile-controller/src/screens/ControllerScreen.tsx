import { useEffect, useRef, useState, useCallback } from 'react';
import type { InputEventMsg } from 'net-protocol';
import type { MobileSession } from '../session/mobile-session';
import type { GameState } from 'shared-types';
import type { ClassDef } from 'shared-types';
import type { AbilityInputType, ClassAbilityDef } from 'shared-types';
import { CLASS_DEFINITIONS, PlayerClass } from 'shared-types';

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

interface ClassIconProps {
  classId: PlayerClass;
  isSelected: boolean;
}

function ClassIcon({ classId, isSelected }: ClassIconProps) {
  const stroke = isSelected ? 'var(--accent-spirit)' : 'var(--border)';

  switch (classId) {
    case PlayerClass.STONEHIDE:
      return (
        <svg width="44" height="44" viewBox="0 0 48 48" fill="none">
          <polygon points="24,6 44,40 4,40" stroke={stroke} strokeWidth="2" strokeLinejoin="round"/>
          <polygon points="24,14 36,36 12,36" stroke={stroke} strokeWidth="1.2" strokeLinejoin="round"/>
        </svg>
      );
    case PlayerClass.SPIRITCALLER:
      return (
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <circle cx="22" cy="24" r="14" stroke={stroke} strokeWidth="1.5" strokeDasharray="4 3"/>
          <circle cx="22" cy="24" r="5" stroke={stroke} strokeWidth="1.5"/>
          <line x1="22" y1="6" x2="22" y2="18" stroke={stroke} strokeWidth="1" strokeLinecap="round"/>
          <line x1="22" y1="30" x2="22" y2="42" stroke={stroke} strokeWidth="1" strokeLinecap="round"/>
        </svg>
      );
    case PlayerClass.SOULDRINKER:
      return (
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M22 4 C10 4 4 14 4 22 C4 32 22 44 22 44 C22 44 40 32 40 22 C40 14 34 4 22 4 Z"
            stroke={stroke} strokeWidth="1.8" strokeLinejoin="round"/>
          <circle cx="22" cy="20" r="5" stroke={stroke} strokeWidth="1.2"/>
        </svg>
      );
    case PlayerClass.STORMCALLER:
      return (
        <svg width="44" height="44" viewBox="0 0 44 44" fill="none">
          <path d="M22 4 L28 18 L42 18 L30 28 L34 42 L22 34 L10 42 L14 28 L2 18 L16 18 Z"
            stroke={stroke} strokeWidth="1.5" strokeLinejoin="round"/>
        </svg>
      );
    default:
      return null;
  }
}

interface ClassCardProps {
  def: ClassDef;
  isSelected: boolean;
  onTap: () => void;
}

function ClassCard({ def, isSelected, onTap }: ClassCardProps) {
  return (
    <div
      onPointerDown={e => { e.preventDefault(); onTap(); }}
      style={{
        width: 190,
        minWidth: 190,
        height: 190,
        background: isSelected ? 'var(--bg-subtle)' : 'var(--bg-surface)',
        border: isSelected ? '2px solid var(--accent-spirit)' : '1px solid var(--border)',
        borderRadius: 8,
        boxShadow: isSelected ? '0 0 12px rgba(110,168,216,0.25)' : 'none',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        padding: '0 0 12px 0',
        flexShrink: 0,
        overflow: 'hidden',
        touchAction: 'manipulation',
        cursor: 'pointer',
        scrollSnapAlign: 'center',
      }}
    >
      {/* Icon area */}
      <div
        style={{
          width: '100%',
          height: 66,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          borderBottom: '1px solid var(--border)',
          marginBottom: 10,
          background: isSelected ? 'var(--bg-subtle)' : 'transparent',
          flexShrink: 0,
        }}
      >
        <ClassIcon classId={def.id} isSelected={isSelected} />
      </div>

      {/* Class name — Uncial Antiqua md (20px) */}
      <span
        style={{
          fontFamily: 'var(--font-display)',
          fontSize: 'var(--text-md)',
          color: 'var(--text-primary)',
          textAlign: 'center',
          marginBottom: 4,
          padding: '0 8px',
        }}
      >
        {def.displayName}
      </span>

      {/* Role label — Lora 700 sm text-secondary */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          marginBottom: 8,
          padding: '0 8px',
        }}
      >
        {def.role}
      </span>

      {/* Flavor — Lora 400 italic sm text-secondary */}
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontStyle: 'italic',
          fontSize: 'var(--text-sm)',
          color: 'var(--text-secondary)',
          textAlign: 'center',
          lineHeight: 1.5,
          padding: '0 12px',
          overflow: 'hidden',
          display: '-webkit-box',
          WebkitLineClamp: 3,
          WebkitBoxOrient: 'vertical',
        }}
      >
        {def.flavor}
      </span>
    </div>
  );
}

const ABILITY_BADGE_BORDER: Record<AbilityInputType, string> = {
  AUTO:    'var(--accent-spirit)',
  RELEASE: 'var(--accent-warm)',
  TAP:     'var(--border)',
};

interface AbilityChipProps {
  ability: ClassAbilityDef;
}

function AbilityChip({ ability }: AbilityChipProps) {
  return (
    <div
      style={{
        background: 'var(--bg-subtle)',
        borderRadius: 4,
        padding: '6px 6px',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        borderLeft: `3px solid ${ABILITY_BADGE_BORDER[ability.inputType]}`,
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-body)',
          fontWeight: 700,
          fontSize: 'var(--text-sm)',
          color: 'var(--text-primary)',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {ability.name}
      </span>
      <span
        style={{
          display: 'inline-block',
          fontFamily: 'var(--font-body)',
          fontSize: 'var(--text-xs)',
          color: 'var(--text-secondary)',
          background: 'var(--border)',
          borderRadius: 4,
          padding: '1px 5px',
          alignSelf: 'flex-start',
          whiteSpace: 'nowrap',
        }}
      >
        {ability.inputType}
      </span>
    </div>
  );
}

interface ClassSelectionScreenProps {
  onBack: () => void;
  onPickClass: (classId: PlayerClass) => void;
}

function ClassSelectionScreen({ onBack, onPickClass }: ClassSelectionScreenProps) {
  const [selectedClass, setSelectedClass] = useState<PlayerClass | null>(null);
  const panelOpen = selectedClass !== null;
  const selectedDef = selectedClass !== null ? CLASS_DEFINITIONS[selectedClass] : null;

  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'var(--bg-base)',
        zIndex: 50,
        touchAction: 'auto',
        userSelect: 'none',
      }}
    >
      {/* Top bar */}
      <div
        style={{
          position: 'absolute',
          top: 0, left: 0, right: 0,
          height: 44,
          background: 'var(--bg-surface)',
          borderBottom: '1px solid var(--border)',
          display: 'flex',
          alignItems: 'center',
          padding: '0 16px',
          zIndex: 10,
        }}
      >
        <button
          onPointerDown={e => { e.preventDefault(); onBack(); }}
          style={{
            background: 'none',
            border: 'none',
            padding: '0 8px',
            minWidth: 44,
            minHeight: 44,
            cursor: 'pointer',
            fontFamily: 'var(--font-body)',
            fontSize: 'var(--text-sm)',
            color: 'var(--text-secondary)',
            display: 'flex',
            alignItems: 'center',
          }}
        >
          ← Back
        </button>
        <span
          style={{
            position: 'absolute',
            left: '50%',
            transform: 'translateX(-50%)',
            fontFamily: 'var(--font-display)',
            fontSize: 16,
            color: 'var(--text-primary)',
            whiteSpace: 'nowrap',
          }}
        >
          Choose Your Class
        </span>
      </div>

      {/* Card scroll area */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          left: 0,
          right: 0,
          bottom: panelOpen ? 130 : 0,
          overflowX: 'auto',
          overflowY: 'hidden',
          display: 'flex',
          alignItems: 'center',
          padding: '12px 24px',
          gap: 14,
          WebkitOverflowScrolling: 'touch',
          scrollSnapType: 'x mandatory',
          touchAction: 'pan-x',
          transition: 'bottom 200ms ease-out',
        }}
      >
        {(Object.values(CLASS_DEFINITIONS) as ClassDef[]).map(def => (
          <ClassCard
            key={def.id}
            def={def}
            isSelected={selectedClass === def.id}
            onTap={() => setSelectedClass(def.id)}
          />
        ))}
        {/* Trailing spacer so last card is not flush with right edge */}
        <div style={{ minWidth: 24, flexShrink: 0 }} />
      </div>

      {/* Right-edge fade */}
      <div
        style={{
          position: 'absolute',
          top: 44,
          right: 0,
          bottom: panelOpen ? 130 : 0,
          width: 80,
          background: 'linear-gradient(to right, transparent 0%, var(--bg-base) 100%)',
          pointerEvents: 'none',
          zIndex: 5,
          transition: 'bottom 200ms ease-out',
        }}
      />

      {/* Ability panel */}
      <div
        style={{
          position: 'absolute',
          bottom: 0, left: 0, right: 0,
          height: 130,
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--border)',
          transform: panelOpen ? 'translateY(0)' : 'translateY(100%)',
          transition: 'transform 200ms ease-out',
          display: 'flex',
          zIndex: 10,
        }}
      >
        {selectedDef !== null && (
          <>
            {/* Left ~80%: ability chips + role hint */}
            <div
              style={{
                flex: '0 0 80%',
                padding: '12px 14px 10px 16px',
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(4, 1fr)',
                  gap: 6,
                  flex: 1,
                }}
              >
                {selectedDef.abilities.map((ab, i) => (
                  <AbilityChip key={i} ability={ab} />
                ))}
              </div>
              <p
                style={{
                  fontFamily: 'var(--font-body)',
                  fontSize: 'var(--text-xs)',
                  color: 'var(--text-secondary)',
                  margin: 0,
                  paddingTop: 2,
                }}
              >
                {selectedDef.role}
              </p>
            </div>

            {/* Right ~20%: pick button */}
            <div
              style={{
                flex: '0 0 20%',
                borderLeft: '1px solid var(--border)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '10px 10px',
                gap: 6,
              }}
            >
              <button
                onPointerDown={e => { e.preventDefault(); onPickClass(selectedDef.id); }}
                style={{
                  width: '100%',
                  minHeight: 48,
                  background: 'var(--interactive)',
                  border: 'none',
                  borderRadius: 6,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  touchAction: 'manipulation',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-body)',
                    fontWeight: 700,
                    fontSize: 11,
                    color: 'var(--bg-base)',
                    letterSpacing: '0.02em',
                    textAlign: 'center',
                    lineHeight: 1.3,
                  }}
                >
                  Pick Selected Class
                </span>
              </button>
            </div>
          </>
        )}
      </div>
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
  const [classSelectionOpen, setClassSelectionOpen] = useState(false);

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
        onTap={() => {
          if (activePoi === 'class-select') setClassSelectionOpen(true);
          // training-dummy and dungeon-entrance handled in future stories
        }}
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

      {/* Class selection overlay */}
      {classSelectionOpen && (
        <ClassSelectionScreen
          onBack={() => setClassSelectionOpen(false)}
          onPickClass={(_classId) => {
            setClassSelectionOpen(false);
            // TODO Story 2.3 — send class:selected message to sim server and persist class
          }}
        />
      )}
    </div>
  );
}
