import { Absent } from './Absent';
import { COMPARE_KEYS, factFor, type Fact, type RobotFacts } from '@/data/pages/robots';

function Cell({ f }: { f?: Fact }) {
  if (!f || f.absent) return <Absent />;
  return <>{f.value}</>;
}

/** One robot: dl-style table. Pending rows are omitted (never "coming soon"). */
export function SpecTable({ robot, caption }: { robot: RobotFacts; caption: string }) {
  const rows = robot.facts.filter((f) => !f.pending);
  return (
    <table className="spec-table w-full border-collapse text-left">
      <caption className="sr-only">{caption}</caption>
      <tbody className="grid grid-cols-1 gap-x-10 lg:grid-cols-2">
        {rows.map((f) => (
          <tr key={f.key} className="flex flex-col gap-1 border-b border-[var(--line-dark)] py-3 sm:flex-row sm:gap-6">
            <th scope="row" className="eyebrow w-40 shrink-0 pt-1 font-medium text-muted">{f.label}</th>
            <td className="text-white"><Cell f={f} /></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * Two robots side by side ('both'): each column is bound to exactly one robot object. Below 768 px it becomes one
 * table per robot (two separate tables, never interleaved rows).
 */
export function CompareTable({ left, right, caption }: { left: RobotFacts; right: RobotFacts; caption: string }) {
  const label = (k: string) => (factFor(left, k) ?? factFor(right, k) ?? { label: k }).label;
  return (
    <>
      <table className="hidden w-full border-collapse text-left md:table">
        <caption className="sr-only">{caption}</caption>
        <thead>
          <tr className="border-b border-[var(--line-dark)]">
            <td className="py-3" />
            <th scope="col" className="py-3 font-semibold text-white">{left.name}</th>
            <th scope="col" className="py-3 font-semibold text-white">{right.name}</th>
          </tr>
        </thead>
        <tbody>
          {COMPARE_KEYS.map((k) => (
            <tr key={k} className="border-b border-[var(--line-dark)] align-top">
              <th scope="row" className="eyebrow w-40 py-3 pr-4 font-medium text-muted">{label(k)}</th>
              <td className="py-3 pr-6 text-white" data-robot={left.id}><Cell f={factFor(left, k)} /></td>
              <td className="py-3 text-white" data-robot={right.id}><Cell f={factFor(right, k)} /></td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="flex flex-col gap-8 md:hidden">
        {[left, right].map((r) => (
          <table key={r.id} className="w-full border-collapse text-left">
            <caption className="pb-2 text-left font-semibold text-white">{r.name}</caption>
            <tbody>
              {COMPARE_KEYS.map((k) => (
                <tr key={k} className="border-b border-[var(--line-dark)]">
                  <th scope="row" className="eyebrow w-32 py-3 pr-3 font-medium text-muted">{label(k)}</th>
                  <td className="py-3 text-white" data-robot={r.id}><Cell f={factFor(r, k)} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        ))}
      </div>
    </>
  );
}

/** Generic table variant (privacy data-flow): header row + body rows, scope set. */
export function DataTable({ caption, cols, rows }: { caption: string; cols: string[]; rows: string[][] }) {
  return (
    <>
    <dl className="flex flex-col gap-4 md:hidden" aria-label={caption}>
      {rows.map((r) => (
        <div key={r[0]} className="rounded-[10px] border border-[var(--line-dark)] p-4 text-[length:var(--text-small)]">
          <dt className="font-semibold text-white">{r[0]}</dt>
          {r.slice(1).map((c, i) => <dd key={i} className="mt-2 text-white/85"><span className="eyebrow mr-2 text-muted">{cols[i + 1]}</span>{c}</dd>)}
        </div>
      ))}
    </dl>
    <table className="hidden w-full border-collapse text-left text-[length:var(--text-small)] md:table">
      <caption className="sr-only">{caption}</caption>
      <thead><tr className="border-b border-[var(--line-dark)]">{cols.map((c) => <th key={c} scope="col" className="eyebrow py-3 pr-4 font-medium text-muted">{c}</th>)}</tr></thead>
      <tbody>
        {rows.map((r) => (
          <tr key={r[0]} className="border-b border-[var(--line-dark)] align-top">
            {r.map((c, i) => (i === 0 ? <th key={i} scope="row" className="py-3 pr-4 font-semibold text-white">{c}</th> : <td key={i} className="py-3 pr-4 text-white/85">{c}</td>))}
          </tr>
        ))}
      </tbody>
    </table>
    </>
  );
}
