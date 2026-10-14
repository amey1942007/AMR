/**
 * Hand-built SSR SVG charts (pages-spec §11.2/§11.3): no chart library, zero client JS. Hardware Bot = white,
 * AMR4 = violet. Every chart has direct labels on each mark and an always-in-DOM <details> data table.
 */
import { Absent } from './Absent';
import { svgA11y } from './svgA11y';

export const SERIES = { hardware: { name: 'Hardware Bot', color: '#FFFFFF' }, amr4: { name: 'AMR4', color: '#7B2FF7' } } as const;
type RobotId = keyof typeof SERIES;

/** Linear scale (the d3-scale subset we need). */
export function linear([d0, d1]: [number, number], [r0, r1]: [number, number]) {
  return (v: number) => r0 + ((v - d0) / (d1 - d0)) * (r1 - r0);
}

function DataTableDetails({ caption, cols, rows }: { caption: string; cols: string[]; rows: (string | null)[][] }) {
  return (
    <details className="mt-4 text-[length:var(--text-small)]">
      <summary className="inline-flex min-h-11 cursor-pointer items-center text-white/80 hover:text-white">Show data table</summary>
      <table className="mt-2 w-full border-collapse text-left">
        <caption className="sr-only">{caption}</caption>
        <thead><tr>{cols.map((c) => <th key={c} scope="col" className="eyebrow border-b border-[var(--line-dark)] py-2 pr-4 font-medium text-muted">{c}</th>)}</tr></thead>
        <tbody>
          {rows.map((r) => (
            <tr key={String(r[0])}>{r.map((c, i) => (i === 0
              ? <th key={i} scope="row" className="border-b border-[var(--line-dark)] py-2 pr-4 font-medium text-white">{c}</th>
              : <td key={i} className="border-b border-[var(--line-dark)] py-2 pr-4 text-white">{c ?? <Absent />}</td>))}</tr>
          ))}
        </tbody>
      </table>
    </details>
  );
}

const MONO = { fontFamily: 'var(--font-mono)', fontSize: 15 } as const;

/** kind 'range': one horizontal track per series; null = dashed empty track "not stated in branch". */
export function RangeChart({ title, unit, max, rows }: { title: string; unit: string; max: number; rows: { robot: RobotId; label: string; range: readonly [number, number] | null }[] }) {
  const W = 760, L = 250, R = 40, rowH = 56, H = rows.length * rowH + 40;
  const x = linear([0, max], [L, W - R]);
  const ticks = [0, max / 4, max / 2, (3 * max) / 4, max];
  const a = svgA11y(title, `${rows.map((r) => `${r.label}: ${r.range ? `${r.range[0]} to ${r.range[1]} ${unit}` : 'not stated in branch'}`).join('; ')}.`);
  return (
    <div>
      <svg {...a.props} viewBox={`0 0 ${W} ${H}`} className="hidden w-full @[640px]:block">{a.nodes}
        {ticks.map((t) => (
          <g key={t}>
            <line x1={x(t)} x2={x(t)} y1={H - 30} y2={H - 24} stroke="rgba(255,255,255,.12)" />
            <text x={x(t)} y={H - 8} textAnchor="middle" fill="#8A8794" style={MONO}>{t} {unit}</text>
          </g>
        ))}
        <line x1={L} x2={W - R} y1={H - 30} y2={H - 30} stroke="rgba(255,255,255,.12)" />
        {rows.map((r, i) => {
          const y = 20 + i * rowH;
          const c = SERIES[r.robot].color;
          return (
            <g key={r.label}>
              <text x={0} y={y + 14} fill="#fff" style={MONO}>{r.label}</text>
              {r.range ? (
                <>
                  <rect x={x(r.range[0])} y={y} width={Math.max(2, x(r.range[1]) - x(r.range[0]))} height={18} rx={4} fill={c} />
                  <text x={x(r.range[1])} y={y + 36} textAnchor="end" fill="#fff" style={MONO}>{r.range[0]}–{r.range[1]} {unit}</text>
                </>
              ) : (
                <>
                  <rect x={L} y={y} width={W - R - L} height={18} rx={4} fill="none" stroke={c} strokeOpacity={0.5} strokeDasharray="6 5" />
                  <text x={L + 8} y={y + 36} fill="#8A8794" style={MONO}>not stated in branch</text>
                </>
              )}
            </g>
          );
        })}
      </svg>
      <ul className="flex flex-col gap-4 @[640px]:hidden" aria-hidden>
        {rows.map((r) => (
          <li key={r.label}>
            <p className="font-mono text-[12px] text-white">{r.label}</p>
            <div className="relative mt-1 h-4 rounded border border-white/10">
              {r.range
                ? <span className="absolute inset-y-0 rounded" style={{ left: `${(r.range[0] / max) * 100}%`, width: `${((r.range[1] - r.range[0]) / max) * 100}%`, background: SERIES[r.robot].color }} />
                : <span className="absolute inset-0 rounded border border-dashed border-white/40" />}
            </div>
            <p className="mt-1 font-mono text-[12px] text-muted">{r.range ? `${r.range[0]}–${r.range[1]} ${unit}` : 'not stated in branch'}</p>
          </li>
        ))}
      </ul>
      <DataTableDetails caption={title} cols={['Robot · sensor', `Min (${unit})`, `Max (${unit})`]} rows={rows.map((r) => [r.label, r.range ? String(r.range[0]) : null, r.range ? String(r.range[1]) : null])} />
    </div>
  );
}

