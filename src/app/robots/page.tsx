import Link from '@/components/nav/AppLink';
import { PageShell, Cta, meta } from '@/components/paper/PageShell';
import { PageHeader, Badge } from '@/components/paper/PageHeader';
import { PaperSection } from '@/components/paper/PaperSection';
import { Figure } from '@/components/paper/Figure';
import { CompareTable } from '@/components/paper/SpecTable';
import { FootprintChart } from '@/components/paper/Chart';
import { robotFacts, footprint, type RobotFacts } from '@/data/pages/robots';
import { ArrowRight } from '@/components/icons';

export const metadata = meta('/robots/', 'Robots | AMR', 'Two robots from AMR: the field-tested Hardware Bot and AMR4, a mecanum platform in development.');

const contents = [{ id: 'compare', label: 'At a glance' }, { id: 'footprint', label: 'Footprint' }, { id: 'robots', label: 'The robots' }];

function Card({ r, href }: { r: RobotFacts; href: string }) {
  return (
    <article aria-labelledby={`card-${r.id}`} className="reveal-in glass flex flex-col rounded-[var(--radius-card)] p-8">
      <Badge kind={r.id === 'amr4' ? 'dev' : 'tested'}>{r.badge}</Badge>
      <h3 id={`card-${r.id}`} className="mt-5 text-[length:var(--text-h3)] font-semibold">{r.name}</h3>
      <p className="mt-2 text-white/80">{r.lead}</p>
      <Link href={href} className="mt-6 inline-flex min-h-11 w-fit items-center gap-2 text-white underline-offset-4 hover:underline">View details<span className="sr-only"> about {r.name}</span> <ArrowRight /></Link>
    </article>
  );
}

export default function Page() {
  const { hardware, amr4 } = robotFacts;
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'Robots' }]} eyebrow="OUR ROBOTS" title="Two robots, one mapping stack."
      abstract="Hardware Bot is field-tested in real rooms. AMR4 is our next platform: mecanum drive, in active development." contents={contents} />}>
      <PaperSection id="compare" n="1" title="At a glance" figure={<Figure id="robots-1"><CompareTable left={hardware} right={amr4} caption="Two robots at a glance" /></Figure>}
        paras={['Each column is bound to one robot. Values come from the project notes; anything that would need the code to confirm is left out.']} source="brief:§0" />
      <PaperSection id="footprint" n="2" title="Footprint" figure={<Figure id="robots-2"><FootprintChart title="Footprint comparison (m)" items={[{ robot: 'hardware', w: footprint.hardware[0], l: footprint.hardware[1] }, { robot: 'amr4', w: footprint.amr4[0], l: footprint.amr4[1] }]} /></Figure>}
        paras={['Both outlines use the same scale: Hardware Bot is 0.45 × 0.25 m and AMR4 is 0.52 × 0.63 m.']} source="brief:§0" />
      <PaperSection id="robots" n="3" title="The robots">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <Card r={hardware} href="/robots/hardware-bot/" />
          <Card r={amr4} href="/robots/amr4/" />
        </div>
      </PaperSection>
      <Cta />
    </PageShell>
  );
}
