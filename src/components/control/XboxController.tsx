'use client';

import { useEffect, useRef, useState, type MutableRefObject, type PointerEvent as ReactPointerEvent, type RefObject } from 'react';
import {
  joyActive,
  leftKnobOffset,
  rightKnobOffset,
  screenToLeftStick,
  screenToRightStick,
} from '@/lib/control/joy-axes';

export type JoyReading = { a: number[]; b: number };

const ZERO: JoyReading = { a: [0, 0, 0, 0, 0, 0, 0, 0], b: 0 };

/** Bits match web_gamepad_node / Dashboard physical pad (A=0 B=1 X=2 Y=3 LB=4 RB=5 …). */
const BIT = { A: 0, B: 1, X: 2, Y: 3, LB: 4, RB: 5, View: 6, Menu: 7 } as const;

type Props = {
  open: boolean;
  onClose?: () => void;
  canEdit: boolean;
  padLabel: 'none' | 'connected' | 'idle';
  physical: JoyReading | null;
  /** Written while the on-screen pad is driving; null when idle so a real pad can take over. */
  virtualRef: MutableRefObject<JoyReading | null>;
  /** `page` = full-window mobile controller (no scrim). */
  variant?: 'overlay' | 'page';
};

export function XboxController({ open, onClose, canEdit, padLabel, physical, virtualRef, variant = 'overlay' }: Props) {
  const [virt, setVirt] = useState<JoyReading>(ZERO);
  const [wasOpen, setWasOpen] = useState(open);
  const drag = useRef<{ stick: 'L' | 'R'; pointerId: number } | null>(null);
  const leftRef = useRef<HTMLDivElement>(null);
  const rightRef = useRef<HTMLDivElement>(null);

  // Reset pad state when the modal closes (allowed during render — avoids set-state-in-effect lint).
  if (open !== wasOpen) {
    setWasOpen(open);
    if (!open) setVirt(ZERO);
  }

  useEffect(() => {
    if (!open) {
      virtualRef.current = null;
      return;
    }
    return () => { virtualRef.current = null; };
  }, [open, virtualRef]);

  useEffect(() => {
    if (!open || !onClose) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  const live = joyActive(virt.a, virt.b) ? virt : (physical ?? virt);
  const lx = live.a[0] ?? 0;
  const ly = live.a[1] ?? 0;
  const rx = live.a[2] ?? 0;
  const ry = live.a[3] ?? 0;
  const lt = live.a[4] ?? 0;
  const rt = live.a[5] ?? 0;
  const pressed = (bit: number) => (live.b & (1 << bit)) !== 0;
  const lk = leftKnobOffset(lx, ly);
  const rk = rightKnobOffset(rx, ry);

  const patchAxes = (write: (a: number[]) => void) => {
    if (!canEdit) return;
    setVirt((prev) => {
      const a = [...prev.a];
      write(a);
      const next = { a, b: prev.b };
      virtualRef.current = joyActive(next.a, next.b) ? next : null;
      return next;
    });
  };

  const setBit = (bit: number, on: boolean) => {
    if (!canEdit) return;
    setVirt((prev) => {
      const b = on ? (prev.b | (1 << bit)) : (prev.b & ~(1 << bit));
      const next = { a: [...prev.a], b };
      virtualRef.current = canEdit && joyActive(next.a, next.b) ? next : null;
      return next;
    });
  };

  const setTrigger = (side: 'LT' | 'RT', v: number) => {
    patchAxes((a) => { a[side === 'LT' ? 4 : 5] = Math.max(0, Math.min(1, v)); });
  };

  const onStickDown = (stick: 'L' | 'R', el: HTMLDivElement | null, e: ReactPointerEvent) => {
    if (!canEdit || !el) return;
    el.setPointerCapture(e.pointerId);
    drag.current = { stick, pointerId: e.pointerId };
    moveStick(stick, el, e.clientX, e.clientY);
  };

  const moveStick = (stick: 'L' | 'R', el: HTMLDivElement, cx: number, cy: number) => {
    const r = el.getBoundingClientRect();
    const dx = (cx - (r.left + r.width / 2)) / (r.width / 2);
    const dy = (cy - (r.top + r.height / 2)) / (r.height / 2);
    const mag = Math.hypot(dx, dy) || 1;
    const s = mag > 1 ? 1 / mag : 1;
    const nx = dx * s;
    const ny = dy * s;
    patchAxes((a) => {
      if (stick === 'L') {
        const p = screenToLeftStick(nx, ny);
        a[0] = p.x; a[1] = p.y;
      } else {
        const p = screenToRightStick(nx, ny);
        a[2] = p.x; a[3] = p.y;
      }
    });
  };

  const onStickMove = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    const el = d.stick === 'L' ? leftRef.current : rightRef.current;
    if (el) moveStick(d.stick, el, e.clientX, e.clientY);
  };

  const onStickUp = (e: ReactPointerEvent) => {
    const d = drag.current;
    if (!d || d.pointerId !== e.pointerId) return;
    drag.current = null;
    patchAxes((a) => {
      if (d.stick === 'L') { a[0] = 0; a[1] = 0; }
      else { a[2] = 0; a[3] = 0; }
    });
  };

  if (!open) return null;

  const status =
    !canEdit ? 'Take control to drive with this pad'
      : padLabel === 'connected' ? 'Streaming joy → web_gamepad / bridge'
        : 'Touch sticks to stream joy commands';

  const panel = (
      <div className={`xb-panel glass-liquid ${variant === 'page' ? 'xb-page' : ''}`} onClick={variant === 'overlay' ? (e) => e.stopPropagation() : undefined}>
        <div className="xb-head">
          <div>
            <h3>Xbox controller</h3>
            <p className="xb-status">{status}</p>
          </div>
          {variant === 'overlay' && onClose ? (
            <button type="button" className="btn ghost" onClick={onClose}>Close</button>
          ) : null}
        </div>

        <div className={`xb-body ${canEdit ? '' : 'locked'}`} aria-disabled={!canEdit}>
          <div className="xb-triggers">
            <button type="button" className={`xb-trig ${lt > 0.1 ? 'on' : ''}`} style={{ ['--p' as string]: `${lt * 100}%` }} onPointerDown={() => setTrigger('LT', 1)} onPointerUp={() => setTrigger('LT', 0)} onPointerLeave={() => setTrigger('LT', 0)}>LT</button>
            <button type="button" className={`xb-trig ${rt > 0.1 ? 'on' : ''}`} style={{ ['--p' as string]: `${rt * 100}%` }} onPointerDown={() => setTrigger('RT', 1)} onPointerUp={() => setTrigger('RT', 0)} onPointerLeave={() => setTrigger('RT', 0)}>RT</button>
          </div>

          <div className="xb-bumpers">
            <Face label="LB" on={pressed(BIT.LB)} onDown={() => setBit(BIT.LB, true)} onUp={() => setBit(BIT.LB, false)} wide />
            <Face label="RB" on={pressed(BIT.RB)} onDown={() => setBit(BIT.RB, true)} onUp={() => setBit(BIT.RB, false)} wide />
          </div>

          <div className="xb-core">
            <Stick refEl={leftRef} ox={lk.x} oy={lk.y} label="LS" onDown={(e) => onStickDown('L', leftRef.current, e)} onMove={onStickMove} onUp={onStickUp} />
            <div className="xb-center">
              <Face label="⧉" on={pressed(BIT.View)} onDown={() => setBit(BIT.View, true)} onUp={() => setBit(BIT.View, false)} tiny />
              <div className="xb-logo" aria-hidden />
              <Face label="☰" on={pressed(BIT.Menu)} onDown={() => setBit(BIT.Menu, true)} onUp={() => setBit(BIT.Menu, false)} tiny />
            </div>
            <div className="xb-face">
              <Face label="Y" on={pressed(BIT.Y)} onDown={() => setBit(BIT.Y, true)} onUp={() => setBit(BIT.Y, false)} className="xb-y" />
              <Face label="X" on={pressed(BIT.X)} onDown={() => setBit(BIT.X, true)} onUp={() => setBit(BIT.X, false)} className="xb-x" />
              <Face label="B" on={pressed(BIT.B)} onDown={() => setBit(BIT.B, true)} onUp={() => setBit(BIT.B, false)} className="xb-b" />
              <Face label="A" on={pressed(BIT.A)} onDown={() => setBit(BIT.A, true)} onUp={() => setBit(BIT.A, false)} className="xb-a" />
            </div>
          </div>

          <div className="xb-lower">
            <Dpad
              up={(live.a[7] ?? 0) > 0.5}
              down={(live.a[7] ?? 0) < -0.5}
              left={(live.a[6] ?? 0) > 0.5}
              right={(live.a[6] ?? 0) < -0.5}
              on={(dir, on) => {
                patchAxes((a) => {
                  if (dir === 'up') a[7] = on ? 1 : 0;
                  if (dir === 'down') a[7] = on ? -1 : 0;
                  if (dir === 'left') a[6] = on ? 1 : 0;
                  if (dir === 'right') a[6] = on ? -1 : 0;
                });
              }}
            />
            <Stick refEl={rightRef} ox={rk.x} oy={rk.y} label="RS" onDown={(e) => onStickDown('R', rightRef.current, e)} onMove={onStickMove} onUp={onStickUp} />
          </div>
        </div>

        <p className="xb-hint">
          Left stick → drive · A seq · B save map · X vision · Y / shoulders IMU · matches web_gamepad_node
        </p>
      </div>
  );

  if (variant === 'page') {
    return <div className="xb-page-root" aria-label="Xbox controller">{panel}</div>;
  }

  return (
    <div className="xb-scrim" role="dialog" aria-modal="true" aria-label="Xbox controller" onClick={onClose}>
      {panel}
    </div>
  );
}

function Face({
  label, on, onDown, onUp, wide, tiny, className = '',
}: {
  label: string; on: boolean; onDown: () => void; onUp: () => void;
  wide?: boolean; tiny?: boolean; className?: string;
}) {
  return (
    <button
      type="button"
      className={`xb-btn ${wide ? 'wide' : ''} ${tiny ? 'tiny' : ''} ${on ? 'on' : ''} ${className}`}
      onPointerDown={(e) => { e.preventDefault(); onDown(); }}
      onPointerUp={onUp}
      onPointerLeave={onUp}
      onPointerCancel={onUp}
    >{label}</button>
  );
}

function Stick({
  refEl, ox, oy, label, onDown, onMove, onUp,
}: {
  refEl: RefObject<HTMLDivElement | null>;
  ox: number; oy: number; label: string;
  onDown: (e: ReactPointerEvent) => void;
  onMove: (e: ReactPointerEvent) => void;
  onUp: (e: ReactPointerEvent) => void;
}) {
  return (
    <div
      ref={refEl}
      className="xb-stick"
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onUp}
      onPointerCancel={onUp}
    >
      <span className="xb-stick-label">{label}</span>
      <i style={{ transform: `translate(${ox}px, ${oy}px)` }} />
    </div>
  );
}

