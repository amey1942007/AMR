'use client';
import { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { RobotCard } from './RobotCard';
import { TechStack } from './TechStack';
import { LinkRow } from './LinkRow';
import { Footer } from './Footer';
import { robots, techStack } from '@/lib/content';

/** #info: transparent → --bg at 40%; blocks reveal y40→0 700ms power3.out stagger 80 (opacity-only under RM). */
export function InfoSection({ reducedMotion = false }: { reducedMotion?: boolean }) {
  const ref = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    gsap.registerPlugin(ScrollTrigger);
    const blocks = el.querySelectorAll<HTMLElement>('.reveal');
    if (reducedMotion) return;
    gsap.set(blocks, { opacity: 0, y: 40 });
    const triggers = ScrollTrigger.batch(blocks, {
      start: 'top 80%',
      once: true,
      onEnter: (b) => gsap.to(b, { opacity: 1, y: 0, duration: 0.7, ease: 'power3.out', stagger: 0.08, overwrite: true }),
    });
    return () => { triggers.forEach((t) => t.kill()); gsap.set(blocks, { clearProps: 'all' }); };
  }, [reducedMotion]);

  return (
    <section
      ref={ref}
      id="info"
      aria-labelledby="info-title"
      tabIndex={-1}
      className="relative text-white outline-none"
      style={{ zIndex: 20, background: 'linear-gradient(to bottom, transparent 0, var(--bg) 40%)' }}
    >
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-[var(--section-gap)] px-[var(--gutter)] pt-[30vh]">
        <div className="reveal">
          <p className="eyebrow text-muted">The robots</p>
          <h2 id="info-title" className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]">Meet the robots</h2>
        </div>
        <div className="-mt-[calc(var(--section-gap)/2)] grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RobotCard robot={robots.amr4} />
          <RobotCard robot={robots.hardware} />
        </div>
        <TechStack items={techStack} />
        <LinkRow />
      </div>
      <div className="mt-[var(--section-gap)]"><Footer /></div>
    </section>
  );
}
