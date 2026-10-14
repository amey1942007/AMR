import Link from '@/components/nav/AppLink';
import { PageShell, Cta, meta } from '@/components/paper/PageShell';
import { PageHeader } from '@/components/paper/PageHeader';
import { PaperSection } from '@/components/paper/PaperSection';
import { Figure } from '@/components/paper/Figure';
import { Timeline } from '@/components/paper/Chart';
import { robotFacts } from '@/data/pages/robots';
import { EMAIL, FOUNDER } from '@/lib/content';
import { ArrowRight } from '@/components/icons';

export const metadata = meta('/about/', 'About | AMR', 'AMR is an early-stage autonomous mobile robot startup from India, founded by Amey Chaudhari.');
const ld = { '@context': 'https://schema.org', '@type': 'Person', name: FOUNDER, jobTitle: 'Founder', worksFor: { '@type': 'Organization', name: 'AMR' }, sameAs: ['https://github.com/amey1942007'] };
const contents = [{ id: 'timeline', label: 'Where we are' }, { id: 'founder', label: 'Founder' }, { id: 'building', label: "What we're building" }, { id: 'approach', label: 'Approach' }];

export default function Page() {
  const { hardware, amr4 } = robotFacts;
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'About' }]} eyebrow="ABOUT" title="We build robots that understand rooms."
      abstract="AMR is an early-stage startup in India building autonomous mobile robots that map, navigate and work on their own." meta="SOURCE project notes (brief §0, §1)" contents={contents} />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PaperSection id="timeline" n="1" title="Where we are" figure={<Figure id="about-1"><Timeline title="Milestones" items={[{ label: 'Hardware Bot field-tested', robot: 'hardware' }, { label: 'AMR4 in development', robot: 'amr4' }, { label: 'amrslam.tech launched', date: '2026' }]} /></Figure>} source="brief:§0, §1" />
      <PaperSection id="founder" n="2" title="Founder">
        <div className="reveal-in glass grid grid-cols-1 items-center gap-8 rounded-[var(--radius-card)] p-8 md:grid-cols-[160px_1fr]">
          <div role="img" aria-label="Portrait placeholder: initials AC" className="grid h-36 w-36 place-items-center rounded-full p-[2px] bg-grad">
            <span className="grid h-full w-full place-items-center rounded-full bg-[var(--bg)] font-display text-3xl font-bold" aria-hidden>AC</span>
          </div>
          <div>
            <h3 className="text-[length:var(--text-h3)] font-semibold">{FOUNDER}, Founder.</h3>
            <ul className="mt-4 flex flex-wrap gap-x-6 gap-y-1 text-[length:var(--text-small)]">
              <li><a className="inline-flex min-h-11 items-center underline underline-offset-4" href="https://github.com/amey1942007" target="_blank" rel="noopener noreferrer">GitHub profile<span className="sr-only"> (opens in new tab)</span></a></li>
              <li><a className="inline-flex min-h-11 items-center underline underline-offset-4" href={`mailto:${EMAIL}`}>{EMAIL}</a></li>
            </ul>
          </div>
        </div>
      </PaperSection>
      <PaperSection id="building" n="3" title="What we're building">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          {[[hardware, '/robots/hardware-bot/'], [amr4, '/robots/amr4/']].map(([r, href]) => {
            const rf = r as typeof hardware;
            return (
              <article key={rf.id} aria-labelledby={`b-${rf.id}`} className="reveal-in glass rounded-[var(--radius-card)] p-8">
                <h3 id={`b-${rf.id}`} className="text-[length:var(--text-h3)] font-semibold">{rf.name}</h3>
                <p className="mt-2 text-white/80">{rf.lead}</p>
                <Link href={href as string} className="mt-4 inline-flex min-h-11 items-center gap-2 underline-offset-4 hover:underline">View details<span className="sr-only"> about {rf.name}</span> <ArrowRight /></Link>
              </article>
            );
          })}
        </div>
      </PaperSection>
      <PaperSection id="approach" n="4" title="Approach">
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {['Open tools: ROS 2 and open-source navigation.', 'Tested in real rooms before we claim it.', 'Code on GitHub, opened up as it matures.'].map((t, i) => (
            <li key={t} className="reveal-in rounded-[var(--radius-card)] border border-[var(--line-dark)] p-6"><span className="font-mono text-muted">{i + 1}</span><p className="mt-2 text-white">{t}</p></li>
          ))}
        </ol>
      </PaperSection>
      <Cta />
    </PageShell>
  );
}
