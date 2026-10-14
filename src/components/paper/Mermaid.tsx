import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');

/** Load a build-time SVG and inject role/title/desc; keep mermaid's natural max-width (never upscale). */
function load(file: string, id: string, title: string, desc: string) {
  const raw = readFileSync(join(process.cwd(), 'src', 'generated', 'diagrams', file), 'utf8').replace(/<!--[\s\S]*?-->/g, '');
  return raw
    .replace(/<svg ([^>]*?)aria-roledescription="[^"]*"/, '<svg $1')
    .replace(/<svg /, `<svg role="img" aria-labelledby="${id}-t ${id}-d" `)
    .replace(/(<svg[^>]*>)/, `$1<title id="${id}-t">${esc(title)}</title><desc id="${id}-d">${esc(desc)}</desc>`)
    .replace(/style="max-width: ?([\d.]+)px;?"/, 'style="max-width:$1px;width:100%;height:auto"');
}

/**
 * Inlines a build-time mermaid SVG (scripts/render-diagrams.mjs → src/generated/diagrams). Server Component only: no
 * mermaid runtime, no client JS. Wide containers get the left-to-right layout; narrow ones (< 860 px of figure width)
 * get the top-to-bottom (-tb) render, so text stays ≥ 12 px.
 */
export function Mermaid({ name, title, label }: { name: string; title: string; label: string }) {
  return (
    <div className="mermaid-figure">
      <div className="hidden justify-center @[860px]:flex" dangerouslySetInnerHTML={{ __html: load(`${name}.svg`, `mmd-${name}-lr`, title, label) }} />
      <div className="flex justify-center @[860px]:hidden" dangerouslySetInnerHTML={{ __html: load(`${name}-tb.svg`, `mmd-${name}-tb`, title, label) }} />
    </div>
  );
}
