/** Em dash + ABSENT chip; announced as "absent in this branch". */
export function Absent({ text = 'ABSENT' }: { text?: string }) {
  return (
    <span className="inline-flex items-center gap-2 text-muted">
      <span aria-hidden>—</span>
      <span aria-hidden className="rounded-[var(--radius-chip)] border border-dashed border-white/30 px-2 py-0.5 font-mono text-[0.7rem]">{text}</span>
      <span className="sr-only">{text === 'ABSENT' ? 'absent in this branch' : `${text.toLowerCase()} (absent in this branch)`}</span>
    </span>
  );
}
