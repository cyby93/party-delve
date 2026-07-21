import { useEffect, useRef, useState, useCallback } from 'react';
import type { InputEventMsg, BondNotificationMsg } from 'net-protocol';
import type { MobileSession } from '../session/mobile-session';
import type { GameState } from 'shared-types';
import type { ClassDef } from 'shared-types';
import type { AbilityInputType, ClassAbilityDef } from 'shared-types';
import { CLASS_DEFINITIONS, PlayerClass, SessionColor, DifficultyTier } from 'shared-types';
import type { RunProposal } from 'shared-types';
import type { CooldownState } from '../App';
import { SPIRIT_ABILITY_NAMES } from 'game-rules';

interface ControllerScreenProps {
  session: MobileSession | null;
  gameState: GameState | null;
  cooldowns: (CooldownState | null)[];
  bondNotification: BondNotificationMsg | null;
  inBondMoment: boolean;
  onContinue: () => void;
}

const JOYSTICK_MAX_RADIUS = 60;
const DEADZONE_RADIUS = 8;
const INPUT_INTERVAL_MS = 33; // ~30hz throttle to match sim tick rate

// ponytail: bounded last-resort recovery for a startDungeon failure that leaves
// gameState.runProposal unchanged (see deferred-work.md D1-4.13) — VotePopup can't rely on
// a server signal to unmount in that case, so it self-resets after this long. Comfortably
// exceeds a normal same-LAN vote-resolution round-trip (well under 1s in practice); revisit
// if this ever proves too short/long in real play.
const VOTE_ACCEPT_STUCK_TIMEOUT_MS = 6000;

const SKILL_JOYSTICK_RING_PX = 80;
const SKILL_JOYSTICK_KNOB_PX = 28;
const SKILL_JOYSTICK_RING_RADIUS = SKILL_JOYSTICK_RING_PX / 2;
// Independent from the movement joystick's DEADZONE_RADIUS (8px) — D-019 keeps these separately tunable.
const SKILL_CELL_DEADZONE_RADIUS = 10;

// iOS Safari never implements the Fullscreen API for arbitrary elements (only <video> gets
// webkitEnterFullscreen) — document.fullscreenEnabled is always false there, so the toggle
// button hides itself correctly, but the player still has no fullscreen path in a plain tab.
// navigator.standalone is a non-standard Apple-only flag: `false` means "iOS Safari, running
// as a regular browser tab" (undefined on every other browser/OS, `true` once the PWA is
// already installed to the Home Screen, where the manifest's display:'fullscreen' already
// takes over). Detected once at module load since it can't change during a session.
const IS_IOS_SAFARI_TAB = (navigator as Navigator & { standalone?: boolean }).standalone === false;

interface InteractButtonProps {
  visible: boolean;
  onTap: () => void;
  label?: string;
}