/** kind 'dot' used as a to-scale footprint plot: each robot = one outlined rectangle (width × length, metres). */
export function FootprintChart({ title, items }: { title: string; items: { robot: RobotId; w: number; l: number }[] }) {
  const S = 400, W = 720, H = 330, pad = 40; // 1 m = 400 px
  const xs = items.reduce<number[]>((a, it, i) => [...a, i === 0 ? pad + 40 : a[i - 1] + items[i - 1].w * S + 80], []);
  const a = svgA11y(title, `Drawn to scale. ${items.map((i) => `${SERIES[i.robot].name} ${i.w} by ${i.l} metres`).join('; ')}.`);
  return (
    <div>
      <ul className="flex flex-wrap items-end gap-8 @[640px]:hidden" aria-hidden>
        {items.map((it) => (
          <li key={it.robot} className="flex flex-col items-center gap-2">
            <span className="font-mono text-[13px] text-white">{SERIES[it.robot].name}</span>
            <span className="font-mono text-[12px] text-muted">{it.w} × {it.l} m</span>
            <span className="block rounded-[4px] border-2" style={{ borderColor: SERIES[it.robot].color, width: `${it.w * 220}px`, height: `${it.l * 220}px` }} />
          </li>
        ))}
      </ul>
      <svg {...a.props} viewBox={`0 0 ${W} ${H}`} className="hidden w-full @[640px]:block">{a.nodes}
        <line x1={pad} x2={pad + S * 0.5} y1={H - 16} y2={H - 16} stroke="#8A8794" />
        <text x={pad + S * 0.25} y={H - 22} textAnchor="middle" fill="#8A8794" style={MONO}>0.5 m</text>
        {items.map((it, i) => {
          const w = it.w * S, l = it.l * S, x = xs[i], y = H - 40 - l;
          const c = SERIES[it.robot].color;
          return (
            <g key={it.robot}>
              <rect x={x} y={y} width={w} height={l} rx={6} fill="none" stroke={c} strokeWidth={2} />
              <text x={x + w / 2} y={y - 26} textAnchor="middle" fill="#fff" style={{ ...MONO, fontSize: 16 }}>{SERIES[it.robot].name}</text>
              <text x={x + w / 2} y={y - 8} textAnchor="middle" fill="#8A8794" style={MONO}>{it.w} × {it.l} m</text>
            </g>
          );
        })}
      </svg>
      <DataTableDetails caption={title} cols={['Robot', 'Width (m)', 'Length (m)']} rows={items.map((i) => [SERIES[i.robot].name, String(i.w), String(i.l)])} />
    </div>
  );
}

