'use client';
import { useState } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import { Placeholder } from './Placeholder';
import { copy } from '@/lib/content';

const CAPTIONS = [
  'AMR4, close up.',
  ...copy.callouts.map((c) => `${c.eyebrow} — ${c.title}`),
  ...copy.cloudBeats.map((b) => `${b.eyebrow} — ${b.title}`),
];

/** Reduced motion: stacked stills with captions (no scrub, no canvas). Missing stills → room placeholder. */
export function ReducedMotionStory() {
  const { media } = useServices();
  return (
    <section aria-label="How it works" className="relative bg-bg py-[var(--section-gap)] text-white" style={{ zIndex: 20 }}>
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-16 px-[var(--gutter)]">
        {CAPTIONS.map((cap, i) => (
          <figure key={cap}>
            <StillOrPlaceholder src={media.stillUrls[i]} eager={!i} />
            <figcaption className="mt-4 text-[length:var(--text-callout)] font-semibold">{cap}</figcaption>
          </figure>
        ))}
      </div>
    </section>
  );
}

/** Missing/broken still → room placeholder (never a broken image). */
function StillOrPlaceholder({ src, eager }: { src?: string; eager: boolean }) {
  const [bad, setBad] = useState(false);
  if (!src || bad) return <Placeholder kind="room" />;
  // eslint-disable-next-line @next/next/no-img-element
  return <img src={src} alt="" width={1920} height={1080} loading={eager ? 'eager' : 'lazy'} onError={() => setBad(true)} className="h-auto w-full rounded-[var(--radius-card)]" />;
}
