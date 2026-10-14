// Prebuild: every diagrams/*.mmd must have an up-to-date build-time SVG (hash match). Also asserts no mermaid
// runtime is imported anywhere in src/ (pages-spec §11.3: never ship mermaid JS).
import { createHash } from 'node:crypto';
import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';

let fail = false;
for (const f of readdirSync('diagrams').filter((f) => f.endsWith('.mmd'))) {
  const name = f.replace(/\.mmd$/, '');
  const sha = createHash('sha256').update(readFileSync(join('diagrams', f), 'utf8').replace(/\r\n/g, '\n') + readFileSync(join('diagrams', 'mermaid.config.json'), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
  for (const suffix of ['', '-tb']) {
  const svg = join('src', 'generated', 'diagrams', `${name}${suffix}.svg`);
  if (!existsSync(svg)) { console.error(`FAIL  ${svg} missing: run npm run render:diagrams`); fail = true; continue; }
  if (!readFileSync(svg, 'utf8').includes(`src-sha256:${sha}`)) { console.error(`FAIL  ${svg} is stale vs ${f}: run npm run render:diagrams`); fail = true; continue; }
  console.log(`ok    diagram ${name}${suffix}`);
  }
}
const walk = (d) => readdirSync(d).flatMap((f) => { const p = join(d, f); return statSync(p).isDirectory() ? walk(p) : [p]; });
for (const p of walk('src').filter((p) => /\.(t|j)sx?$/.test(p))) {
  if (/from ['"]mermaid['"]|import\(['"]mermaid['"]\)/.test(readFileSync(p, 'utf8'))) { console.error(`FAIL  ${p} imports the mermaid runtime`); fail = true; }
}
process.exit(fail ? 1 : 0);
