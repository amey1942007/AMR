import type { MediaVideo } from '@/services/types';
import { asset } from '@/lib/asset';

/**
 * ui-spec §14.2. Swap the video by editing this file only: set `simulationVideo` to a file / youtube / vimeo entry,
 * or leave it `null` for the "SIMULATION VIDEO · COMING SOON" placeholder. The prebuild check fails the build when
 * a referenced file is missing (never silently).
 */
const REAL: MediaVideo | null = null;

/**
 * e2e only (NEXT_PUBLIC_SIM_VIDEO_FIXTURE=1, build-time): a tiny file entry under /video/__e2e__/ whose bytes Playwright
 * serves with page.route (nothing ships in public/). Never set in a deploy build.
 */
const FIXTURE: MediaVideo = {
  kind: 'file',
  title: 'Simulation fixture',
  description: 'Test clip.',
  durationSec: 3,
  poster: asset('/video/__e2e__/sim-poster.webp'),
  sources: [{ src: asset('/video/__e2e__/sim.webm'), type: 'video/webm' }, { src: asset('/video/__e2e__/sim.mp4'), type: 'video/mp4' }],
  captions: [{ src: asset('/video/__e2e__/sim.en.vtt'), srclang: 'en', label: 'English' }],
};

export const simulationVideo: MediaVideo | null = process.env.NEXT_PUBLIC_SIM_VIDEO_FIXTURE === '1' ? FIXTURE : REAL;

/** Optional: a file entry once assets land in public/video/. Kept here so the prebuild and MediaService share one source. */
export const SIMULATION_FILE_EXAMPLE: MediaVideo = {
  kind: 'file',
  title: 'AMR4 mapping run (simulation)',
  description: 'Simulation of AMR4 mapping a 10 × 7 m apartment; no narration.',
  durationSec: 75,
  width: 1920,
  height: 1080,
  poster: asset('/video/simulation-poster.webp'),
  posterSet: {
    avif: asset('/video/simulation-poster.avif'),
    webp: asset('/video/simulation-poster.webp'),
    avif2x: asset('/video/simulation-poster-2x.avif'),
    webp2x: asset('/video/simulation-poster-2x.webp'),
  },
  sources: [
    { src: asset('/video/simulation.webm'), type: 'video/webm' },
    { src: asset('/video/simulation.mp4'), type: 'video/mp4' },
  ],
  captions: [{ src: asset('/video/simulation.en.vtt'), srclang: 'en', label: 'English', default: true }],
};

/** Paths a `kind:'file'` entry must resolve (relative to public/). Used by scripts/check-media.mjs. */
export function mediaFilePaths(v: MediaVideo): string[] {
  if (v.kind !== 'file') return [];
  const out = [v.poster, ...v.sources.map((s) => s.src), ...(v.captions?.map((c) => c.src) ?? [])];
  if (v.posterSet) out.push(...Object.values(v.posterSet).filter(Boolean) as string[]);
  return out.map((p) => p.replace(/\?.*$/, '').replace(/^\//, ''));
}
