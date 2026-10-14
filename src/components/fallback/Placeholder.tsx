const LABEL: Record<string, string> = { logo: 'LOGO', robot: 'ROBOT RENDER', video: 'VIDEO', room: 'ROOM STILL' };
/** Gradient block (bg-room → sky-horizon); label visible in dev only. */
export function Placeholder({ kind, className = '' }: { kind: 'logo' | 'robot' | 'video' | 'room'; className?: string }) {
  return (
    <div className={`grid aspect-video w-full place-items-center rounded-[var(--radius-card)] ${className}`} style={{ background: 'linear-gradient(135deg, var(--bg-room), var(--sky-horizon))' }}>
      {process.env.NODE_ENV !== 'production' && <span className="eyebrow text-muted">PLACEHOLDER · {LABEL[kind]}</span>}
    </div>
  );
}
