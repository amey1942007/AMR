'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { S } from '@/lib/timeline';
import { useTick } from '@/components/journey/useTick';
import { copy } from '@/lib/content';

/**
 * Fixed hero layer (z 1, between backdrop and canvas so the robot is in front of "AMR").
 * static: reduced motion / pre-JS — plain section in flow, no transforms.
 */
export function HeroLayer({ isStatic = false }: { isStatic?: boolean }) {
  const title = useRef<HTMLHeadingElement>(null);
  const tag = useRef<HTMLDivElement>(null);
  const cue = useRef<HTMLSpanElement>(null);
  const letters = useRef<HTMLSpanElement>(null);
  const last = useRef({ t: -1, g: -1 });

  useEffect(() => {
    if (isStatic || !letters.current) return;
    const spans = letters.current.querySelectorAll('span');
    const a = gsap.fromTo(spans, { yPercent: 110 }, { yPercent: 0, duration: 0.9, ease: 'expo.out', stagger: 0.07 });
    const b = cue.current ? gsap.to(cue.current, { y: 8, duration: 0.8, ease: 'sine.inOut', yoyo: true, repeat: -1 }) : null;
    return () => { a.kill(); b?.kill(); };
  }, [isStatic]);

  useTick(() => {
    if (last.current.t !== S.heroTitle && title.current) {
      last.current.t = S.heroTitle;
      const k = 1 - S.heroTitle; // 0→1
      title.current.style.transform = `translateY(${-8 * k}vh) scale(${1 - 0.18 * k})`;
      title.current.style.opacity = String(S.heroTitle);
    }
    if (last.current.g !== S.tagline) {
      last.current.g = S.tagline;
      if (tag.current) tag.current.style.opacity = String(S.tagline);
      if (cue.current) cue.current.parentElement!.style.opacity = String(S.tagline);
    }
  }, !isStatic);

  return (
    <section
      aria-label="Intro"
      className={`${isStatic ? 'relative min-h-svh bg-hero' : 'pointer-events-none fixed inset-0'} grid place-items-center overflow-hidden text-ink`}
      style={{ zIndex: 1 }}
    >
      <h1 ref={title} className="font-display text-[length:var(--text-hero)] font-extrabold leading-[0.8] tracking-[-0.06em] will-change-transform">
        <span className="sr-only">AMR — Autonomous Mobile Robots</span>
        <span ref={letters} aria-hidden className="inline-flex overflow-hidden pb-[0.06em]">
          {'AMR'.split('').map((l) => <span key={l} className="inline-block">{l}</span>)}
        </span>
      </h1>
      <div ref={tag} className="absolute bottom-[calc(var(--gutter)+48px)] left-[var(--gutter)] max-w-[28ch]">
        <p className="eyebrow" style={{ color: 'var(--muted-on-light)' }}>{copy.eyebrow}</p>
        <p className="mt-3">{copy.tagline}</p>
      </div>
      <div className="absolute right-[var(--gutter)] bottom-[var(--gutter)]">
        <span ref={cue} aria-hidden className="eyebrow inline-block">SCROLL ↓</span>
      </div>
    </section>
  );
}
