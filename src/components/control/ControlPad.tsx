'use client';
import { useEffect, useRef, useState } from 'react';
import type { ControlCommand } from '@/lib/telemetry/protocol';
import { WebJoystick, type StickVec } from './WebJoystick';

const BTN =
  'h-11 min-w-11 rounded-[var(--radius-chip)] border border-white/15 bg-white/5 text-white transition enabled:hover:bg-white/12 enabled:active:scale-[0.97] disabled:opacity-35';

type DriveMode = 'pad' | 'joystick';

export function ControlPad({
  canDrive,
  canEstop,
  onCommand,
}: {
  /** Nudge / nav / vision — requires control lock. */
  canDrive: boolean;
  /** E-STOP only while this client holds the control lock. */
  canEstop: boolean;
  onCommand: (cmd: ControlCommand) => void;
}) {
  // Default joystick (mobile-friendly); D-pad remains one tap away.
  const [mode, setMode] = useState<DriveMode>('joystick');
  const stickRef = useRef<StickVec>({ lin: 0, ang: 0 });
  const streaming = useRef(false);
  const onCommandRef = useRef(onCommand);

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  // Keep nudge alive (~4 Hz) while the stick is held — dashboard pulses last 0.5 s.
  useEffect(() => {
    if (mode !== 'joystick' || !canDrive) return;
    const id = window.setInterval(() => {
      const v = stickRef.current;
      if (Math.abs(v.lin) > 0.02 || Math.abs(v.ang) > 0.02) {
        onCommandRef.current({ type: 'nudge', lin: v.lin, ang: v.ang });
      }
    }, 250);
    return () => window.clearInterval(id);
  }, [mode, canDrive]);

  useEffect(() => {
    if (canDrive) return;
    stickRef.current = { lin: 0, ang: 0 };
    streaming.current = false;
  }, [canDrive]);

  const onStick = (v: StickVec) => {
    stickRef.current = v;
    const moving = Math.abs(v.lin) > 0.02 || Math.abs(v.ang) > 0.02;
    if (moving) {
      streaming.current = true;
      onCommandRef.current({ type: 'nudge', lin: v.lin, ang: v.ang });
    } else if (streaming.current) {
      streaming.current = false;
      onCommandRef.current({ type: 'nudge', lin: 0, ang: 0 });
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <button
        type="button"
        className="h-12 w-full rounded-[var(--radius-chip)] bg-[var(--danger)] font-display text-[length:var(--text-button)] font-semibold tracking-wide text-white transition enabled:active:scale-[0.98] disabled:opacity-40"
        disabled={!canEstop}
        onClick={() => onCommand({ type: 'estop' })}
      >
        E-STOP
      </button>

      <div className="flex gap-1 rounded-[var(--radius-chip)] border border-white/10 p-1">
        {([
          ['joystick', 'Joystick'],
          ['pad', 'D-pad'],
        ] as const).map(([id, label]) => (
          <button
            key={id}
            type="button"
            className={`flex-1 rounded-[calc(var(--radius-chip)-2px)] py-2 text-[length:var(--text-small)] transition ${
              mode === id ? 'bg-white/15 text-white' : 'text-muted'
            }`}
            onClick={() => {
              stickRef.current = { lin: 0, ang: 0 };
              streaming.current = false;
              setMode(id);
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {mode === 'joystick' ? (
        <WebJoystick disabled={!canDrive} onVector={onStick} />
      ) : (
        <div className="mx-auto grid max-w-[160px] grid-cols-3 place-items-center gap-2">
          <span />
          <button type="button" className={BTN} disabled={!canDrive} aria-label="Forward" onClick={() => onCommand({ type: 'nudge', lin: 0.25, ang: 0 })}>
            ↑
          </button>
          <span />
          <button type="button" className={BTN} disabled={!canDrive} aria-label="Turn left" onClick={() => onCommand({ type: 'nudge', lin: 0, ang: 0.6 })}>
            ←
          </button>
          <button type="button" className={BTN} disabled={!canDrive} aria-label="Stop nudge" onClick={() => onCommand({ type: 'nudge', lin: 0, ang: 0 })}>
            ●
          </button>
          <button type="button" className={BTN} disabled={!canDrive} aria-label="Turn right" onClick={() => onCommand({ type: 'nudge', lin: 0, ang: -0.6 })}>
            →
          </button>
          <span />
          <button type="button" className={BTN} disabled={!canDrive} aria-label="Backward" onClick={() => onCommand({ type: 'nudge', lin: -0.2, ang: 0 })}>
            ↓
          </button>
          <span />
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`${BTN} px-3 text-[length:var(--text-small)]`} disabled={!canDrive} onClick={() => onCommand({ type: 'nav_cancel' })}>
          Cancel nav
        </button>
        <button type="button" className={`${BTN} px-3 text-[length:var(--text-small)]`} disabled={!canDrive} onClick={() => onCommand({ type: 'vision', on: true })}>
          Vision on
        </button>
        <button type="button" className={`${BTN} px-3 text-[length:var(--text-small)]`} disabled={!canDrive} onClick={() => onCommand({ type: 'vision', on: false })}>
          Vision off
        </button>
      </div>
    </div>
  );
}
