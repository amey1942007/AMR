'use client';
import { useEffect, useRef, useState } from 'react';
import { S } from '@/lib/scene-state';
import { useTick } from '@/components/journey/useTick';
import { useServices } from '@/components/providers/ServicesProvider';
import { asset } from '@/lib/asset';

const RANGES: [number, number][] = [[0, 0.26], [0.26, 0.42], [0.42, 0.54], [0.54, 0.7], [0.7, 1.01]];

/**
 * No WebGL2 / context lost: model-viewer (lazy, only if the lo GLB exists) in the hero + stills crossfading by p.
 * Missing stills → gradient placeholder layer. Nothing renders if neither exists (the DOM hero stays).
 */
export default function Fallback3D() {
  const { media } = useServices();
  const [hasModel, setHasModel] = useState(false);
  const stills = useRef<(HTMLElement | null)[]>([]);
  const map = useRef<HTMLImageElement>(null);
  const mv = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Review #14: trust the media manifest (no HEAD probe); model-viewer shows its poster if the file fails.
    if (!media.heroModel.lo) return;
    import('@google/model-viewer').then(() => setHasModel(true)).catch(() => {});
  }, [media.heroModel.lo]);
  useTick(() => {
    stills.current.forEach((el, i) => {
      if (!el) return;
      const [a, b] = RANGES[i];
      const o = Math.min(1, Math.max(0, Math.min((S.p - a + 0.03) / 0.06, (b - S.p + 0.03) / 0.06)));
      el.style.opacity = String(i === 0 ? o * S.bgMix : o);
    });
    // Review #11: the model is a hero element, so it fades out with the hero title + tagline and is gone after.
    if (mv.current) {
      const o = Math.max(S.heroTitle, S.tagline);
      mv.current.style.opacity = String(o);
      mv.current.style.visibility = o < 0.005 ? 'hidden' : 'visible';
    }
    if (map.current) map.current.style.opacity = S.p > 0.42 && S.p < 0.9 ? '1' : '0';
  });
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0" style={{ zIndex: 2 }}>
      {media.stillUrls.length > 0 &&
        RANGES.map((_, i) => (
          // eslint-disable-next-line @next/next/no-img-element
          <img key={i} ref={(el) => { stills.current[i] = el; }} src={media.stillUrls[i]} alt="" onError={(e) => { e.currentTarget.remove(); }} className="absolute inset-0 h-full w-full object-cover" style={{ opacity: 0 }} />
        ))}
      {media.mapStaticUrl && (
        // eslint-disable-next-line @next/next/no-img-element
        <img ref={map} src={media.mapStaticUrl} alt="" onError={(e) => { e.currentTarget.remove(); }} width={240} height={168} className="glass absolute right-[var(--gutter)] bottom-[var(--gutter)] rounded-[var(--radius-card)] p-[10px] transition-opacity duration-300" style={{ opacity: 0 }} />
      )}
      {hasModel && (
        <div ref={mv} className="absolute inset-x-0 top-[20vh] mx-auto h-[60vh] max-w-[900px]">
          {/* @ts-expect-error custom element */}
          <model-viewer src={asset(media.heroModel.lo!)} poster={media.posterUrl} auto-rotate rotation-per-second="8deg" disable-zoom interaction-prompt="none" loading="lazy" style={{ width: '100%', height: '100%', background: 'transparent' }} />
        </div>
      )}
    </div>
  );
}
