'use client';
import { useEffect, useRef } from 'react';
import { loadGsap } from '@/lib/motion';
import { splitWords, SPLIT_MIN_WIDTH } from '@/lib/split';

/**
 * Word reveal inside masked lines: y 100%→0, 700 ms power3.out, stagger 40 ms, ScrollTrigger once.
 * Only ≥812 px and without reduced motion; otherwise the text is simply shown. AT reads the aria-label.
 */
export function SplitReveal({ as = 'h2', text, className, id }: { as?: 'h2' | 'h3' | 'p'; text: string; className?: string; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || innerWidth < SPLIT_MIN_WIDTH || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < innerHeight * 0.85) return; // already in view: no reveal
    let alive = true, cleanup = () => {};
    loadGsap().then(({ gsap, ScrollTrigger }) => {
      if (!alive) return;
      const words = el.querySelectorAll<HTMLElement>('[data-w]');
      gsap.set(words, { yPercent: 100 });
      const tw = gsap.to(words, { yPercent: 0, duration: 0.7, ease: 'power3.out', stagger: 0.04, paused: true });
      const st = ScrollTrigger.create({ trigger: el, start: 'top 85%', once: true, onEnter: () => tw.play() });
      cleanup = () => { st.kill(); tw.kill(); gsap.set(words, { clearProps: 'all' }); };
    });
    return () => { alive = false; cleanup(); };
  }, [text]);
  const Tag = as as 'h2';
  return (
    <Tag ref={ref} id={id} className={className} aria-label={text}>
      {splitWords(text).map((w, i) => (
        <span key={i} aria-hidden className="inline-block overflow-hidden pb-[0.08em] align-top">
          <span data-w className="inline-block">{w}</span>
          {'\u00a0'}
        </span>
      ))}
    </Tag>
  );
}
