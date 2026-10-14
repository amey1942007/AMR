import type { ReactNode } from 'react';
import { Footer } from '@/components/info/Footer';
export function StubPage({ title, eyebrow, children }: { title: string; eyebrow?: string; children?: ReactNode }) {
  return (
    <>
      <section id="info" tabIndex={-1} className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)] pt-[calc(var(--nav-h)+96px)] pb-24 text-white">
        {eyebrow && <p className="eyebrow text-muted">{eyebrow}</p>}
        <h1 className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]">{title}</h1>
        <div className="mt-10 max-w-[68ch] text-white/80">{children ?? <p>This page is coming soon.</p>}</div>
      </section>
      <Footer />
    </>
  );
}