function Dpad({
  up, down, left, right, on,
}: {
  up: boolean; down: boolean; left: boolean; right: boolean;
  on: (dir: 'up' | 'down' | 'left' | 'right', pressed: boolean) => void;
}) {
  return (
    <div className="xb-dpad" aria-label="D-pad">
      <button type="button" className={`xb-d ${up ? 'on' : ''}`} style={{ gridArea: 'u' }} aria-label="Up" onPointerDown={() => on('up', true)} onPointerUp={() => on('up', false)} onPointerLeave={() => on('up', false)} />
      <button type="button" className={`xb-d ${left ? 'on' : ''}`} style={{ gridArea: 'l' }} aria-label="Left" onPointerDown={() => on('left', true)} onPointerUp={() => on('left', false)} onPointerLeave={() => on('left', false)} />
      <span className="xb-d-mid" style={{ gridArea: 'm' }} />
      <button type="button" className={`xb-d ${right ? 'on' : ''}`} style={{ gridArea: 'r' }} aria-label="Right" onPointerDown={() => on('right', true)} onPointerUp={() => on('right', false)} onPointerLeave={() => on('right', false)} />
      <button type="button" className={`xb-d ${down ? 'on' : ''}`} style={{ gridArea: 'd' }} aria-label="Down" onPointerDown={() => on('down', true)} onPointerUp={() => on('down', false)} onPointerLeave={() => on('down', false)} />
    </div>
  );
}

