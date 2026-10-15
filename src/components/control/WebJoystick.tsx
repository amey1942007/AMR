'use client';
import { useEffect, useRef, useState } from 'react';

export interface StickVec {
  lin: number;
  ang: number;
}

const MAX_LIN = 0.35;
const MAX_ANG = 0.8;
const DEADZONE = 0.12;

function clampStick(dx: number, dy: number, radius: number): { x: number; y: number } {
  const mag = Math.hypot(dx, dy);
  if (mag <= 0.0001) return { x: 0, y: 0 };
  if (mag <= radius) return { x: dx, y: dy };
  const s = radius / mag;
  return { x: dx * s, y: dy * s };
}

/**
 * Virtual differential-drive stick for mobile / touch.
 * Up → forward (lin+), right → turn right (ang−).
 */
export function WebJoystick({
  disabled,
  onVector,
}: {
  disabled: boolean;
  onVector: (v: StickVec) => void;
}) {
  const baseRef = useRef<HTMLDivElement>(null);
  const onVectorRef = useRef(onVector);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const active = useRef(false);
  const pointerId = useRef<number | null>(null);

  useEffect(() => {
    onVectorRef.current = onVector;
  }, [onVector]);

  const publish = (x: number, y: number, radius: number) => {
    if (disabled || radius <= 0) {
      onVectorRef.current({ lin: 0, ang: 0 });
      return;
    }
    const nx = x / radius;
    const ny = y / radius;
    const mag = Math.hypot(nx, ny);
    if (mag < DEADZONE) {
      onVectorRef.current({ lin: 0, ang: 0 });
      return;
    }
    const gain = (mag - DEADZONE) / (1 - DEADZONE) / mag;
    onVectorRef.current({
      lin: Math.max(-MAX_LIN, Math.min(MAX_LIN, -ny * gain * MAX_LIN)),
      ang: Math.max(-MAX_ANG, Math.min(MAX_ANG, -nx * gain * MAX_ANG)),
    });
  };

  const stop = () => {
    active.current = false;
    pointerId.current = null;
    setKnob({ x: 0, y: 0 });
    onVectorRef.current({ lin: 0, ang: 0 });
  };

  const updateFromEvent = (clientX: number, clientY: number) => {
    const el = baseRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const radius = rect.width / 2 - 8;
    const { x, y } = clampStick(
      clientX - (rect.left + rect.width / 2),
      clientY - (rect.top + rect.height / 2),
      radius,
    );
    setKnob({ x, y });
    publish(x, y, radius);
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <div
        ref={baseRef}
        className={`relative size-[min(168px,70vw)] touch-none select-none rounded-full border border-white/20 bg-[radial-gradient(circle_at_50%_45%,rgba(123,47,247,0.22),rgba(5,5,7,0.85))] ${disabled ? 'opacity-40' : ''}`}
        style={{ touchAction: 'none' }}
        onPointerDown={(e) => {
          if (disabled) return;
          e.preventDefault();
          e.currentTarget.setPointerCapture(e.pointerId);
          pointerId.current = e.pointerId;
          active.current = true;
          updateFromEvent(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (!active.current || pointerId.current !== e.pointerId) return;
          e.preventDefault();
          updateFromEvent(e.clientX, e.clientY);
        }}
        onPointerUp={stop}
        onPointerCancel={stop}
        role="application"
        aria-label="Drive joystick"
        aria-disabled={disabled}
      >
        <span className="pointer-events-none absolute inset-3 rounded-full border border-dashed border-white/15" aria-hidden />
        <span
          className="pointer-events-none absolute left-1/2 top-1/2 size-14 -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/30 bg-white/15 shadow-[0_0_24px_rgba(232,28,176,0.35)]"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
          aria-hidden
        />
      </div>
      <p className="text-center text-[length:var(--text-small)] text-muted">
        Drag to drive · release to stop
      </p>
    </div>
  );
}