function InteractButton({ visible, onTap, label = 'Interact' }: InteractButtonProps) {
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
        {label}
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
  AUTO:     'var(--accent-spirit)',
  RELEASE:  'var(--accent-warm)',
  TAP:      'var(--border)',
  AIM_CAST: 'var(--accent-spirit)',  // hold-to-channel (Story 3.18) — continuous-while-held, joins AUTO's color family
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

export function ClassSelectionScreen({ onBack, onPickClass }: ClassSelectionScreenProps) {
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

interface DungeonEntranceScreenProps {
  session: MobileSession | null;
  onBack: () => void;
}

function DungeonEntranceScreen({ session, onBack }: DungeonEntranceScreenProps) {
  const [selectedDifficulty, setSelectedDifficulty] = useState<DifficultyTier>(DifficultyTier.NORMAL);

  const difficulties: Array<{ id: DifficultyTier; label: string }> = [
    { id: DifficultyTier.EASY,   label: 'Easy'   },
    { id: DifficultyTier.NORMAL, label: 'Normal' },
    { id: DifficultyTier.HARD,   label: 'Hard'   },
  ];

  function handlePropose() {
    if (!session) return;
    session.sendRunPropose({ type: 'run:propose', biome: 'grassland', difficulty: selectedDifficulty });
    onBack();
  }

  return (
    <div style={{ position: 'absolute', inset: 0, background: 'var(--bg-base)', zIndex: 50,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 24, padding: 24 }}>
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>
          Biome
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-md)', color: 'var(--text-primary)',
          border: '2px solid var(--accent-spirit)', borderRadius: 8, padding: '12px 24px',
          boxShadow: '0 0 12px rgba(110,168,216,0.3)' }}>
          Grassland
        </div>
      </div>
      <div>
        <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-xs)', color: 'var(--text-secondary)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: 2 }}>
          Difficulty
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {difficulties.map(d => (
            <button
              key={d.id}
              onPointerDown={e => { e.preventDefault(); setSelectedDifficulty(d.id); }}
              style={{
                fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
                minWidth: 80, minHeight: 44, borderRadius: 8, border: 'none', cursor: 'pointer',
                background: selectedDifficulty === d.id ? 'var(--interactive)' : 'var(--bg-surface)',
                color: selectedDifficulty === d.id ? 'var(--bg-base)' : 'var(--text-secondary)',
              }}
            >
              {d.label}
            </button>
          ))}
        </div>
      </div>
      <button
        onPointerDown={e => { e.preventDefault(); handlePropose(); }}
        style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-md)',
          width: '100%', minHeight: 56, borderRadius: 8, border: 'none', cursor: 'pointer',
          background: 'var(--interactive)', color: 'var(--bg-base)',
          boxShadow: '0 0 16px rgba(110,168,216,0.4)', touchAction: 'manipulation' }}
      >
        Propose Run
      </button>
      <button
        onPointerDown={e => { e.preventDefault(); onBack(); }}
        style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontSize: 'var(--text-sm)',
          background: 'none', border: 'none', color: 'var(--text-secondary)',
          cursor: 'pointer', minHeight: 44, touchAction: 'manipulation' }}
      >
        Back
      </button>
    </div>
  );
}

interface VotePopupProps {
  proposal: RunProposal;
  onAccept: () => void;
  onDecline: () => void;
}

function VotePopup({ proposal, onAccept, onDecline }: VotePopupProps) {
  const [hasAccepted, setHasAccepted] = useState(false);

  useEffect(() => {
    if (!hasAccepted) return;
    const timer = setTimeout(() => setHasAccepted(false), VOTE_ACCEPT_STUCK_TIMEOUT_MS);
    return () => clearTimeout(timer);
  }, [hasAccepted]);

  const difficultyLabel: Record<string, string> = { easy: 'Easy', normal: 'Normal', hard: 'Hard' };
  return (
    <div style={{ position: 'absolute', inset: 0, background: 'rgba(15,14,16,0.85)', zIndex: 60,
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 24 }}>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-xl)', color: 'var(--text-primary)' }}>
        Run Proposed
      </div>
      <div style={{ fontFamily: 'var(--font-body)', fontSize: 'var(--text-sm)', color: 'var(--text-secondary)', textAlign: 'center' }}>
        Grassland · {difficultyLabel[proposal.difficulty] ?? proposal.difficulty}
      </div>
      <div style={{ display: 'flex', gap: 12, width: '100%' }}>
        <button
          onPointerDown={e => { e.preventDefault(); onDecline(); }}
          style={{ flex: 1, minHeight: 56, borderRadius: 8, border: '1px solid var(--border)',
            background: 'var(--bg-surface)', color: 'var(--text-secondary)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
            cursor: 'pointer', touchAction: 'manipulation' }}
        >
          Decline
        </button>
        <button
          onPointerDown={e => {
            if (hasAccepted) return;
            e.preventDefault();
            setHasAccepted(true);
            onAccept();
          }}
          style={{ flex: 1, minHeight: 56, borderRadius: 8, border: 'none',
            background: hasAccepted ? 'var(--bg-surface)' : 'var(--interactive)',
            color: hasAccepted ? 'var(--text-secondary)' : 'var(--bg-base)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
            cursor: hasAccepted ? 'default' : 'pointer', touchAction: 'manipulation',
            opacity: hasAccepted ? 0.5 : 1, pointerEvents: hasAccepted ? 'none' : 'auto',
            boxShadow: hasAccepted ? 'none' : '0 0 16px rgba(110,168,216,0.4)' }}
        >
          {hasAccepted ? 'Waiting...' : 'Accept'}
        </button>
      </div>
    </div>
  );
}

interface SkillCellProps {
  index: number;
  ability: ClassAbilityDef | null;
  cooldownState: CooldownState | null;
  isInteractive: boolean;
  canHoldThroughCooldown: boolean;
  badgeBorderColor: string;
  onAbilityFire: (abilityIndex: number, dirX: number, dirY: number, isContinuous: boolean) => void;
  tapFlash: boolean;
  downedOverlay?: boolean;
  spiritName?: string | null;
  spiritGlowColor?: string;
}

