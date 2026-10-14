// Renders diagrams/*.mmd → src/generated/diagrams/*.svg at BUILD TIME with mermaid-cli (never shipped to the
// browser). Run after editing a .mmd: `npm run render:diagrams` (needs Chrome; set PUPPETEER_EXECUTABLE_PATH if
// puppeteer has no bundled browser). The output is committed so `next build` / CI never need Chrome; the prebuild
// check (check-diagrams.mjs) fails the build if an .mmd changed without re-rendering. Works on Windows (shell npx).
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { mkdirSync, readdirSync, readFileSync, writeFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

const MMDC = '@mermaid-js/mermaid-cli@11.17.0';
const src = 'diagrams', out = join('src', 'generated', 'diagrams');
mkdirSync(out, { recursive: true });
for (const f of readdirSync(src).filter((f) => f.endsWith('.mmd'))) {
  const name = f.replace(/\.mmd$/, '');
  const text = readFileSync(join(src, f), 'utf8').replace(/\r\n/g, '\n');
  const sha = createHash('sha256').update(text + readFileSync(join(src, 'mermaid.config.json'), 'utf8').replace(/\r\n/g, '\n')).digest('hex').slice(0, 16);
  // Two variants: left-to-right for wide containers, top-to-bottom (-tb) below 768 px so text stays ≥ 12 px.
  for (const [suffix, body] of [['', text], ['-tb', text.replace(/^flowchart LR/m, 'flowchart TB')]]) {
  const inFile = join(tmpdir(), `mmd-${name}${suffix}-${process.pid}.mmd`);
  writeFileSync(inFile, body);
  const tmp = join(tmpdir(), `mmd-${name}${suffix}-${process.pid}.svg`);
  const args = [...(process.env.MMDC_LOCAL ? [] : ['-y', '-p', MMDC]), 'mmdc', '-i', inFile, '-o', tmp, '-c', join(src, 'mermaid.config.json'), '-p', join(src, 'puppeteer.json'), '-b', 'transparent', '-I', `mmd-${name}${suffix}`];
  execFileSync(process.env.MMDC_LOCAL ? args.shift() : process.platform === 'win32' ? 'npx.cmd' : 'npx', args, { stdio: 'inherit', shell: process.platform === 'win32' });
  const svg = readFileSync(tmp, 'utf8');
  rmSync(tmp, { force: true }); rmSync(inFile, { force: true });
  writeFileSync(join(out, `${name}${suffix}.svg`), `<!-- generated from diagrams/${f} src-sha256:${sha} -->\n${svg}\n`);
  console.log(`rendered ${name}${suffix}.svg (${sha})`);
  }
}
