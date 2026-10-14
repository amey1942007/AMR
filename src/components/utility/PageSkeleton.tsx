import '@/components/effects/effects.css';

const B = ({ className = '', style }: { className?: string; style?: React.CSSProperties }) => (
  <div className={`skel-shimmer relative overflow-hidden rounded-[6px] bg-white/[.05] ${className}`} style={style} />
);

/** login-spec §4: mirrors the paper layout (breadcrumb, h1, abstract, 2 figures 16:9). Reserves space (no CLS). */
export function PageSkeleton({ figures = [16 / 9, 16 / 9] }: { figures?: number[] }) {
  return (
    <div aria-busy="true" className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)] pt-[calc(var(--nav-h)+48px)] pb-24">
      <span role="status" className="sr-only">Loading…</span>
      <div aria-hidden>
        <B className="h-3 w-[120px]" />
        <B className="mt-8 h-12 w-[60%]" />
        <B className="mt-6 h-4 w-[80%]" />
        <B className="mt-3 h-4 w-[65%]" />
        {figures.map((r, i) => (
          <div key={i} className="mt-12">
            <B className="w-full !rounded-[16px]" style={{ aspectRatio: String(r) }} />
            <B className="mt-3 h-3 w-[40%]" />
          </div>
        ))}
      </div>
    </div>
  );
}