function SkillCell({ index, ability, cooldownState: cd, isInteractive, canHoldThroughCooldown, badgeBorderColor, onAbilityFire, tapFlash, downedOverlay, spiritName, spiritGlowColor }: SkillCellProps) {
  const cellRef = useRef<HTMLDivElement>(null);
  const activeTouchRef = useRef<{ id: number; originX: number; originY: number; lastDirX: number; lastDirY: number; releaseFired: boolean } | null>(null);
  const autoIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [spawnOrigin, setSpawnOrigin] = useState<{ x: number; y: number } | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const now = Date.now();
  const isOnCooldown = cd !== null && cd.expiresAt > now;
  const isOnCooldownRef = useRef(isOnCooldown);
  isOnCooldownRef.current = isOnCooldown;
  const totalDuration = cd !== null ? cd.expiresAt - cd.startAt : 1;
  const elapsed = cd !== null ? now - cd.startAt : 0;
  const pctElapsed = Math.min(elapsed / totalDuration, 1);
  const degRevealed = Math.round(pctElapsed * 360);
  const countdownSeconds = cd !== null ? Math.ceil((cd.expiresAt - now) / 1000) : 0;

  useEffect(() => {
    const el = cellRef.current;
    if (!el || !canHoldThroughCooldown || ability === null) return;
    if (ability.inputType === 'TAP') return;

    const onTouchStart = (e: TouchEvent) => {
      e.preventDefault();
      if (activeTouchRef.current !== null) return;
      if (isOnCooldownRef.current) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const originX = touch.clientX - rect.left;
      const originY = touch.clientY - rect.top;
      activeTouchRef.current = {
        id: touch.identifier,
        originX,
        originY,
        lastDirX: 0,
        lastDirY: 0,
        releaseFired: false,
      };
      setSpawnOrigin({ x: originX, y: originY });
      setKnobOffset({ x: 0, y: 0 });
      if (ability.inputType === 'AUTO' || ability.inputType === 'AIM_CAST') {
        autoIntervalRef.current = setInterval(() => {
          const t = activeTouchRef.current;
          if (t) onAbilityFire(index, t.lastDirX, t.lastDirY, true);
        }, 33);
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const t = activeTouchRef.current;
      if (t === null) return;
      let touch: Touch | undefined;
      for (let i = 0; i < e.touches.length; i++) {
        if (e.touches[i]!.identifier === t.id) { touch = e.touches[i]; break; }
      }
      if (!touch) return;
      const rect = el.getBoundingClientRect();
      const rawX = touch.clientX - rect.left - t.originX;
      const rawY = touch.clientY - rect.top - t.originY;
      const dist = Math.sqrt(rawX * rawX + rawY * rawY);
      if (dist >= SKILL_CELL_DEADZONE_RADIUS) {
        const angle = Math.atan2(rawY, rawX);
        t.lastDirX = Math.cos(angle);
        t.lastDirY = Math.sin(angle);
        const clampedDist = Math.min(dist, SKILL_JOYSTICK_RING_RADIUS);
        setKnobOffset({ x: Math.cos(angle) * clampedDist, y: Math.sin(angle) * clampedDist });
      }
      // else: stay below deadzone — leave knobOffset at its last position (matches
      // lastDirX/lastDirY, which also holds steady here) instead of snapping to center,
      // so the visual never contradicts what's still firing.
    };

    const onTouchEnd = (e: TouchEvent) => {
      e.preventDefault();
      const t = activeTouchRef.current;
      if (t === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i]!.identifier === t.id) {
          if (ability.inputType === 'RELEASE' && !t.releaseFired) {
            t.releaseFired = true;
            onAbilityFire(index, t.lastDirX, t.lastDirY, false);
          }
          if (autoIntervalRef.current) {
            clearInterval(autoIntervalRef.current);
            autoIntervalRef.current = null;
          }
          activeTouchRef.current = null;
          setSpawnOrigin(null);
          setKnobOffset({ x: 0, y: 0 });
          break;
        }
      }
    };

    const onDocumentTouchEnd = (e: TouchEvent) => {
      const t = activeTouchRef.current;
      if (t === null) return;
      for (let i = 0; i < e.changedTouches.length; i++) {
        if (e.changedTouches[i]!.identifier === t.id) {
          if (ability.inputType === 'RELEASE' && !t.releaseFired) {
            t.releaseFired = true;
            onAbilityFire(index, t.lastDirX, t.lastDirY, false);
          }
          if (autoIntervalRef.current) {
            clearInterval(autoIntervalRef.current);
            autoIntervalRef.current = null;
          }
          activeTouchRef.current = null;
          setSpawnOrigin(null);
          setKnobOffset({ x: 0, y: 0 });
          break;
        }
      }
    };

    el.addEventListener('touchstart', onTouchStart, { passive: false });
    el.addEventListener('touchmove', onTouchMove, { passive: false });
    el.addEventListener('touchend', onTouchEnd, { passive: false });
    el.addEventListener('touchcancel', onTouchEnd, { passive: false });
    document.addEventListener('touchend', onDocumentTouchEnd, { passive: false });
    document.addEventListener('touchcancel', onDocumentTouchEnd, { passive: false });

    return () => {
      const t = activeTouchRef.current;
      if (t !== null && ability.inputType === 'RELEASE' && !t.releaseFired) {
        t.releaseFired = true;
        onAbilityFire(index, t.lastDirX, t.lastDirY, false);
      }
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
      document.removeEventListener('touchend', onDocumentTouchEnd);
      document.removeEventListener('touchcancel', onDocumentTouchEnd);
      if (autoIntervalRef.current) {
        clearInterval(autoIntervalRef.current);
        autoIntervalRef.current = null;
      }
      activeTouchRef.current = null;
      setSpawnOrigin(null);
      setKnobOffset({ x: 0, y: 0 });
    };
  }, [canHoldThroughCooldown, ability, index, onAbilityFire]);

  return (
    <div
      ref={cellRef}
      style={{
        position: 'relative',
        background: 'var(--bg-subtle)',
        borderRadius: 6,
        border: '1px solid var(--border)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
        alignItems: 'flex-start',
        padding: '6px 8px',
        opacity: ability !== null ? 1.0 : 0.6,
        pointerEvents: isInteractive && !isOnCooldown ? 'auto' : 'none',
        overflow: 'hidden',
        boxSizing: 'border-box',
        minHeight: 44,
        boxShadow: tapFlash && ability?.inputType === 'TAP'
          ? 'inset 0 0 0 2000px rgba(110,168,216,0.5)'
          : 'none',
      }}
      onPointerDown={e => {
        if (!isInteractive || ability === null) return;
        if (ability.inputType !== 'TAP') return;
        e.preventDefault();
        onAbilityFire(index, 0, 0, false);
      }}
    >
      {ability !== null ? (
        <div style={{ position: 'relative', zIndex: 9, display: 'flex', flexDirection: 'column' }}>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontStyle: 'italic',
              fontSize: 'var(--text-base)',
              color: 'var(--text-primary)',
              lineHeight: 1.2,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              width: '100%',
            }}
          >
            {ability.name}
          </span>
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 400,
              fontSize: 'var(--text-xs)',
              color: 'var(--text-secondary)',
              marginTop: 3,
              borderLeft: `3px solid ${badgeBorderColor}`,
              paddingLeft: 4,
              lineHeight: 1,
            }}
          >
            {ability.inputType}
          </span>
        </div>
      ) : (
        <span
          style={{
            fontFamily: 'var(--font-body)',
            fontStyle: 'italic',
            fontSize: 'var(--text-base)',
            color: 'var(--text-secondary)',
            margin: 'auto',
          }}
        >
          —
        </span>
      )}

      {/* Aiming ring+knob for AUTO/RELEASE/AIM_CAST held-type abilities */}
      {spawnOrigin !== null && ability !== null && (() => {
        const color = ability.inputType === 'RELEASE' ? 'var(--accent-warm)' : 'var(--accent-spirit)';
        const pulse = ability.inputType === 'AIM_CAST' ? 'skill-cell-pulse 1.2s ease-in-out infinite' : undefined;
        return (
          <>
            <div
              style={{
                position: 'absolute',
                left: spawnOrigin.x - SKILL_JOYSTICK_RING_RADIUS,
                top: spawnOrigin.y - SKILL_JOYSTICK_RING_RADIUS,
                width: SKILL_JOYSTICK_RING_PX,
                height: SKILL_JOYSTICK_RING_PX,
                borderRadius: '50%',
                border: `2px solid ${color}`,
                boxSizing: 'border-box',
                pointerEvents: 'none',
                zIndex: 8,
                animation: pulse,
              }}
            />
            <div
              style={{
                position: 'absolute',
                left: spawnOrigin.x + knobOffset.x - SKILL_JOYSTICK_KNOB_PX / 2,
                top: spawnOrigin.y + knobOffset.y - SKILL_JOYSTICK_KNOB_PX / 2,
                width: SKILL_JOYSTICK_KNOB_PX,
                height: SKILL_JOYSTICK_KNOB_PX,
                borderRadius: '50%',
                background: color,
                pointerEvents: 'none',
                zIndex: 8,
                animation: pulse,
              }}
            />
          </>
        );
      })()}
      {/* Cooldown overlay */}
      {isOnCooldown && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            borderRadius: 6,
            background: `conic-gradient(transparent ${degRevealed}deg, rgba(15,14,16,0.7) ${degRevealed}deg)`,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 5,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: 'var(--text-sm)',
              color: 'var(--text-primary)',
              textShadow: '0 1px 3px rgba(0,0,0,0.8)',
              pointerEvents: 'none',
            }}
          >
            {countdownSeconds}
          </span>
        </div>
      )}
      {/* Downed: lock overlay for cells 0-2 */}
      {downedOverlay && !spiritName && (
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(15,14,16,0.8)',
          borderRadius: 6,
          pointerEvents: 'none',
          zIndex: 10,
        }} />
      )}
      {/* Downed: spirit ability name on cell 3 */}
      {spiritName && (
        <div style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 6,
          border: `1px solid ${spiritGlowColor ?? 'rgba(231,76,60,0.25)'}`,
          boxShadow: `0 0 8px ${spiritGlowColor ?? 'rgba(231,76,60,0.25)'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          pointerEvents: 'none',
          zIndex: 10,
          padding: '4px 6px',
        }}>
          <span style={{
            fontFamily: 'var(--font-body)',
            fontWeight: 700,
            fontSize: 'var(--text-sm)',
            color: 'var(--text-primary)',
            textAlign: 'center',
          }}>
            {spiritName}
          </span>
        </div>
      )}
    </div>
  );
}

interface BondCardProps {
  bondNotification: BondNotificationMsg;
  bondName: string;
  partnerName: string;
  onContinue: () => void;
}

function BondCard({ bondNotification, bondName, partnerName, onContinue }: BondCardProps) {
  const [dismissReady, setDismissReady] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setDismissReady(true), 1500);
    return () => clearTimeout(t);
  }, []);
  const frameColor = bondNotification.bondColor;
  return (
    <div style={{
      position: 'absolute', inset: 0, zIndex: 70,
      background: 'var(--bg-base)',
      boxShadow: `inset 0 0 0 6px ${frameColor}, inset 0 0 40px ${frameColor}40`,
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      justifyContent: 'center', gap: 20, padding: '32px 24px', boxSizing: 'border-box',
    }}>
      <span style={{ fontFamily: 'var(--font-display)', fontSize: 28, color: 'var(--text-primary)', textAlign: 'center' }}>
        {bondName}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 400, fontStyle: 'italic', fontSize: 'var(--text-base)',
        color: 'var(--text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
        You and {partnerName} — {bondNotification.bondDescription}
      </span>
      <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-sm)',
        color: 'var(--text-primary)', textAlign: 'center' }}>
        {bondNotification.bondMechanic}
      </span>
      <button
        onPointerDown={e => { if (!dismissReady) return; e.preventDefault(); onContinue(); }}
        style={{
          marginTop: 16, width: '80%', minHeight: 48, borderRadius: 8,
          background: dismissReady ? 'var(--interactive)' : 'var(--bg-surface)',
          border: `2px solid ${dismissReady ? 'var(--accent-spirit)' : 'var(--border)'}`,
          color: dismissReady ? 'var(--bg-base)' : 'var(--text-secondary)',
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 'var(--text-md)',
          cursor: dismissReady ? 'pointer' : 'default',
          opacity: dismissReady ? 1 : 0.3,
          transition: 'opacity 0.3s ease-out, background 0.3s, color 0.3s',
          pointerEvents: dismissReady ? 'auto' : 'none',
          touchAction: 'manipulation',
        }}
      >
        Continue
      </button>
    </div>
  );
}

const SESSION_COLOR_GLOW: Record<SessionColor, string> = {
  [SessionColor.RED]:    'rgba(231,76,60,0.25)',
  [SessionColor.BLUE]:   'rgba(52,152,219,0.25)',
  [SessionColor.GREEN]:  'rgba(46,204,113,0.25)',
  [SessionColor.YELLOW]: 'rgba(241,196,15,0.25)',
  [SessionColor.PURPLE]: 'rgba(155,89,182,0.25)',
  [SessionColor.ORANGE]: 'rgba(230,126,34,0.25)',
  [SessionColor.PINK]:   'rgba(255,105,180,0.25)',
  [SessionColor.TEAL]:   'rgba(26,188,156,0.25)',
};

export function ControllerScreen({ session, gameState, cooldowns, bondNotification, inBondMoment, onContinue }: ControllerScreenProps) {
  const myPlayer = gameState?.players.find(p => p.id === session?.playerId) ?? null;
  const activePoi = myPlayer?.nearPoiId ?? null;
  const confirmedClass = myPlayer?.class ?? null;
  const classDef = confirmedClass !== null ? CLASS_DEFINITIONS[confirmedClass] : null;
  const isDown = myPlayer?.isDown ?? false;
  const isSpirit = myPlayer?.isSpirit ?? false;
  const isFrozen = myPlayer?.isFrozen ?? false;
  const hpFraction = myPlayer && myPlayer.maxHp > 0 ? myPlayer.hp / myPlayer.maxHp : 1;
  const bondedPartnerId = bondNotification
    ? (bondNotification.playerA === session?.playerId ? bondNotification.playerB : bondNotification.playerA)
    : null;
  const partnerName = bondedPartnerId
    ? (gameState?.players.find(p => p.id === bondedPartnerId)?.displayName ?? 'your partner')
    : null;
  const bondName = bondNotification
    ? (bondNotification.bondType === 'fate' ? 'Fate Bond' : 'Proximity Bond')
    : null;
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
  const [dungeonEntranceOpen, setDungeonEntranceOpen] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(() => document.fullscreenElement !== null);
  const [showIosHint, setShowIosHint] = useState(false);
  // Debug-only, dev-build-gated (see button render below) — local echo of what we last sent,
  // not a server-confirmed state (debug:toggle-god-mode has no ack/broadcast, by design).
  const [godModeSent, setGodModeSent] = useState(false);
  const inDungeon = gameState?.session.phase === 'dungeon';
  const [tapFlash, setTapFlash] = useState<boolean[]>([false, false, false, false]);
  const [displayTick, setDisplayTick] = useState(0);

  // Keep sessionRef in sync so event handlers always have the latest session
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    const handler = () => setIsFullscreen(document.fullscreenElement !== null);
    document.addEventListener('fullscreenchange', handler);
    return () => document.removeEventListener('fullscreenchange', handler);
  }, []);

  const toggleFullscreen = useCallback(() => {
    if (document.fullscreenElement) {
      document.exitFullscreen?.().catch(() => {});
    } else {
      document.documentElement.requestFullscreen?.().catch(() => {});
    }
  }, []);

  useEffect(() => {
    if (activePoi !== 'dungeon-entrance') {
      setDungeonEntranceOpen(false);
    }
  }, [activePoi]);

  // Close dungeon entrance screen when a vote starts so the VotePopup is never blocked.
  useEffect(() => {
    if (gameState?.runProposal != null) {
      setDungeonEntranceOpen(false);
    }
  }, [gameState?.runProposal]);

  // Force re-render while any cooldown is active, to update countdown displays
  const anyCooldownActive = cooldowns.some(cd => cd !== null && cd.expiresAt > Date.now());
  useEffect(() => {
    if (!anyCooldownActive) return;
    const interval = setInterval(() => {
      setDisplayTick(t => t + 1);
    }, 100);
    return () => clearInterval(interval);
  }, [anyCooldownActive]);

  // Suppress unused variable warning — displayTick is only used to trigger re-renders
  void displayTick;

  const handleAbilityFire = useCallback((abilityIndex: number, dirX: number, dirY: number, isContinuous: boolean) => {
    const s = sessionRef.current;
    if (!s) return;
    const msg: InputEventMsg = {
      type: 'input',
      event: { type: 'ability', ability: { abilityIndex, directionX: dirX, directionY: dirY } },
    };
    s.sendInput(msg);

    if (!isContinuous) {
      setTapFlash(prev => {
        const next = [...prev];
        next[abilityIndex] = true;
        return next;
      });
      setTimeout(() => {
        setTapFlash(prev => {
          const next = [...prev];
          next[abilityIndex] = false;
          return next;
        });
      }, 150);
    }
  }, []);

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
      if (activeTouchIdRef.current !== null) stopJoystick();
      el.removeEventListener('touchstart', onTouchStart);
      el.removeEventListener('touchmove', onTouchMove);
      el.removeEventListener('touchend', onTouchEnd);
      el.removeEventListener('touchcancel', onTouchEnd);
    };
  }, [sendJoystick, stopJoystick]);

  const glowColor = myPlayer ? (SESSION_COLOR_GLOW[myPlayer.sessionColor] ?? 'rgba(231,76,60,0.25)') : 'rgba(231,76,60,0.25)';
  const rootBg = (isDown || isSpirit)
    ? `radial-gradient(ellipse at center, ${glowColor} 0%, var(--bg-base) 60%)`
    : 'var(--bg-base)';

  return (
    <div
      style={{
        position: 'relative',
        height: '100%',
        display: 'flex',
        background: rootBg,
        touchAction: 'none',
        userSelect: 'none',
      }}
    >
      {/* HP strip — always visible in dungeon, proportional to hp/maxHp */}
      {inDungeon && myPlayer && (
        <div style={{
          position: 'absolute',
          top: 'env(safe-area-inset-top, 0px)',
          left: 0,
          right: 0,
          height: 6,
          background: 'var(--bg-subtle)',
          zIndex: 40,
          pointerEvents: 'none',
        }}>
          <div style={{
            height: '100%',
            width: `${hpFraction * 100}%`,
            background: 'var(--corruption-blood)',
            transition: 'width 150ms ease-out',
          }} />
        </div>
      )}
      <InteractButton
        visible={activePoi !== null || (inBondMoment && bondNotification === null)}
        label={inBondMoment && bondNotification === null ? 'Continue' : 'Interact'}
        onTap={() => {
          if (inBondMoment && bondNotification === null) { onContinue(); return; }
          if (activePoi === 'class-select') setClassSelectionOpen(true);
          if (activePoi === 'dungeon-entrance') setDungeonEntranceOpen(true);
        }}
      />
      {/* Debug-only: mirrors the server's NODE_ENV-gated debug:toggle-god-mode handler.
          import.meta.env.DEV is Vite's build-time flag (false in production builds), so this
          never ships — the client-side equivalent of the server's own env gate. */}
      {import.meta.env.DEV && (
        <div
          style={{
            position: 'absolute',
            top: 'env(safe-area-inset-top, 0px)',
            right: 44,
            width: 44,
            height: 44,
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
          }}
          onPointerDown={e => {
            e.preventDefault();
            session?.sendDebugToggleGodMode();
            setGodModeSent(v => !v);
          }}
        >
          <span style={{ fontSize: 18, color: godModeSent ? 'var(--accent-warm)' : 'var(--text-secondary)' }}>⚡</span>
        </div>
      )}
      {document.fullscreenEnabled && (
        <div
          style={{
            position: 'absolute',
            top: 'env(safe-area-inset-top, 0px)',
            right: 0,
            width: 44,
            height: 44,
            zIndex: 45,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            touchAction: 'manipulation',
          }}
          onPointerDown={e => { e.preventDefault(); toggleFullscreen(); }}
        >
          <span style={{ fontSize: 20, color: isFullscreen ? 'var(--accent-spirit)' : 'var(--text-secondary)' }}>⛶</span>
        </div>
      )}
      {/* iOS Safari (regular tab, not installed) can never support the Fullscreen API — show a
          tap-to-reveal hint pointing at the one path that actually works (Add to Home Screen)
          instead of a dead toggle. */}
      {!document.fullscreenEnabled && IS_IOS_SAFARI_TAB && (
        <div
          style={{
            position: 'absolute',
            top: 'env(safe-area-inset-top, 0px)',
            right: 0,
            zIndex: 45,
          }}
        >
          <div
            style={{
              width: 44,
              height: 44,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              touchAction: 'manipulation',
            }}
            onPointerDown={e => { e.preventDefault(); setShowIosHint(v => !v); }}
          >
            <span style={{ fontSize: 18, color: 'var(--text-secondary)' }}>ⓘ</span>
          </div>
          {showIosHint && (
            <div
              style={{
                position: 'absolute',
                top: 44,
                right: 0,
                width: 200,
                background: 'var(--bg-surface)',
                border: '1px solid var(--border)',
                borderRadius: 8,
                padding: '10px 12px',
                boxShadow: '0 4px 16px rgba(0,0,0,0.4)',
                touchAction: 'manipulation',
              }}
              onPointerDown={e => { e.preventDefault(); setShowIosHint(false); }}
            >
              <span style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'var(--text-xs)',
                color: 'var(--text-primary)',
                lineHeight: 1.4,
              }}>
                For fullscreen on iPhone: tap Share, then "Add to Home Screen".
              </span>
            </div>
          )}
        </div>
      )}
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

      {/* Right zone — 2×2 skill grid (60% width) */}
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
          touchAction: 'none',
          position: 'relative',
        }}
      >
        {[0, 1, 2, 3].map(i => {
          const isSpiritCell = isSpirit && i === 3;
          const baseAbility = classDef?.abilities[i] ?? null;
          // Spirit cell fires as TAP regardless of the class ability's input type
          const ability: ClassAbilityDef | null = (isSpiritCell && baseAbility !== null)
            ? { ...baseAbility, inputType: 'TAP' }
            : baseAbility;
          const cd = cooldowns[i] ?? null;
          const now = Date.now();
          const isOnCooldown = cd !== null && cd.expiresAt > now;
          const canHoldThroughCooldown = isSpiritCell
            ? !isFrozen && !inBondMoment
            : (!isDown && !isSpirit) && ability !== null && !inBondMoment;
          const isInteractive = canHoldThroughCooldown && !isOnCooldown;
          const badgeBorderColor = ability !== null
            ? (ability.inputType === 'AUTO' ? 'var(--accent-spirit)'
              : ability.inputType === 'RELEASE' ? 'var(--accent-warm)'
              : ability.inputType === 'AIM_CAST' ? 'var(--accent-spirit)'
              : 'var(--border)')
            : 'var(--border)';

          const spiritAbilityName = i === 3 && (isDown || isSpirit) && confirmedClass
            ? SPIRIT_ABILITY_NAMES[confirmedClass]
            : null;
          const glowColor = SESSION_COLOR_GLOW[myPlayer?.sessionColor ?? SessionColor.RED];

          return (
            <SkillCell
              key={i}
              index={i}
              ability={ability}
              cooldownState={isOnCooldown ? cd : null}
              isInteractive={isInteractive}
              canHoldThroughCooldown={canHoldThroughCooldown}
              badgeBorderColor={badgeBorderColor}
              onAbilityFire={handleAbilityFire}
              tapFlash={tapFlash[i] ?? false}
              downedOverlay={(isDown || isSpirit) && i < 3}
              spiritName={spiritAbilityName}
              spiritGlowColor={glowColor}
            />
          );
        })}
      </div>

      {/* Vote popup — shown to all players when a run is proposed */}
      {!inDungeon && (gameState?.runProposal ?? null) !== null && !dungeonEntranceOpen && (
        <VotePopup
          proposal={gameState!.runProposal!}
          onAccept={() => session?.sendVote({ type: 'run:vote', accept: true })}
          onDecline={() => session?.sendVote({ type: 'run:vote', accept: false })}
        />
      )}

      {/* Dungeon entrance screen */}
      {dungeonEntranceOpen && (
        <DungeonEntranceScreen
          session={session}
          onBack={() => setDungeonEntranceOpen(false)}
        />
      )}

      {/* Class selection overlay */}
      {classSelectionOpen && (
        <ClassSelectionScreen
          onBack={() => setClassSelectionOpen(false)}
          onPickClass={(classId) => {
            setClassSelectionOpen(false);
            const s = sessionRef.current;
            if (s) {
              s.sendClassSelect({ type: 'class:select', classId });
            }
          }}
        />
      )}

      {/* Bond card — bonded players only; sits above all other overlays */}
      {bondNotification !== null && bondName !== null && partnerName !== null && (
        <BondCard
          bondNotification={bondNotification}
          bondName={bondName}
          partnerName={partnerName}
          onContinue={onContinue}
        />
      )}
    </div>
  );
}
