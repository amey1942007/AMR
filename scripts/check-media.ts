// ui-spec §14.2 / §14.7: every file referenced by simulationVideo must exist in public/ (fail the build, never
// silently), and the 1920 poster must be ≤ 180 KB (≤ 450 KB for the 3840 one). Run in prebuild via tsx.
import { existsSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { simulationVideo, mediaFilePaths } from '../src/data/media';

const root = process.env.MEDIA_CHECK_ROOT ?? 'public';
const v = simulationVideo;
if (!v) { console.log('ok    simulationVideo = null (placeholder)'); process.exit(0); }
if (process.env.NEXT_PUBLIC_SIM_VIDEO_FIXTURE === '1' && !process.env.MEDIA_CHECK_ROOT) { console.log('ok    e2e fixture video (served by Playwright)'); process.exit(0); }
let fail = false;
for (const p of mediaFilePaths(v)) {
  const file = join(root, p);
  if (!existsSync(file)) { console.log(`FAIL  missing media file: ${file}`); fail = true; continue; }
  const kb = statSync(file).size / 1024;
  const poster = /poster/.test(p) && /\.(avif|webp|jpe?g|png)$/.test(p);
  const max = poster ? (/-2x\./.test(p) ? 450 : 180) : Infinity;
  if (kb > max) { console.log(`FAIL  ${file}: ${kb.toFixed(1)} KB > ${max} KB`); fail = true; }
  else console.log(`ok    ${file}: ${kb.toFixed(1)} KB`);
}
process.exit(fail ? 1 : 0);
