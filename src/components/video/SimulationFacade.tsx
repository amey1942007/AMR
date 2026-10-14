'use client';
import { useState, type ComponentType } from 'react';
import type { MediaVideo } from '@/services/types';

type Runtime = ComponentType<{ video: MediaVideo }>;

/**
 * ui-spec §14.3 facade: the only pre-click JS (≤ 3 KB gz). Poster + play disc; the click imports the runtime
 * (video/iframe, states, canvas pause, auto-pause) and hands over in `loading`.
 */
export function SimulationFacade({ video, label }: { video: MediaVideo; label: string }) {
  const [Player, setPlayer] = useState<Runtime | null>(null);
  const [busy, setBusy] = useState(false);
  if (Player) return <Player video={video} />;
  const poster = video.poster;
  const set = video.kind === 'file' ? video.posterSet : undefined;
  const embed = video.kind !== 'file' ? (video.kind === 'youtube' ? 'YouTube' : 'Vimeo') : null;
  return (
    <div>
      <button
        type="button"
        aria-label={label}
        aria-busy={busy || undefined}
        onClick={() => {
          setBusy(true);
          import('./SimulationPlayer').then((m) => setPlayer(() => m.SimulationPlayer as Runtime)).catch(() => setBusy(false));
        }}
        className="relative grid aspect-video w-full place-items-center overflow-hidden rounded-[var(--radius-card)] border border-[var(--line-dark)] bg-black/40 max-md:rounded-[12px]"
      >
        {poster && (
          <picture className="absolute inset-0">
            {set?.avif && <source type="image/avif" srcSet={`${set.avif} 1920w${set.avif2x ? `, ${set.avif2x} 3840w` : ''}`} sizes="(min-width:1440px) 1100px, 100vw" />}
            {set?.webp && <source type="image/webp" srcSet={`${set.webp} 1920w${set.webp2x ? `, ${set.webp2x} 3840w` : ''}`} sizes="(min-width:1440px) 1100px, 100vw" />}
            <img src={poster} alt="" loading="lazy" decoding="async" fetchPriority="low" className="h-full w-full object-cover" />
          </picture>
        )}
        <span aria-hidden className="relative grid size-[72px] place-items-center rounded-full max-md:size-14" style={{ backgroundImage: 'var(--grad-pill)' }}>
          {busy ? <span className="eyebrow text-[0.6rem] text-white">LOADING</span> : <svg width="28" height="28" viewBox="0 0 24 24" fill="#fff"><path d="M8 5v14l11-7z" /></svg>}
        </span>
      </button>
      {embed && <p className="mt-2 text-[length:var(--text-small)] text-muted">Plays via {embed === 'YouTube' ? 'YouTube (privacy-enhanced mode)' : embed}. Loading it shares your IP address with {embed}.</p>}
    </div>
  );
}
