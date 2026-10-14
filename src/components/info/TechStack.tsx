import { SplitReveal } from '@/components/ui/SplitReveal';
import { brandPaths } from '@/components/icons/brands';
/** Decorative, non-focusable chips (R8). Missing icon → text chip. */
export function TechStack({ items }: { items: readonly { label: string; icon?: string }[] }) {
  return (
    <div className="reveal">
      <SplitReveal text="Tech stack" className="text-[length:var(--text-h2)] font-semibold leading-[1.05] tracking-[-0.02em]" />
      <ul className="mt-8 flex flex-wrap gap-3">
        {items.map((it) => (
          <li key={it.label} className="tech-chip relative inline-flex h-10 items-center gap-2 rounded-full border border-[var(--line-dark)] px-[14px] text-white/60 transition-colors duration-200 hover:text-white">
            {it.icon && brandPaths[it.icon] && (
              <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden><path d={brandPaths[it.icon]} /></svg>
            )}
            <span className="text-[length:var(--text-small)]">{it.label}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
