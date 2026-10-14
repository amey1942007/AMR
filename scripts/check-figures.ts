// Prebuild: every <Figure id="…"> used by a subpage must have a caption + explainer in figures.ts that passes the
// §11.7 rules (getFigure throws otherwise), and every figures.ts entry must be used. Fails the build on any gap.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { figures, getFigure } from '../src/data/pages/figures';

const walk = (d: string): string[] => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
const used = new Set<string>();
let fail = false;
for (const p of walk(join('src', 'app')).filter((p) => p.endsWith('.tsx'))) {
  for (const m of readFileSync(p, 'utf8').matchAll(/<Figure\b[^>]*\bid="([^"]+)"/g)) used.add(m[1]);
  if (/<Figure\b(?![^>]*\bid=")/.test(readFileSync(p, 'utf8'))) { console.error(`FAIL  ${p}: <Figure> without a literal id`); fail = true; }
}
for (const id of used) {
  try { getFigure(id); console.log(`ok    figure ${id}`); } catch (e) { console.error(`FAIL  ${(e as Error).message}`); fail = true; }
}
for (const id of Object.keys(figures)) if (!used.has(id)) { console.error(`FAIL  figure ${id} has text but is not used on any page`); fail = true; }
process.exit(fail ? 1 : 0);
