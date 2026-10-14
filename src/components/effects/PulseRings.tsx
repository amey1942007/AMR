/** login-spec §0: 3–4 concentric CSS-animated rings. aria-hidden; transform/opacity only. */
export function PulseRings({ rings = 3, period = 3.2, maxR = 520, className = '' }: { rings?: 2 | 3 | 4; period?: number; maxR?: number; className?: string }) {
  const n = Math.min(4, Math.max(2, rings));
  return (
    <svg className={`fx-rings pointer-events-none absolute inset-0 h-full w-full ${className}`} viewBox={`0 0 ${maxR * 2} ${maxR * 2}`} aria-hidden style={{ ['--fx-period' as string]: `${period}s` }}>
      <defs>
        <linearGradient id="fx-ring-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7B2FF7" />
          <stop offset="100%" stopColor="#E81CB0" />
        </linearGradient>
      </defs>
      {Array.from({ length: n }, (_, i) => (
        <circle key={i} cx={maxR} cy={maxR} r={maxR} fill="none" stroke={i === 0 ? 'url(#fx-ring-grad)' : 'rgba(255,255,255,.35)'} strokeWidth="1" />
      ))}
    </svg>
  );
}
