'use client';
import type { ControlCommand } from '@/lib/telemetry/protocol';

const BTN =
  'h-11 min-w-11 rounded-[var(--radius-chip)] border border-white/15 bg-white/5 text-white transition enabled:hover:bg-white/12 enabled:active:scale-[0.97] disabled:opacity-35';

export function ControlPad({
  canDrive,
  canEstop,
  onCommand,
}: {
  /** Nudge / nav / vision — requires control lock. */
  canDrive: boolean;
  /** E-STOP for any operator+ even without lock. */
  canEstop: boolean;
  onCommand: (cmd: ControlCommand) => void;
}) {
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
