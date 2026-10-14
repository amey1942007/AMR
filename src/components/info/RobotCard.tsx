import type { RobotSpec } from '@/lib/content';
import { ExternalLink } from '@/components/icons';

/** Text-only card; `robot.image` is the reserved image slot (renders only when provided). */
export function RobotCard({ robot }: { robot: RobotSpec }) {
  const dev = robot.id === 'amr4';
  return (
    <article className="reveal glass flex max-w-[560px] flex-col rounded-[var(--radius-card)] p-8 transition-colors duration-200 hover:border-white/25" aria-labelledby={`robot-${robot.id}`}>
      {robot.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={robot.image.src} alt={robot.image.alt} width={robot.image.width} height={robot.image.height} loading="lazy" className="mb-6 h-auto w-full rounded-[12px]" />
      )}
      <span className={`eyebrow inline-flex h-6 w-fit items-center rounded-full border px-[10px] text-white ${dev ? 'border-magenta' : 'border-white/40'}`}>
        {robot.badge}
      </span>
      <h3 id={`robot-${robot.id}`} className="mt-5 text-[length:var(--text-h3)] font-semibold leading-[1.15] tracking-[-0.01em]">{robot.name}</h3>
      <p className="mt-2 text-muted">{robot.summary}</p>
      <dl className="mt-6 grid grid-cols-1 gap-x-6 gap-y-4 sm:grid-cols-2">
        {robot.specs.map((s) => (
          <div key={s.label} className={s.value.length > 60 ? 'sm:col-span-2' : ''}>
            <dt className="eyebrow text-muted">{s.label}</dt>
            <dd className="mt-2 text-white">{s.value}</dd>
          </div>
        ))}
      </dl>
      <a href={robot.codeUrl} target="_blank" rel="noopener noreferrer" className="mt-8 inline-flex min-h-11 w-fit items-center gap-2 text-white underline-offset-4 hover:underline">
        View code — branch <code className="font-mono">{robot.branch}</code>
        <ExternalLink />
        <span className="sr-only">(opens in new tab)</span>
      </a>
    </article>
  );
}
