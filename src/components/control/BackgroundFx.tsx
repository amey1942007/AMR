'use client';
import { useEffect, useRef, type CSSProperties } from 'react';

/**
 * Ambient 3D-ish background only — CSS perspective grid + drifting planes.
 * The robot itself stays 2D on the LiveMap canvas.
 */
export function BackgroundFx() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const onMove = (e: PointerEvent) => {
      const x = (e.clientX / window.innerWidth - 0.5) * 12;
      const y = (e.clientY / window.innerHeight - 0.5) * 8;
      el.style.setProperty('--fx-rx', `${y}deg`);
      el.style.setProperty('--fx-ry', `${-x}deg`);
    };
    window.addEventListener('pointermove', onMove, { passive: true });
    return () => window.removeEventListener('pointermove', onMove);
  }, []);

  return (
    <div
      ref={ref}
      className="pointer-events-none absolute inset-0 -z-10 overflow-hidden"
      style={
        {
          '--fx-rx': '0deg',
          '--fx-ry': '0deg',
          background:
            'radial-gradient(ellipse 90% 55% at 15% -10%, rgba(56,189,248,0.14), transparent 50%), radial-gradient(ellipse 70% 45% at 95% 5%, rgba(232,28,176,0.1), transparent 48%), linear-gradient(180deg, #050507 0%, #080a12 55%, #050507 100%)',
        } as CSSProperties
      }
      aria-hidden
    >
      <div
        className="absolute left-1/2 top-[18%] h-[140%] w-[140%] -translate-x-1/2 opacity-[0.35]"
        style={{
          perspective: '900px',
          transformStyle: 'preserve-3d',
        }}
      >
        <div
          className="absolute inset-0 origin-center"
          style={{
            transform: 'rotateX(calc(68deg + var(--fx-rx))) rotateZ(calc(var(--fx-ry))) translateZ(-40px)',
            backgroundImage:
              'linear-gradient(rgba(79,195,247,0.12) 1px, transparent 1px), linear-gradient(90deg, rgba(79,195,247,0.12) 1px, transparent 1px)',
            backgroundSize: '48px 48px',
            maskImage: 'radial-gradient(ellipse 55% 45% at 50% 35%, black 10%, transparent 70%)',
            WebkitMaskImage: 'radial-gradient(ellipse 55% 45% at 50% 35%, black 10%, transparent 70%)',
            transition: 'transform 120ms linear',
          }}
        />
        <div
          className="control-fx-drift absolute left-[20%] top-[8%] size-40 rounded-full opacity-40 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(123,47,247,0.35), transparent 70%)',
          }}
        />
        <div
          className="control-fx-drift control-fx-drift-rev absolute right-[12%] top-[22%] size-52 rounded-full opacity-30 blur-3xl"
          style={{
            background: 'radial-gradient(circle, rgba(232,28,176,0.28), transparent 70%)',
          }}
        />
      </div>
      <style>{`
        @keyframes control-fx-drift {
          from { transform: translate3d(0, 0, 0) scale(1); }
          to { transform: translate3d(24px, -18px, 40px) scale(1.12); }
        }
        .control-fx-drift { animation: control-fx-drift 14s ease-in-out infinite alternate; }
        .control-fx-drift-rev { animation: control-fx-drift 18s ease-in-out infinite alternate-reverse; }
        @media (prefers-reduced-motion: reduce) {
          .control-fx-drift,
          .control-fx-drift-rev { animation: none; }
        }
      `}</style>
    </div>
  );
}
