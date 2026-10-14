import type { ReactNode } from 'react';

type Kind = 'finding' | 'note' | 'pending' | 'legal';
const BAR: Record<Kind, string> = {
  finding: 'before:bg-grad',
  note: 'before:bg-white/40',
  pending: 'before:border-l-2 before:border-dashed before:border-violet',
  legal: 'before:bg-white',
};
/** Glass card with a 2 px left bar; ≤ 40 words (enforced). Pending gets the dashed violet bar + mono label. */
export function Callout({ kind = 'note', title, children, label }: { kind?: Kind; title: string; children: ReactNode; label?: string }) {
  if (typeof children === 'string' && children.trim().split(/\s+/).length > 40) throw new Error(`Callout "${title}" exceeds 40 words`);
  return (
    <aside role="note" aria-label={kind === 'legal' ? `Legal notice: ${title}` : title}
      className={`glass relative rounded-[16px] p-5 pl-6 before:absolute before:inset-y-4 before:left-0 before:w-[2px] before:content-[''] ${BAR[kind]} ${kind === 'pending' ? 'border-dashed !border-violet/70' : ''}`}>
      <p className="eyebrow text-muted">{label ?? title}</p>
      {label && <p className="mt-2 font-semibold text-white">{title}</p>}
      <div className="mt-2 text-[length:var(--text-small)] text-white/85">{children}</div>
    </aside>
  );
}
export function CalloutGrid({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">{children}</div>;
}
