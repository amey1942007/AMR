import type { ReactNode } from 'react';
/** Full-width note (pages-spec §1.1). pending = dashed violet border + IN DEVELOPMENT / TO BE CONFIRMED label. */
export function Note({ kind, children, label }: { kind: 'info' | 'pending' | 'legal'; children: ReactNode; label?: string }) {
  const cls = kind === 'pending' ? 'border-dashed border-violet' : kind === 'legal' ? 'border-white' : 'border-[var(--line-dark)]';
  const lab = label ?? (kind === 'pending' ? 'IN DEVELOPMENT' : kind === 'legal' ? 'DRAFT' : 'NOTE');
  return (
    <div role="note" aria-label={kind === 'legal' ? 'Legal status' : lab} className={`rounded-[var(--radius-card)] border bg-white/[.03] px-5 py-4 ${cls}`}>
      <p className="eyebrow text-muted">{lab}</p>
      <div className="mt-2 text-white">{children}</div>
    </div>
  );
}
