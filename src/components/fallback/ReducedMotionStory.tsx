'use client';
import { useServices } from '@/components/providers/ServicesProvider';
import { Placeholder } from './Placeholder';
import { copy } from '@/lib/content';

const CAPTIONS = ['AMR4, close up.', ...copy.callouts.map((c) => `${c.eyebrow} — ${c.title}`), copy.beyond];

/** Reduced motion: stacked stills with captions (no scrub, no canvas). Missing stills → room placeholder. */
export function ReducedMotionStory() {
  const { media } = useServices();
  return (
    <section aria-label="How it works" className="relative bg-bg py-[var(--section-gap)] text-white" style={{ zIndex: 20 }}>
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-16 px-[var(--gutter)]">
        {CAPTIONS.map((cap, i) => (
          <figure key={cap}>
            {media.stillUrls[i] ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={media.stillUrls[i]} alt="" width={1920} height={1080} loading={i ? 'lazy' : 'eager'} className="h-auto w-full rounded-[var(--radius-card)]" />
            ) : (
              <Placeholder kind="room" />
            )}
            <figcaption className="mt-4 text-[length:var(--text-callout)] font-semibold">{cap}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}
