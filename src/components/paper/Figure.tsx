import type { ReactNode } from 'react';
import { getFigure, type FigureId } from '@/data/pages/figures';

const CHIP = {
  verified: { label: 'VERIFIED FROM CODE', cls: 'border border-white' },
  notes: { label: 'FROM PROJECT NOTES', cls: 'border border-dashed border-white/40' },
  pending: { label: 'PENDING CODE REVIEW', cls: 'border border-dashed border-violet' },
} as const;

/**
 * Numbered figure. Caption + explainer come from figures.ts (§11.7) via getFigure(), which THROWS when either is
 * missing, so a figure without its text fails the static export. Number = the id's ordinal (DOM order per page).
 * `alt` is the text alternative for graphic-only figures (charts/tables carry their own tables).
 */
export function Figure({ id, children, alt, wide = true }: { id: FigureId; children: ReactNode; alt?: string; wide?: boolean }) {
  const f = getFigure(id);
  const n = Number(id.split('-').pop());
  const capId = `fig-${id}-cap`;
  const chip = CHIP[f.status];
  return (
    <figure id={`fig-${id}`} aria-labelledby={capId} className={wide ? 'w-full' : 'w-full lg:w-8/12'}>
      <div className="glass @container min-w-0 rounded-[var(--radius-card)] p-4 sm:p-6" style={{ backdropFilter: 'none' }}>{children}</div>
      <figcaption className="mt-4 max-w-[60ch]">
        <p id={capId} className="text-[length:var(--text-small)] text-white"><strong>Fig. {n}</strong> {f.caption}.</p>
        <p className="mt-2 text-white">{f.explainer}</p>
        {alt && <p className="sr-only">{alt}</p>}
        <p className="mt-3 flex flex-wrap items-center gap-3 font-mono text-[0.7rem] text-muted">
          <span className={`rounded-[var(--radius-chip)] px-2 py-0.5 ${chip.cls}`}>{chip.label}</span>
          <span>Source {f.source}</span>
        </p>
      </figcaption>
    </figure>
  );
}
