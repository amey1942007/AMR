import type { MediaVideo } from '@/services/types';
import { asset } from '@/lib/asset';

/**
 * ui-spec §14.2. Prefer publishing a row in Supabase `site_videos` (id = `simulation`, published = true).
 * This file is an optional local override: set `simulationVideo` to a file / youtube / vimeo entry, or leave it
 * `null` so the UI loads from the DB (or shows "SIMULATION VIDEO · COMING SOON"). The prebuild check fails the
 * build when a referenced file is missing (never silently).
 *
 * When `simulationSlides` is non-empty, the Simulation section uses the coverflow carousel instead of the
 * single-slot player / Coming Soon placeholder. Add Drive-hosted clips here as more demos land.
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

/** One carousel slide — Google Drive file (shared) + local poster. Append more as demos ship. */
export type SimulationSlide = {
  id: string;
  title: string;
  description?: string;
  durationSec?: number;
  /** Shared Google Drive file id → `/file/d/{id}/preview` embed. */
  driveId: string;
  poster: string;
};

/**
 * Hero simulation carousel (Drive folder demos). Side-by-side coverflow; drag or arrows for next.
 * Source folder: https://drive.google.com/drive/folders/1ZrrKsbYMGt1IxCyFVXAASHwaje1rcNoL
 */
export const simulationSlides: SimulationSlide[] = [
  {
    id: 'autonomous',
    title: 'Autonomous exploration',
    description: 'Frontier exploration builds the occupancy map room by room.',
    durationSec: 377,
    driveId: '1i1sdu3n39QV4dGb6r0yZMLdmqEArgOvY',
    poster: asset('/video/sim-autonomous-poster.webp'),
  },
  {
    id: 'manual',
    title: 'Manual teleop control',
    description: 'Drive from the browser pad while SLAM runs live.',
    durationSec: 143,
    driveId: '1lCqyHsr0jLqlJn4mpqnZ6AOy_dc7w2Pk',
    poster: asset('/video/sim-manual-poster.webp'),
  },
];

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

/** Poster paths for carousel slides (prebuild size check). */
export function simulationSlidePosterPaths(): string[] {
  return simulationSlides.map((s) => s.poster.replace(/\?.*$/, '').replace(/^\//, ''));
}
