'use client';
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import type { ControlCommand } from '@/lib/telemetry/protocol';

/**
 * Fullscreen Xbox-layout virtual gamepad — mirrors web_gamepad_node:
 * dual sticks, ABXY, LB/RB/LT/RT, D-pad, Back/Start, E-STOP.
 * Streams { type: 'joy', axes[8], buttons } at ~20 Hz while open.
 */

function clampStick(dx: number, dy: number, maxR: number) {
  const d = Math.hypot(dx, dy);
  if (d <= 0.0001) return { x: 0, y: 0 };
  if (d <= maxR) return { x: dx, y: dy };
  const s = maxR / d;
  return { x: dx * s, y: dy * s };
}

function Stick({
  label,
  disabled,
  onAxes,
}: {
  label: string;
  disabled: boolean;
  onAxes: (nx: number, ny: number) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);
  const pid = useRef<number | null>(null);

  const stop = () => {
    active.current = false;
    pid.current = null;
    setKnob({ x: 0, y: 0 });
    onAxes(0, 0);
  };

  const move = (cx: number, cy: number) => {
    const el = baseRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const maxR = r.width / 2 - 28;
    const { x, y } = clampStick(cx - (r.left + r.width / 2), cy - (r.top + r.height / 2), maxR);
    setKnob({ x, y });
    onAxes(maxR > 0 ? -(x / maxR) : 0, maxR > 0 ? -(y / maxR) : 0);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={baseRef}
        className={`relative size-[min(140px,28vw)] touch-none rounded-full border-2 border-white/15 ${disabled ? 'opacity-40' : ''}`}
        style={{
          background:
            'radial-gradient(circle, rgba(255,255,255,0.06) 0%, rgba(15,23,42,0.7) 70%, rgba(5,5,10,0.95) 100%)',
          touchAction: 'none',
        }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          pid.current = e.pointerId;
          active.current = true;
          move(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!active.current || pid.current !== e.pointerId) return;
          e.preventDefault();
          move(e.clientX, e.clientY);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
      >
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-px w-[80%] -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        <span className="pointer-events-none absolute left-1/2 top-1/2 h-[80%] w-px -translate-x-1/2 -translate-y-1/2 bg-white/10" />
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 size-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white/35"
          style={{
            transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))`,
            background: 'radial-gradient(circle at 35% 35%, #38bdf8, #0284c7 60%, #0369a1)',
            boxShadow: '0 6px 14px rgba(0,0,0,0.6)',
          }}
        />
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-white/45">{label}</span>
    </div>
  );
}

function HoldBtn({
  className,
  children,
  disabled,
  onHold,
  style,
}: {
  className?: string;
  children: ReactNode;
  disabled?: boolean;
  onHold: (down: boolean) => void;
  style?: CSSProperties;
}) {
  const pid = useRef<number | null>(null);
  return (
    <button
      type="button"
      className={className}
      style={{ ...style, touchAction: 'none' }}
      disabled={disabled}
      onPointerDown={(e) => {
        if (disabled) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        pid.current = e.pointerId;
        onHold(true);
      }}
      onPointerUp={(e) => {
        if (pid.current !== e.pointerId) return;
        pid.current = null;
        onHold(false);
      }}
      onPointerCancel={() => {
        pid.current = null;
        onHold(false);
      }}
    >
      {children}
    </button>
  );
}

export function XboxGamepad({
  open,
  canDrive,
  canEstop,
  onClose,
  onCommand,
}: {
  open: boolean;
  canDrive: boolean;
  canEstop: boolean;
  onClose: () => void;
  onCommand: (cmd: ControlCommand) => void;
}) {
  const axesRef = useRef(new Float32Array(8));
  const buttonsRef = useRef(0);
  const onCommandRef = useRef(onCommand);
  const [hudLin, setHudLin] = useState(0.25);
  const [hudAng, setHudAng] = useState(0.8);
  const [pressed, setPressed] = useState<Record<string, boolean>>({});

  useEffect(() => {
    onCommandRef.current = onCommand;
  }, [onCommand]);

  useEffect(() => {
    if (!open) {
      axesRef.current.fill(0);
      buttonsRef.current = 0;
      return;
    }
    const id = window.setInterval(() => {
      if (!canDrive) return;
      const a = Array.from(axesRef.current);
      const b = buttonsRef.current;
      const moving = a.some((v) => Math.abs(v) > 0.02) || b !== 0;
      if (moving) {
        onCommandRef.current({ type: 'joy', axes: a, buttons: b });
      }
    }, 50);
    return () => {
      window.clearInterval(id);
      // zero on close
      onCommandRef.current({ type: 'joy', axes: [0, 0, 0, 0, 0, 0, 0, 0], buttons: 0 });
    };
  }, [open, canDrive]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  const setBit = (bit: number, down: boolean, key: string) => {
    setPressed((p) => ({ ...p, [key]: down }));
    if (down) buttonsRef.current |= 1 << bit;
    else buttonsRef.current &= ~(1 << bit);
  };

  const setAxis = (idx: number, val: number) => {
    axesRef.current[idx] = val;
  };

  const face = (id: string, bit: number, letter: string, sub: string, colors: string) => (
    <HoldBtn
      key={id}
      disabled={!canDrive}
      className={`flex size-11 flex-col items-center justify-center rounded-full border border-white/25 text-sm font-black shadow-lg transition ${pressed[id] ? 'scale-92 brightness-125' : ''} ${!canDrive ? 'opacity-40' : ''}`}
      style={{ background: colors, color: id === 'y' ? '#1e1b18' : '#fff' }}
      onHold={(d) => setBit(bit, d, id)}
    >
      {letter}
      <span className="text-[7px] font-bold uppercase opacity-85">{sub}</span>
    </HoldBtn>
  );

  return (
    <div className="fixed inset-0 z-[80] flex flex-col bg-[#05070c] text-white" role="dialog" aria-modal aria-label="Xbox controller">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          background:
            'radial-gradient(ellipse 70% 50% at 20% 10%, rgba(56,189,248,0.12), transparent 55%), radial-gradient(ellipse 50% 40% at 85% 80%, rgba(232,28,176,0.1), transparent 50%)',
        }}
        aria-hidden
      />

      <header className="relative z-10 flex items-center justify-between gap-3 px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="size-2 animate-pulse rounded-full bg-[#5ee6a8]" />
          <span className="font-mono text-xs uppercase tracking-wider text-white/70">
            {canDrive ? 'Controller · joy 20 Hz' : 'View only'}
          </span>
        </div>
        <div className="flex items-center gap-3 rounded-full border border-white/10 bg-black/40 px-4 py-1.5 font-mono text-xs">
          <span className="text-white/45">Lin</span>
          <span className="text-cyan-300">{hudLin.toFixed(2)} m/s</span>
          <span className="text-white/45">Ang</span>
          <span className="text-cyan-300">{hudAng.toFixed(2)} rad/s</span>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            className="rounded-lg bg-[var(--danger)] px-4 py-2 text-sm font-bold disabled:opacity-40"
            disabled={!canEstop}
            onClick={() => {
              axesRef.current.fill(0);
              buttonsRef.current = 0;
              onCommand({ type: 'estop' });
              onCommand({ type: 'joy', axes: [0, 0, 0, 0, 0, 0, 0, 0], buttons: 0 });
            }}
          >
            E-STOP
          </button>
          <button
            type="button"
            className="rounded-lg border border-white/20 bg-white/5 px-4 py-2 text-sm"
            onClick={onClose}
          >
            Close
          </button>
        </div>
      </header>

      {/* Shoulders */}
      <div className="relative z-10 flex items-center justify-between gap-3 px-4 pb-2">
        <div className="flex gap-2">
          <HoldBtn
            disabled={!canDrive}
            className={`rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold ${pressed.lt ? 'bg-cyan-500/30' : ''}`}
            onHold={(d) => {
              setPressed((p) => ({ ...p, lt: d }));
              setAxis(4, d ? -1 : 0);
              if (d) setHudLin((v) => Math.max(0.05, +(v - 0.05).toFixed(2)));
            }}
          >
            LT <span className="text-white/45">SPD −</span>
          </HoldBtn>
          <HoldBtn
            disabled={!canDrive}
            className={`rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold ${pressed.lb ? 'bg-cyan-500/30' : ''}`}
            onHold={(d) => {
              setBit(4, d, 'lb');
              if (d) setHudAng((v) => Math.max(0.2, +(v - 0.1).toFixed(2)));
            }}
          >
            LB <span className="text-white/45">TURN −</span>
          </HoldBtn>
        </div>
        <div className="flex gap-2">
          <HoldBtn
            disabled={!canDrive}
            className={`rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold ${pressed.rb ? 'bg-cyan-500/30' : ''}`}
            onHold={(d) => {
              setBit(5, d, 'rb');
              if (d) setHudAng((v) => Math.min(2, +(v + 0.1).toFixed(2)));
            }}
          >
            RB <span className="text-white/45">TURN +</span>
          </HoldBtn>
          <HoldBtn
            disabled={!canDrive}
            className={`rounded-xl border border-white/15 bg-white/5 px-4 py-2 text-xs font-bold ${pressed.rt ? 'bg-cyan-500/30' : ''}`}
            onHold={(d) => {
              setPressed((p) => ({ ...p, rt: d }));
              setAxis(5, d ? -1 : 0);
              if (d) setHudLin((v) => Math.min(0.5, +(v + 0.05).toFixed(2)));
            }}
          >
            RT <span className="text-white/45">SPD +</span>
          </HoldBtn>
        </div>
      </div>

      {/* Main workspace */}
      <div className="relative z-10 flex flex-1 items-center justify-between gap-2 px-3 pb-6 sm:px-6">
        <Stick
          label="Move (fwd / strafe)"
          disabled={!canDrive}
          onAxes={(nx, ny) => {
            // left stick: axes[0]=strafe, axes[1]=fwd (web_gamepad invert)
            setAxis(0, nx);
            setAxis(1, ny);
          }}
        />

        <div className="flex flex-col items-center gap-4">
          <div className="flex gap-2">
            <HoldBtn
              disabled={!canDrive}
              className={`rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/60 ${pressed.back ? 'bg-white/20 text-white' : ''}`}
              onHold={(d) => setBit(6, d, 'back')}
            >
              ☰ BACK
            </HoldBtn>
            <HoldBtn
              disabled={!canDrive}
              className={`rounded-2xl border border-white/15 bg-white/5 px-3 py-1.5 text-[11px] font-bold text-white/60 ${pressed.start ? 'bg-white/20 text-white' : ''}`}
              onHold={(d) => setBit(7, d, 'start')}
            >
              START ≡
            </HoldBtn>
          </div>
          <div className="grid grid-cols-3 grid-rows-3 gap-1">
            <span />
            <HoldBtn
              disabled={!canDrive}
              className={`grid size-9 place-items-center rounded-md border border-white/15 bg-[#0f172a] text-cyan-300 ${pressed.du ? 'bg-cyan-500/30' : ''}`}
              onHold={(d) => {
                setPressed((p) => ({ ...p, du: d }));
                setAxis(6, 0);
                setAxis(7, d ? 1 : 0);
              }}
            >
              ▲
            </HoldBtn>
            <span />
            <HoldBtn
              disabled={!canDrive}
              className={`grid size-9 place-items-center rounded-md border border-white/15 bg-[#0f172a] text-cyan-300 ${pressed.dl ? 'bg-cyan-500/30' : ''}`}
              onHold={(d) => {
                setPressed((p) => ({ ...p, dl: d }));
                setAxis(6, d ? 1 : 0);
                setAxis(7, 0);
              }}
            >
              ◀
            </HoldBtn>
            <span className="size-9 rounded bg-white/[0.03]" />
            <HoldBtn
              disabled={!canDrive}
              className={`grid size-9 place-items-center rounded-md border border-white/15 bg-[#0f172a] text-cyan-300 ${pressed.dr ? 'bg-cyan-500/30' : ''}`}
              onHold={(d) => {
                setPressed((p) => ({ ...p, dr: d }));
                setAxis(6, d ? -1 : 0);
                setAxis(7, 0);
              }}
            >
              ▶
            </HoldBtn>
            <span />
            <HoldBtn
              disabled={!canDrive}
              className={`grid size-9 place-items-center rounded-md border border-white/15 bg-[#0f172a] text-cyan-300 ${pressed.dd ? 'bg-cyan-500/30' : ''}`}
              onHold={(d) => {
                setPressed((p) => ({ ...p, dd: d }));
                setAxis(6, 0);
                setAxis(7, d ? -1 : 0);
              }}
            >
              ▼
            </HoldBtn>
            <span />
          </div>
        </div>

        <div className="flex flex-col items-center gap-3">
          <div
            className="grid grid-cols-2 gap-2"
            style={{ transform: 'rotate(45deg)', padding: 6 }}
          >
            <span style={{ transform: 'rotate(-45deg)' }}>
              {face('y', 3, 'Y', 'CAL', 'radial-gradient(circle at 35% 35%, #fbbf24, #b45309)')}
            </span>
            <span style={{ transform: 'rotate(-45deg)' }}>
              {face('b', 1, 'B', 'MAP', 'radial-gradient(circle at 35% 35%, #f87171, #b91c1c)')}
            </span>
            <span style={{ transform: 'rotate(-45deg)' }}>
              {face('x', 2, 'X', 'VIS', 'radial-gradient(circle at 35% 35%, #38bdf8, #0369a1)')}
            </span>
            <span style={{ transform: 'rotate(-45deg)' }}>
              {face('a', 0, 'A', 'SEQ', 'radial-gradient(circle at 35% 35%, #34d399, #047857)')}
            </span>
          </div>
        </div>

        <Stick
          label="Rotate / camera"
          disabled={!canDrive}
          onAxes={(nx, ny) => {
            // right stick: axes[2]=yaw, axes[3]=tilt (invertY like web_gamepad)
            setAxis(2, nx);
            setAxis(3, -ny);
          }}
        />
      </div>
    </div>
  );
}
