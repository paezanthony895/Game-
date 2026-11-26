import React, { useRef, useState } from 'react';
import type { GameSettings } from '../types/football';

export type ChargeActionKind = 'pass' | 'through' | 'cross' | 'shoot';

export interface TouchActionCallbacks {
  onMove: (x: number, y: number, sprintFromStick: boolean) => void;
  onPass: (power?: number) => void;
  onThrough: (power?: number) => void;
  onShootStart: () => void;
  onShootRelease: () => void;
  onCross: (power?: number) => void;
  onChargeStart?: (action: ChargeActionKind) => void;
  onChargeRelease?: (action: ChargeActionKind) => void;
  onSprintChange: (active: boolean) => void;
  onTackle: () => void;
  onSlide: () => void;
  onSwitch: () => void;
  onPressChange: (active: boolean) => void;
  onSkillMove?: () => void;
}

interface TouchControlsProps {
  settings: GameSettings['controls'];
  hasBall: boolean;
  shootCharging: boolean;
  shootChargePct: number;
  activeChargeAction?: ChargeActionKind | null;
  rotated90?: boolean;
  playerLayout?: 'single' | 'p1' | 'p2';
  playerBadge?: string;
  callbacks: TouchActionCallbacks;
}

export const TouchControls: React.FC<TouchControlsProps> = ({
  settings,
  hasBall,
  shootCharging,
  shootChargePct,
  activeChargeAction = null,
  rotated90 = false,
  playerLayout = 'single',
  playerBadge,
  callbacks,
}) => {
  const stickRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const [knobOffset, setKnobOffset] = useState({ x: 0, y: 0 });

  const isSplit2P = playerLayout === 'p1' || playerLayout === 'p2';
  const joyScale = isSplit2P ? settings.joystickSize * 0.84 : settings.joystickSize;
  const joyRadius = Math.round(52 * joyScale);
  const knobSize = Math.round(46 * joyScale);
  const btnScale = isSplit2P ? settings.buttonSize * 0.84 : settings.buttonSize;

  const vibrate = (ms = 12) => {
    if (settings.vibration && typeof navigator !== 'undefined' && navigator.vibrate) {
      navigator.vibrate(ms);
    }
  };

  const updateJoystick = (clientX: number, clientY: number) => {
    const el = stickRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const screenDx = (clientX - cx) * settings.sensitivity;
    const screenDy = (clientY - cy) * settings.sensitivity;
    const rawDx = rotated90 ? screenDy : screenDx;
    const rawDy = rotated90 ? -screenDx : screenDy;
    const dist = Math.hypot(rawDx, rawDy);
    const maxR = joyRadius;
    const clamped = Math.min(maxR, dist);
    const angle = Math.atan2(rawDy, rawDx);
    const kx = dist > 2 ? Math.cos(angle) * clamped : 0;
    const ky = dist > 2 ? Math.sin(angle) * clamped : 0;
    setKnobOffset({ x: kx, y: ky });

    const norm = clamped / maxR;
    const DEAD_ZONE = 0.08;
    if (norm < DEAD_ZONE) {
      callbacks.onMove(0, 0, false);
    } else {
      const smoothMag = Math.min(1, (norm - DEAD_ZONE) / (1 - DEAD_ZONE));
      callbacks.onMove(
        Math.cos(angle) * smoothMag,
        Math.sin(angle) * smoothMag,
        smoothMag > 0.86
      );
    }
  };

  const handleStickDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    activePointerId.current = e.pointerId;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleStickMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    updateJoystick(e.clientX, e.clientY);
  };

  const handleStickUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== e.pointerId) return;
    activePointerId.current = null;
    setKnobOffset({ x: 0, y: 0 });
    callbacks.onMove(0, 0, false);
  };

  const btnStyle = (diameter: number): React.CSSProperties => ({
    width: `${Math.round(diameter * btnScale)}px`,
    height: `${Math.round(diameter * btnScale)}px`,
  });

  const renderPowerRing = (isActive: boolean) => {
    if (!isActive || !shootCharging) return null;
    const pct = Math.max(0.1, Math.min(1, shootChargePct));
    const ringColor = pct > 0.85 ? '#EF4444' : pct > 0.55 ? '#FACC15' : '#34D399';
    return (
      <>
        <svg className="absolute inset-0 w-full h-full -rotate-90 pointer-events-none" viewBox="0 0 36 36">
          <circle
            cx="18"
            cy="18"
            r="16"
            fill="none"
            stroke={ringColor}
            strokeWidth="3.2"
            strokeDasharray={`${Math.round(pct * 100)}, 100`}
          />
        </svg>
        <div
          data-testid="button-power-meter"
          className="pointer-events-none absolute -top-6 left-1/2 -translate-x-1/2 w-14 h-2.5 rounded-full bg-slate-950/90 border border-white/40 overflow-hidden shadow-lg"
        >
          <div
            style={{ width: `${Math.round(pct * 100)}%` }}
            className={`h-full transition-none ${
              pct > 0.85
                ? 'bg-rose-500'
                : pct > 0.55
                  ? 'bg-amber-400'
                  : 'bg-emerald-400'
            }`}
          />
        </div>
      </>
    );
  };

  const joystickPosStyle: React.CSSProperties =
    playerLayout === 'p2'
      ? {
          width: joyRadius * 2,
          height: joyRadius * 2,
          right: `${settings.sideOffset + 195}px`,
          bottom: `${settings.bottomOffset + 46}px`,
        }
      : {
          width: joyRadius * 2,
          height: joyRadius * 2,
          left: `${settings.sideOffset + 10}px`,
          bottom: `${settings.bottomOffset + 46}px`,
        };

  const buttonsPosStyle: React.CSSProperties =
    playerLayout === 'p1'
      ? {
          left: `${settings.sideOffset + 108}px`,
          bottom: `${settings.bottomOffset + 46}px`,
        }
      : {
          right: `${settings.sideOffset + 10}px`,
          bottom: `${settings.bottomOffset + 46}px`,
        };

  const testIdPrefix =
    playerLayout === 'p2'
      ? 'touch-controls-p2'
      : playerLayout === 'p1'
      ? 'touch-controls-p1'
      : 'touch-controls-single';

  return (
    <div
      data-testid={testIdPrefix}
      className="pointer-events-none absolute inset-0 z-30 select-none touch-none"
    >
      {/* Virtual Joystick */}
      <div
        ref={stickRef}
        data-testid={`${testIdPrefix}-joystick`}
        onPointerDown={handleStickDown}
        onPointerMove={handleStickMove}
        onPointerUp={handleStickUp}
        onPointerCancel={handleStickUp}
        role="application"
        aria-label={
          playerLayout === 'p2'
            ? 'Joystick virtual Jugador 2'
            : 'Joystick virtual de movimiento'
        }
        style={joystickPosStyle}
        className={`pointer-events-auto absolute rounded-full border-2 flex items-center justify-center ${
          playerLayout === 'p2'
            ? 'border-cyan-400/45 bg-slate-950/55'
            : 'border-white/25 bg-slate-950/45'
        }`}
      >
        {playerBadge && (
          <span
            className={`pointer-events-none absolute -top-5 px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider shadow ${
              playerLayout === 'p2'
                ? 'bg-cyan-500 text-slate-950'
                : 'bg-emerald-500 text-slate-950'
            }`}
          >
            {playerBadge}
          </span>
        )}
        <div className="absolute inset-3 rounded-full border border-dashed border-white/15" />
        <div
          style={{
            width: knobSize,
            height: knobSize,
            transform: `translate(${knobOffset.x}px, ${knobOffset.y}px)`,
          }}
          className={`rounded-full border-2 border-white/70 shadow-lg ${
            playerLayout === 'p2' ? 'bg-cyan-500/80' : 'bg-emerald-500/75'
          }`}
        />
      </div>

      {/* Action Buttons Cluster */}
      <div
        data-testid={`${testIdPrefix}-actions`}
        style={buttonsPosStyle}
        className={`pointer-events-auto absolute flex flex-col ${
          playerLayout === 'p1' ? 'items-start' : 'items-end'
        } gap-2`}
      >
        {/* Top Row: Skill Move (Regate) + Cross/Press + Sprint */}
        <div className="flex items-center gap-2.5">
          {hasBall && callbacks.onSkillMove && (
            <button
              type="button"
              data-testid={`${testIdPrefix}-btn-skill`}
              aria-label="Regate especial (Bicicleta, Amague o Sombrerito)"
              onPointerDown={(e) => {
                e.preventDefault();
                vibrate(14);
                callbacks.onSkillMove?.();
              }}
              style={btnStyle(50)}
              className="relative rounded-full bg-fuchsia-600/90 border border-fuchsia-200/70 text-white text-[10px] font-extrabold tracking-tight active:scale-95 transition-transform flex items-center justify-center shadow-lg"
            >
              <span>REGATE</span>
            </button>
          )}

          {settings.scheme !== 'simplified' && (
            <button
              type="button"
              aria-label={hasBall ? 'Centrar' : 'Presión automática'}
              onPointerDown={(e) => {
                e.preventDefault();
                vibrate(10);
                if (hasBall) {
                  if (callbacks.onChargeStart) callbacks.onChargeStart('cross');
                  else callbacks.onCross(0.75);
                } else {
                  callbacks.onPressChange(true);
                }
              }}
              onPointerUp={() => {
                if (hasBall) {
                  if (callbacks.onChargeRelease) callbacks.onChargeRelease('cross');
                } else {
                  callbacks.onPressChange(false);
                }
              }}
              onPointerCancel={() => {
                if (hasBall) {
                  if (callbacks.onChargeRelease) callbacks.onChargeRelease('cross');
                } else {
                  callbacks.onPressChange(false);
                }
              }}
              style={btnStyle(50)}
              className="relative rounded-full bg-slate-900/80 border border-white/25 text-white text-[11px] font-bold tracking-tight active:scale-95 transition-transform flex items-center justify-center"
            >
              {renderPowerRing(activeChargeAction === 'cross')}
              <span>{hasBall ? 'CENTRO' : 'PRESIÓN'}</span>
            </button>
          )}

          <button
            type="button"
            aria-label="Sprint"
            onPointerDown={(e) => {
              e.preventDefault();
              vibrate(8);
              callbacks.onSprintChange(true);
            }}
            onPointerUp={() => callbacks.onSprintChange(false)}
            onPointerCancel={() => callbacks.onSprintChange(false)}
            style={btnStyle(52)}
            className="rounded-full bg-amber-500/85 border border-amber-200/60 text-slate-950 text-[11px] font-extrabold active:scale-95 transition-transform flex items-center justify-center"
          >
            SPRINT
          </button>
        </div>

        {/* Bottom Arc: Pass / Through / Shoot (All with Power Meter when user has ball) */}
        <div className="flex items-end gap-2.5">
          {settings.scheme === 'classic' && (
            <button
              type="button"
              aria-label={hasBall ? 'Pase en profundidad' : 'Barrida'}
              onPointerDown={(e) => {
                e.preventDefault();
                vibrate(14);
                if (hasBall) {
                  if (callbacks.onChargeStart) callbacks.onChargeStart('through');
                  else callbacks.onThrough(0.72);
                } else {
                  callbacks.onSlide();
                }
              }}
              onPointerUp={() => {
                if (hasBall && callbacks.onChargeRelease) {
                  callbacks.onChargeRelease('through');
                }
              }}
              onPointerCancel={() => {
                if (hasBall && callbacks.onChargeRelease) {
                  callbacks.onChargeRelease('through');
                }
              }}
              style={btnStyle(54)}
              className="relative rounded-full bg-sky-600/85 border border-sky-200/60 text-white text-[10px] font-bold active:scale-95 transition-transform flex items-center justify-center"
            >
              {renderPowerRing(activeChargeAction === 'through')}
              <span>{hasBall ? 'FILTRAR' : 'BARRIDA'}</span>
            </button>
          )}

          <button
            type="button"
            aria-label={hasBall ? 'Pasar' : 'Cambiar jugador'}
            onPointerDown={(e) => {
              e.preventDefault();
              vibrate(12);
              if (hasBall) {
                if (callbacks.onChargeStart) callbacks.onChargeStart('pass');
                else callbacks.onPass(0.68);
              } else {
                callbacks.onSwitch();
              }
            }}
            onPointerUp={() => {
              if (hasBall && callbacks.onChargeRelease) {
                callbacks.onChargeRelease('pass');
              }
            }}
            onPointerCancel={() => {
              if (hasBall && callbacks.onChargeRelease) {
                callbacks.onChargeRelease('pass');
              }
            }}
            style={btnStyle(60)}
            className="relative rounded-full bg-emerald-600/90 border border-emerald-200/70 text-white text-xs font-bold active:scale-95 transition-transform flex items-center justify-center shadow-lg"
          >
            {renderPowerRing(activeChargeAction === 'pass')}
            <span>{hasBall ? 'PASAR' : 'CAMBIAR'}</span>
          </button>

          <button
            type="button"
            aria-label={hasBall ? 'Disparar' : 'Entrada'}
            onPointerDown={(e) => {
              e.preventDefault();
              vibrate(16);
              if (hasBall) {
                if (callbacks.onChargeStart) callbacks.onChargeStart('shoot');
                else callbacks.onShootStart();
              } else {
                callbacks.onTackle();
              }
            }}
            onPointerUp={() => {
              if (hasBall) {
                if (callbacks.onChargeRelease) callbacks.onChargeRelease('shoot');
                else callbacks.onShootRelease();
              }
            }}
            onPointerCancel={() => {
              if (hasBall) {
                if (callbacks.onChargeRelease) callbacks.onChargeRelease('shoot');
                else callbacks.onShootRelease();
              }
            }}
            style={btnStyle(68)}
            className={`relative rounded-full border-2 text-white text-xs font-extrabold active:scale-95 transition-transform flex items-center justify-center shadow-xl ${
              hasBall
                ? 'bg-rose-600/90 border-rose-200/80'
                : 'bg-indigo-600/90 border-indigo-200/80'
            }`}
          >
            {renderPowerRing(activeChargeAction === 'shoot' || (!activeChargeAction && shootCharging))}
            <span>{hasBall ? 'TIRO' : 'ENTRADA'}</span>
          </button>
        </div>
      </div>
    </div>
  );
};
