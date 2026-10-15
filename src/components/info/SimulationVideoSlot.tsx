'use client';
import { useEffect, useState } from 'react';
import type { MediaVideo } from '@/services/types';
import { fetchSiteVideo } from '@/services/adapters/media.supabase';
import { simulationVideo } from '@/data/media';
import { WaveLines } from '@/components/effects/WaveLines';
import { FxPause } from '@/components/effects/FxPause';
import { SimulationFacade } from '@/components/video/SimulationFacade';
import '@/components/effects/effects.css';

function fmt(sec?: number) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function Placeholder() {
  return (
    <div className="glass relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] max-md:rounded-[12px]" role="img" aria-label="Simulation video coming soon" data-fx-host>
      <FxPause />
      <WaveLines className="!inset-0 !h-full opacity-60" />
      <div className="absolute inset-0 grid place-items-center">
        <span aria-hidden className="font-display text-[40px] font-extrabold tracking-[-0.04em] text-white/40">AMR</span>
        <span aria-hidden className="eyebrow absolute bottom-6 text-white/80">SIMULATION VIDEO · COMING SOON</span>
      </div>
    </div>
  );
}

/**
 * Static `media.ts` wins when set (fixtures / local files). Otherwise loads a published
 * `site_videos` row from Supabase (id = simulation). Unpublished / missing → coming-soon placeholder.
 */
export function SimulationVideoSlot() {
  const [video, setVideo] = useState<MediaVideo | null>(simulationVideo);

  useEffect(() => {
    if (simulationVideo) return;
    let cancelled = false;
    fetchSiteVideo('simulation').then((v) => {
      if (!cancelled && v) setVideo(v);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, []);

  const dur = fmt(video?.durationSec);
  return (
    <>
      <div className="mx-auto mt-8 w-full max-w-[1100px] max-[1439px]:max-w-[960px]" data-lenis-prevent aria-describedby="sim-lead">
        {video ? (
          <SimulationFacade video={video} label={`Play: ${video.title}${dur ? ` (${dur})` : ''}`} />
        ) : (
          <Placeholder />
        )}
      </div>
      {video && (
        <div className="mx-auto mt-3 flex max-w-[1100px] flex-wrap items-center gap-3 text-[length:var(--text-small)] text-muted max-[1439px]:max-w-[960px]">
          <span>{video.title}</span>
          {dur && <span className="font-mono">{dur}</span>}
          {(video.kind === 'file' ? !!video.captions?.length : video.captions === 'provider') && (
            <span className="rounded-[var(--radius-chip)] border border-white/20 px-2 py-0.5 text-[0.7rem]">Captions available</span>
          )}
          {video.description && <span className="basis-full text-white/60">{video.description}</span>}
          {video.transcriptUrl && <a className="underline" href={video.transcriptUrl}>Transcript</a>}
        </div>
      )}
    </>
  );
}
