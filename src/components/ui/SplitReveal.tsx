'use client';
import { useEffect, useRef } from 'react';
import { splitWords, SPLIT_MIN_WIDTH } from '@/lib/split';
import { onReached } from '@/lib/reveal';

/**
 * Word reveal inside masked lines: y 100%→0, 700 ms power3.out (CSS transition), stagger 40 ms, once on
 * IntersectionObserver (top 85 %).
 * Only ≥812 px and without reduced motion; otherwise the text is simply shown. AT reads the aria-label.
 */
export function SplitReveal({ as = 'h2', text, className, id }: { as?: 'h2' | 'h3' | 'p'; text: string; className?: string; id?: string }) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el || innerWidth < SPLIT_MIN_WIDTH || matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (el.getBoundingClientRect().top < innerHeight * 0.85) return; // already in view: no reveal
    const words = Array.from(el.querySelectorAll<HTMLElement>('[data-w]'));
    words.forEach((w, i) => { w.style.transform = 'translateY(100%)'; w.style.transitionDelay = `${i * 40}ms`; w.classList.add('split-w'); });
    // Derived from the current position, so End / anchor jumps past the heading still reveal it (lib/reveal).
    const stop = onReached([el], 0.85, () => words.forEach((w) => { w.style.transform = ''; }));
    return () => { stop(); words.forEach((w) => { w.style.transform = ''; w.style.transitionDelay = ''; w.classList.remove('split-w'); }); };
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
