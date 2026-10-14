import type { ReactNode } from 'react';

const words = (s: string) => s.trim().split(/\s+/).length;
/** `<section id>` → number + h2 → figure → body (2–4 paragraphs, each ≤ 60 words, enforced) → callouts → source. */
export function PaperSection({ id, n, title, figure, paras = [], children, source }: {
  id: string; n: string; title: string; figure?: ReactNode; paras?: string[]; children?: ReactNode; source?: string;
}) {
  if (paras.length > 4) throw new Error(`Section ${id}: max 4 paragraphs`);
  for (const p of paras) if (words(p) > 60) throw new Error(`Section ${id}: paragraph exceeds 60 words`);
  return (
    <section id={id} aria-labelledby={`${id}-h`} className="reveal-in scroll-mt-[calc(var(--nav-h)+24px)] py-[calc(var(--section-gap)/2)]">
      <h2 id={`${id}-h`} className="flex items-baseline gap-4 text-[length:var(--text-h2)] font-semibold leading-[1.05] tracking-[-0.02em]">
        <span className="font-mono text-[0.45em] font-normal text-muted">{n}</span>{title}
      </h2>
      {figure && <div className="mt-6">{figure}</div>}
      {paras.length > 0 && (
        <div className="mt-8 flex max-w-[60ch] flex-col gap-4 text-white/80">{paras.map((p) => <p key={p.slice(0, 24)}>{p}</p>)}</div>
      )}
      {children && <div className="mt-8">{children}</div>}
      {source && <p className="eyebrow mt-6 text-muted">Source {source}</p>}
    </section>
  );
}
