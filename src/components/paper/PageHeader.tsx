import type { ReactNode } from 'react';
import { Breadcrumb, type Crumb } from './Breadcrumb';

export interface ContentsItem { id: string; label: string }
const words = (s: string) => s.trim().split(/\s+/).length;

/**
 * Paper front matter (pages-spec §11.1): breadcrumb → eyebrow → h1 → one-line abstract (≤ 35 words, enforced)
 * → mono meta row → numbered contents. The faint sky band sits behind it (CSS only).
 */
export function PageHeader({ crumbs, eyebrow, title, abstract, badge, meta = 'SOURCE project notes (brief §0)', contents, aside }: {
  crumbs: Crumb[]; eyebrow: string; title: string; abstract: string; badge?: ReactNode; meta?: string; contents?: ContentsItem[]; aside?: ReactNode;
}) {
  if (words(abstract) > 35) throw new Error(`PageHeader abstract for "${title}" exceeds 35 words`);
  return (
    <header className="paper-sky relative">
      <div className={`mx-auto max-w-[var(--content-max)] px-[var(--gutter)] pt-[calc(var(--nav-h)+24px)] pb-16 ${aside ? 'grid gap-10 lg:grid-cols-12' : ''}`}>
        <div className={aside ? 'lg:col-span-5' : ''}>
          <Breadcrumb items={crumbs} />
          <div className="reveal-in mt-12">
            <p className="eyebrow text-muted">{eyebrow}</p>
            {badge && <div className="mt-4">{badge}</div>}
            <h1 className={`mt-4 font-display font-bold leading-[0.95] tracking-[-0.04em] [hyphens:manual] [overflow-wrap:normal] ${aside ? 'text-[length:clamp(2.5rem,10vw,5rem)] lg:text-[length:clamp(3rem,4.6vw,4.75rem)]' : 'text-[length:var(--text-display)]'}`}>{title}</h1>
            <p className="mt-6 max-w-[60ch] text-[length:calc(var(--text-body)*1.15)] text-white/80">{abstract}</p>
            <p className="eyebrow mt-6 text-muted">UPDATED 2026-10-14 · {meta}</p>
          </div>
          {contents && contents.length > 0 && (
            <nav aria-label="Contents" className="mt-10">
              <p className="eyebrow text-muted">Contents</p>
              <ol className="mt-3 flex flex-col gap-1 text-[length:var(--text-small)]">
                {contents.map((c, i) => (
                  <li key={c.id}><a className="inline-flex min-h-8 items-center gap-3 text-white/80 hover:text-white" href={`#${c.id}`}><span className="font-mono text-muted">{i + 1}</span>{c.label}</a></li>
                ))}
              </ol>
            </nav>
          )}
        </div>
        {aside && <div className="lg:col-span-7">{aside}</div>}
      </div>
    </header>
  );
}

export function Badge({ kind, children }: { kind: 'dev' | 'tested'; children: ReactNode }) {
  return (
    <span className={`eyebrow inline-flex h-7 w-fit items-center rounded-full border px-3 text-white ${kind === 'dev' ? 'border-violet' : 'border-white/40'}`}>{children}</span>
  );
}