/** kind 'matrix': rows × robot columns; null = ABSENT. Values are text, never colour-only. */
export function MatrixChart({ title, rows }: { title: string; rows: { label: string; hardware: string | null; amr4: string | null }[] }) {
  return (
    <div>
      <table className="w-full border-collapse text-left" aria-describedby={undefined}>
        <caption className="sr-only">{title}</caption>
        <thead>
          <tr>
            <td />
            {(['hardware', 'amr4'] as const).map((r) => (
              <th key={r} scope="col" className="py-2 pr-4 font-semibold text-white">
                <span aria-hidden className="mr-2 inline-block h-2.5 w-2.5 rounded-full" style={{ background: SERIES[r].color }} />{SERIES[r].name}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.label} className="border-t border-[var(--line-dark)]">
              <th scope="row" className="eyebrow py-3 pr-4 font-medium text-muted">{r.label}</th>
              {(['hardware', 'amr4'] as const).map((k) => (
                <td key={k} className="py-3 pr-4 text-white" data-robot={k}>{r[k] ? <><span aria-hidden>✓ </span>{r[k]}</> : <Absent />}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <DataTableDetails caption={title} cols={['Sensor', 'Hardware Bot', 'AMR4']} rows={rows.map((r) => [r.label, r.hardware, r.amr4])} />
    </div>
  );
}

/** kind 'bar' (horizontal): direct value labels; null values render a dashed absent track. */
export function BarChart({ title, unit, rows }: { title: string; unit: string; rows: { label: string; robot: RobotId; value: number | null }[] }) {
  const max = Math.max(1, ...rows.map((r) => r.value ?? 0));
  return (
    <div>
      <ul className="flex flex-col gap-3" aria-label={title}>
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-1 gap-1 md:grid-cols-[180px_1fr] md:items-center">
            <span className="font-mono text-[12px] text-white">{r.label}</span>
            <span className="flex items-center gap-3">
              {r.value != null
                ? <span className="h-4 rounded" style={{ width: `${(r.value / max) * 80}%`, background: SERIES[r.robot].color }} />
                : <span className="h-4 w-4/5 rounded border border-dashed border-white/40" />}
              <span className="font-mono text-[12px] text-white">{r.value != null ? `${r.value} ${unit}` : 'absent'}</span>
            </span>
          </li>
        ))}
      </ul>
      <DataTableDetails caption={title} cols={['Item', `Value (${unit})`]} rows={rows.map((r) => [r.label, r.value != null ? String(r.value) : null])} />
    </div>
  );
}

/** Chart-family horizontal timeline; undated items show "date pending" (no invented dates). */
export function Timeline({ title, items }: { title: string; items: { label: string; date?: string; robot?: RobotId }[] }) {
  return (
    <div>
      <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-3 md:gap-4" aria-label={title}>
        <span aria-hidden className="absolute top-[7px] right-0 left-0 hidden h-px bg-white/20 md:block" />
        {items.map((it) => (
          <li key={it.label} className="relative flex gap-3 md:block">
            <span aria-hidden className="relative z-[1] mt-0.5 block h-3.5 w-3.5 shrink-0 rounded-full border-2" style={{ borderColor: it.robot ? SERIES[it.robot].color : '#E81CB0', background: '#050507' }} />
            <div className="md:mt-4">
              <p className="font-mono text-[12px] text-muted">{it.date ?? 'date pending'}</p>
              <p className="mt-1 text-white">{it.label}</p>
            </div>
          </li>
        ))}
      </ol>
      <DataTableDetails caption={title} cols={['Milestone', 'Date']} rows={items.map((i) => [i.label, i.date ?? 'pending'])} />
    </div>
  );
}
