/** login-spec §0: 5 horizontal sine paths, 2×-wide (2400 × 240) so translateX −50 %→0 loops seamlessly. Server-rendered. */
// Precomputed once at module load as smooth quadratic chains (Q + T): one control point per half-period.
const HALF = 300; // 2400 px = 4 periods
function wave(y: number, a: number, flat: boolean): string {
  let d = `M0,${y} Q${HALF / 2},${y - a} ${HALF},${y}`;
  for (let x = HALF * 2, i = 1; x <= 2400; x += HALF, i++) {
    const mid = x - HALF / 2;
    const inFlat = flat && mid > 800 && mid < 1600;
    d += inFlat ? ` L${x},${y}` : ` Q${mid},${y + (i % 2 ? a : -a)} ${x},${y}`;
  }
  return d;
}
const PATHS = Array.from({ length: 5 }, (_, i) => wave(40 + i * 40, 10 + i * 2, false));
const FLAT = Array.from({ length: 5 }, (_, i) => wave(40 + i * 40, 10 + i * 2, i === 2));

export function WaveLines({ lines = 5, flatline = false, className = '' }: { lines?: number; flatline?: boolean; className?: string }) {
  const src = flatline ? FLAT : PATHS;
  const n = Math.min(src.length, Math.max(1, lines));
  return (
    <div className={`fx-waves pointer-events-none absolute inset-x-0 bottom-0 h-[30%] overflow-hidden ${className}`} aria-hidden>
      <div className="fx-wave-breathe absolute inset-0">
        <svg className="fx-wave-track absolute left-0 top-0 h-full w-[200%]" viewBox="0 0 2400 240" preserveAspectRatio="none">
          <defs>
            <linearGradient id="fx-wave-grad" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#7B2FF7" stopOpacity="0.4" />
              <stop offset="100%" stopColor="#E81CB0" stopOpacity="0.4" />
            </linearGradient>
          </defs>
          {src.slice(0, n).map((d, i) => (
            <path key={i} d={d} fill="none" stroke={i === 2 ? 'url(#fx-wave-grad)' : '#fff'} strokeOpacity={i === 2 ? 1 : 0.06 + i * 0.02} strokeWidth="1" className={flatline && i === 2 ? 'fx-flat' : undefined} />
          ))}
        </svg>
      </div>
    </div>
  );
}
