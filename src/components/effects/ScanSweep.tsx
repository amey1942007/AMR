/** login-spec §0: 60° conic wedge rotating around the PulseRings centre. Hidden under reduced motion (CSS). */
export function ScanSweep({ period = 4, maxR = 360, className = '' }: { period?: number; maxR?: number; className?: string }) {
  // 60° wedge as a pie path centred in a square.
  const r = maxR, cx = maxR, cy = maxR;
  const a = (Math.PI / 180) * 30; // half of 60°
  const x1 = cx + r * Math.sin(-a), y1 = cy - r * Math.cos(-a);
  const x2 = cx + r * Math.sin(a), y2 = cy - r * Math.cos(a);
  const d = `M ${cx} ${cy} L ${x1.toFixed(1)} ${y1.toFixed(1)} A ${r} ${r} 0 0 1 ${x2.toFixed(1)} ${y2.toFixed(1)} Z`;
  return (
    <svg className={`pointer-events-none absolute inset-0 h-full w-full ${className}`} viewBox={`0 0 ${maxR * 2} ${maxR * 2}`} aria-hidden style={{ ['--fx-period' as string]: `${period}s` }}>
      <defs>
        <linearGradient id="fx-sweep-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#7B2FF7" stopOpacity="0.25" />
          <stop offset="100%" stopColor="#7B2FF7" stopOpacity="0" />
        </linearGradient>
      </defs>
      <g className="fx-sweep">
        <path d={d} fill="url(#fx-sweep-grad)" />
      </g>
    </svg>
  );
}
