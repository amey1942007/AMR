'use client';
import { useEffect, useState } from 'react';
import type { ContentsItem } from './PageHeader';

/** Sticky left TOC on lg, horizontal chip row on md/sm; active section via IntersectionObserver. */
export function Toc({ items }: { items: ContentsItem[] }) {
  const [active, setActive] = useState(items[0]?.id);
  useEffect(() => {
    const io = new IntersectionObserver((es) => {
      const vis = es.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (vis) setActive(vis.target.id);
    }, { rootMargin: '-30% 0px -60% 0px' });
    items.forEach((i) => { const el = document.getElementById(i.id); if (el) io.observe(el); });
    // Back above the first section: highlight the first item (the observer alone never resets).
    const first = document.getElementById(items[0]?.id ?? '');
    const onScroll = () => { if (first && first.getBoundingClientRect().top > innerHeight * 0.3) setActive(items[0]?.id); };
    addEventListener('scroll', onScroll, { passive: true });
    return () => { io.disconnect(); removeEventListener('scroll', onScroll); };
  }, [items]);
  return (
    <nav aria-label="On this page" className="toc z-[5] -mx-[var(--gutter)] overflow-x-auto px-[var(--gutter)] lg:sticky lg:top-[calc(var(--nav-h)+24px)] lg:mx-0 lg:w-[220px] lg:overflow-visible lg:px-0">
      <ol className="flex gap-2 py-2 lg:flex-col lg:gap-1">
        {items.map((i, n) => (
          <li key={i.id} className="shrink-0">
            <a href={`#${i.id}`} aria-current={active === i.id ? 'true' : undefined}
              className={`inline-flex min-h-11 items-center gap-2 rounded-full border px-3 text-[length:var(--text-small)] lg:min-h-9 lg:rounded-none lg:border-0 lg:border-l-2 lg:px-3 ${active === i.id ? 'border-violet text-white' : 'border-[var(--line-dark)] text-white/70 hover:text-white lg:border-transparent'}`}>
              <span className="font-mono text-[12px] text-muted">{n + 1}</span>{i.label}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
