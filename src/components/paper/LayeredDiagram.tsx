import type { Arch, ArchNode } from '@/data/pages/architecture';
import { svgA11y } from './svgA11y';

const W = 1000, GUT = 170, MW = 44, BAND = 84, NH = 40;

function layout(a: Arch) {
  const pos = new Map<string, { x: number; y: number; w: number; node: ArchNode }>();
  const inner = W - GUT - MW - 24;
  a.layers.forEach((l, li) => {
    const slot = inner / l.nodes.length;
    l.nodes.forEach((nd, ni) => {
      const w = Math.min(slot - 16, 210);
      pos.set(nd.id, { x: GUT + ni * slot + (slot - w) / 2, y: li * BAND + (BAND - NH) / 2, w, node: nd });
    });
  });
  return pos;
}

/**
 * Hand-built layered architecture SVG (≥ 768 px), vertical stacked cards below 768, plus a text description.
 * Solid border = verified, dashed = from notes, dashed + "absent" label in muted = not built / not confirmed.
 */
export function LayeredDiagram({ arch, title }: { arch: Arch; title: string }) {
  const pos = layout(arch);
  const H = arch.layers.length * BAND;
  const label = (id: string) => pos.get(id)?.node.label ?? id;
  const sendsTo = (id: string) => arch.edges.filter((e) => e.from === id).map((e) => label(e.to));
  const mk = `arrow-${arch.robot}-${arch.layers.length}`;
  const a = svgA11y(title, `Layered diagram, ${arch.layers.map((l) => `${l.label}: ${l.nodes.map((n) => (n.status === 'absent' ? 'absent' : n.label)).join(', ')}`).join('; ')}. Middleware: ${arch.middleware}. Full text description follows.`, arch.robot);
  return (
    <div>
      <svg {...a.props} viewBox={`0 0 ${W} ${H}`} className="hidden w-full @[900px]:block">{a.nodes}
        <defs>
          <marker id={mk} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z" fill="rgba(255,255,255,.6)" /></marker>
        </defs>
        {arch.layers.map((l, i) => (
          <g key={l.id}>
            <rect x={0} y={i * BAND + 2} width={W - MW - 8} height={BAND - 4} rx={10} fill={i % 2 ? 'rgba(255,255,255,.02)' : 'rgba(255,255,255,.04)'} />
            <text x={14} y={i * BAND + BAND / 2 + 4} fill="#8A8794" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{l.label}</text>
          </g>
        ))}
        <rect x={W - MW} y={2} width={MW - 4} height={H - 4} rx={10} fill="none" stroke="#7B2FF7" strokeOpacity={0.6} />
        <text transform={`translate(${W - MW / 2 + 2} ${H / 2}) rotate(-90)`} textAnchor="middle" fill="#fff" style={{ fontFamily: 'var(--font-mono)', fontSize: 14 }}>{arch.middleware}</text>
        {arch.edges.map((e) => {
          const a = pos.get(e.from), b = pos.get(e.to);
          if (!a || !b) return null;
          const ax = a.x + a.w / 2, bx = b.x + b.w / 2;
          const up = b.y < a.y;
          const ay = up ? a.y : a.y + NH, by = up ? b.y + NH : b.y;
          const same = a.y === b.y;
          const d = same ? `M${a.x + a.w} ${a.y + NH / 2} L${b.x} ${b.y + NH / 2}` : `M${ax} ${ay} C${ax} ${(ay + by) / 2} ${bx} ${(ay + by) / 2} ${bx} ${by}`;
          return <path key={`${e.from}-${e.to}`} d={d} fill="none" stroke="rgba(255,255,255,.5)" strokeWidth={1} markerEnd={`url(#${mk})`} />;
        })}
        {[...pos.values()].map(({ x, y, w, node }) => (
          <g key={node.id} data-status={node.status}>
            <rect x={x} y={y} width={w} height={NH} rx={8} fill={node.status === 'absent' ? 'transparent' : '#0A0A10'} stroke={node.status === 'absent' ? 'rgba(255,255,255,.35)' : 'rgba(255,255,255,.4)'} strokeDasharray={node.status === 'verified' ? undefined : '5 4'} />
            <text x={x + w / 2} y={y + NH / 2 + 5} textAnchor="middle" fill={node.status === 'absent' ? '#8A8794' : '#fff'} style={{ fontFamily: 'var(--font-inter-tight)', fontSize: 15, fontWeight: 500 }}>{node.label}</text>
          </g>
        ))}
      </svg>
      <ol className="flex flex-col gap-3 @[900px]:hidden" aria-hidden>
        <li className="rounded-[10px] border border-violet/60 px-3 py-2 font-mono text-[12px] text-white">Middleware: {arch.middleware}</li>
        {arch.layers.map((l) => (
          <li key={l.id} className="rounded-[10px] bg-white/[.04] p-3">
            <p className="font-mono text-[12px] text-muted">{l.label}</p>
            <ul className="mt-2 flex flex-col gap-2">
              {l.nodes.map((nd) => (
                <li key={nd.id} className={`rounded-[8px] border px-3 py-2 text-[14px] ${nd.status === 'verified' ? 'border-white/40' : 'border-dashed border-white/35'} ${nd.status === 'absent' ? 'text-muted' : 'text-white'}`}>
                  {nd.label}
                  {sendsTo(nd.id).map((t) => <span key={t} className="block font-mono text-[12px] text-muted">→ to {t}</span>)}
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      <details className="mt-4 text-[length:var(--text-small)]">
        <summary className="inline-flex min-h-11 cursor-pointer items-center text-white/80 hover:text-white">Text description</summary>
        <ol className="mt-2 list-decimal pl-5 text-white/85">
          <li>Middleware spanning all layers: {arch.middleware}</li>
          {arch.layers.map((l) => (
            <li key={l.id}>{l.label}
              <ul className="list-disc pl-5">
                {l.nodes.map((nd) => <li key={nd.id}>{nd.status === 'absent' ? 'absent (not built or not confirmed)' : nd.label}{sendsTo(nd.id).length ? `, sends to ${sendsTo(nd.id).join(', ')}` : ''}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
