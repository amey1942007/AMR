import { icons } from './icons';

export type StackRobot = 'hardware' | 'amr4' | 'both' | 'site';
export interface StackItem { name: string; icon?: string; robot: StackRobot; absent?: boolean }
export interface StackTier { label: string; items: StackItem[] }

function Dot({ robot }: { robot: StackRobot }) {
  const dots = robot === 'both' ? (['hardware', 'amr4'] as const) : robot === 'site' ? [] : [robot];
  return (
    <>
      {dots.map((d) => <span key={d} aria-hidden className={`inline-block h-2 w-2 rounded-full ${d === 'hardware' ? 'bg-white' : 'bg-violet'}`} />)}
      <span className="sr-only">{robot === 'both' ? ' (HW and AMR4)' : robot === 'hardware' ? ' (HW)' : robot === 'amr4' ? ' (AMR4)' : ' (website)'}</span>
    </>
  );
}

/** Layer cake, rendered bottom → top (tiers given bottom-first). Chips are real <ul>s; robot dots have sr-only text. */
export function StackDiagram({ tiers }: { tiers: StackTier[] }) {
  return (
    <div>
      <div className="flex flex-col-reverse gap-2">
        {tiers.map((t) => (
          <div key={t.label} className="grid grid-cols-1 gap-2 rounded-[12px] bg-white/[.04] p-3 md:grid-cols-[150px_1fr] md:items-center">
            <p className="font-mono text-[12px] text-muted">{t.label}</p>
            <ul className="flex flex-wrap gap-2">
              {t.items.map((it) => (
                <li key={it.name} className={`inline-flex min-h-9 w-full items-center gap-2 rounded-[var(--radius-chip)] border px-3 text-[14px] sm:w-auto ${it.absent ? 'border-dashed border-white/30 text-muted' : 'border-[var(--line-dark)] text-white'}`}>
                  {it.icon && icons[it.icon] && <svg aria-hidden viewBox="0 0 24 24" width={14} height={14} fill="currentColor" opacity={0.8}><path d={icons[it.icon]} /></svg>}
                  {it.name}
                  <Dot robot={it.robot} />
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
      <p className="mt-4 flex flex-wrap gap-4 font-mono text-[12px] text-muted">
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-white" />Hardware Bot</span>
        <span className="inline-flex items-center gap-2"><span aria-hidden className="h-2 w-2 rounded-full bg-violet" />AMR4</span>
      </p>
    </div>
  );
}
