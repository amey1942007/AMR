import { Footer } from '@/components/info/Footer';
import { copy } from '@/lib/content';

/**
 * M0 home: static hero + footer only. M1 adds the scroll skeleton (Lenis, master timeline, 460vh #journey,
 * InfoSection); M2+ add the 3D journey.
 */
export default function Home() {
  return (
    <>
      <section className="relative grid min-h-svh place-items-center overflow-hidden bg-hero text-ink">
        <h1 className="font-display text-[length:var(--text-hero)] font-extrabold leading-[0.8] tracking-[-0.06em]">
          <span className="sr-only">AMR — Autonomous Mobile Robots</span>
          <span aria-hidden>AMR</span>
        </h1>
        <div className="absolute bottom-[calc(var(--gutter)+48px)] left-[var(--gutter)] max-w-[28ch]">
          <p className="eyebrow" style={{ color: 'var(--muted-on-light)' }}>{copy.eyebrow}</p>
          <p className="mt-3">{copy.tagline}</p>
        </div>
        <span aria-hidden className="eyebrow absolute right-[var(--gutter)] bottom-[var(--gutter)]">SCROLL ↓</span>
      </section>
      <section id="info" tabIndex={-1} aria-label="Robot info" className="bg-bg pt-[var(--section-gap)]">
        <Footer />
      </section>
    </>
  );
}
