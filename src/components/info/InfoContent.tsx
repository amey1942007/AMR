import { RobotCard } from './RobotCard';
import { TechStack } from './TechStack';
import { LinkRow } from './LinkRow';
import { Footer } from './Footer';
import { SplitReveal } from '@/components/ui/SplitReveal';
import { robots, techStack } from '@/lib/content';

/** Server component: robot cards, tech stack and footer ship as HTML only. LinkRow + SplitReveal are small client islands. */
export function InfoContent() {
  return (
    <>
      <div className="mx-auto flex max-w-[var(--content-max)] flex-col gap-[var(--section-gap)] px-[var(--gutter)] pt-[30vh]">
        <div className="reveal">
          <p className="eyebrow text-muted">The robots</p>
          <SplitReveal id="info-title" text="Meet the robots" className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em]" />
        </div>
        <div className="-mt-[calc(var(--section-gap)/2)] grid grid-cols-1 gap-6 lg:grid-cols-2">
          <RobotCard robot={robots.amr4} />
          <RobotCard robot={robots.hardware} />
        </div>
        <TechStack items={techStack} />
        <LinkRow />
      </div>
      <div className="mt-[var(--section-gap)]"><Footer /></div>
    </>
  );
}