/** Browser Gamepad → same `a`/`b` layout posted to web_gamepad `/api/joy`. */
export function readPhysicalGamepad(): JoyReading | null {
  const pads = typeof navigator !== 'undefined' && navigator.getGamepads ? navigator.getGamepads() : [];
  const pad = Array.from(pads).find((p) => p && (p.mapping === 'standard' || p.axes.length >= 4));
  if (!pad) return null;
  const ax = (i: number) => pad.axes[i] ?? 0;
  const btn = (i: number) => pad.buttons[i];
  const dead = (n: number) => Math.abs(n) < 0.08 ? 0 : n;
  const a = [
    dead(-ax(0)), dead(-ax(1)), dead(-ax(2)), ax(3),
    btn(6)?.value ?? 0, btn(7)?.value ?? 0,
    (btn(15)?.pressed ? -1 : 0) + (btn(14)?.pressed ? 1 : 0),
    (btn(12)?.pressed ? 1 : 0) + (btn(13)?.pressed ? -1 : 0),
  ].map((n) => Math.round(n * 1000) / 1000);
  let bits = 0;
  const map: [number, number][] = [[0, 0], [1, 1], [2, 2], [3, 3], [4, 4], [5, 5], [8, 6], [9, 7], [16, 8], [10, 9], [11, 10]];
  for (const [idx, bit] of map) if (btn(idx)?.pressed) bits |= 1 << bit;
  return { a, b: bits };
}
