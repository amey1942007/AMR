// ui-spec §14.2 / §14.7: every file referenced by simulationVideo / simulationSlides must exist in public/
// (fail the build, never silently), and posters must be ≤ 180 KB (≤ 450 KB for *2x*). Run in prebuild via tsx.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { simulationVideo, mediaFilePaths, simulationSlidePosterPaths } from '../src/data/media';

const root = process.env.MEDIA_CHECK_ROOT ?? 'public';
let fail = false;

function checkPoster(file: string) {
  const kb = statSync(file).size / 1024;
  const max = /-2x\./.test(file) ? 450 : 180;
  if (kb > max) { console.log(`FAIL  ${file}: ${kb.toFixed(1)} KB > ${max} KB`); fail = true; }
  else console.log(`ok    ${file}: ${kb.toFixed(1)} KB`);
}

const slides = simulationSlidePosterPaths();
if (slides.length) {
  for (const p of slides) {
    const file = join(root, p);
    if (!existsSync(file)) { console.log(`FAIL  missing slide poster: ${file}`); fail = true; continue; }
    checkPoster(file);
  }
} else {
  console.log('ok    simulationSlides = [] (no carousel posters)');
}

const v = simulationVideo;
if (!v) {
  console.log('ok    simulationVideo = null (placeholder / carousel)');
  process.exit(fail ? 1 : 0);
}
if (process.env.NEXT_PUBLIC_SIM_VIDEO_FIXTURE === '1' && !process.env.MEDIA_CHECK_ROOT) {
  console.log('ok    e2e fixture video (served by Playwright)');
  process.exit(fail ? 1 : 0);
}
for (const p of mediaFilePaths(v)) {
  const file = join(root, p);
  if (!existsSync(file)) { console.log(`FAIL  missing media file: ${file}`); fail = true; continue; }
  const poster = /poster/.test(p) && /\.(avif|webp|jpe?g|png)$/.test(p);
  if (poster) checkPoster(file);
  else {
    const kb = statSync(file).size / 1024;
    console.log(`ok    ${file}: ${kb.toFixed(1)} KB`);
  }
}
process.exit(fail ? 1 : 0);
