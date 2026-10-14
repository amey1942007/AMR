import { staticMedia } from '@/services/adapters/media.static';
import { WaveLines } from '@/components/effects/WaveLines';
import { FxPause } from '@/components/effects/FxPause';
import { SimulationFacade } from '@/components/video/SimulationFacade';
import '@/components/effects/effects.css';

function fmt(sec?: number) {
  if (sec == null) return '';
  const m = Math.floor(sec / 60), s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

/**
 * ui-spec §14: first block of #info, before the robot cards. Server component: the placeholder ships as HTML/CSS
 * (0 JS beyond the tiny FxPause island); a real entry ships only the click-to-play facade.
 */
export function SimulationSection() {
  const v = staticMedia.getVideo('simulation');
  const dur = fmt(v?.durationSec);
  return (
    <section id="simulation" aria-labelledby="sim-title" className="reveal">
      <p className="eyebrow text-muted">SIMULATION</p>
      <h2 id="sim-title" className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]">Watch the mapping run.</h2>
      <p id="sim-lead" className="mt-4 max-w-[60ch] text-muted">A full run in simulation: the robot drives the apartment and builds its map, room by room.</p>
      <div className="mx-auto mt-8 w-full max-w-[1100px] max-[1439px]:max-w-[960px]" data-lenis-prevent aria-describedby="sim-lead">
        {v ? (
          <SimulationFacade video={v} label={`Play: ${v.title}${dur ? ` (${dur})` : ''}`} />
        ) : (
          <div className="glass relative aspect-video w-full overflow-hidden rounded-[var(--radius-card)] max-md:rounded-[12px]" role="img" aria-label="Simulation video coming soon" data-fx-host>
            <FxPause />
            <WaveLines className="!inset-0 !h-full opacity-60" />
            <div className="absolute inset-0 grid place-items-center">
              <span aria-hidden className="font-display text-[40px] font-extrabold tracking-[-0.04em] text-white/40">AMR</span>
              <span aria-hidden className="eyebrow absolute bottom-6 text-white/80">SIMULATION VIDEO · COMING SOON</span>
            </div>
          </div>
        )}
      </div>
      {v && (
        <div className="mx-auto mt-3 flex max-w-[1100px] flex-wrap items-center gap-3 text-[length:var(--text-small)] text-muted max-[1439px]:max-w-[960px]">
          <span>{v.title}</span>
          {dur && <span className="font-mono">{dur}</span>}
          {(v.kind === 'file' ? !!v.captions?.length : v.captions === 'provider') && <span className="rounded-[var(--radius-chip)] border border-white/20 px-2 py-0.5 text-[0.7rem]">Captions available</span>}
          {v.description && <span className="basis-full text-white/60">{v.description}</span>}
          {v.transcriptUrl && <a className="underline" href={v.transcriptUrl}>Transcript</a>}
        </div>
      )}
    </section>
  );
}
