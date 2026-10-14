import { PageShell, Cta, meta } from '@/components/paper/PageShell';
import { PageHeader, Badge } from '@/components/paper/PageHeader';
import { PaperSection } from '@/components/paper/PaperSection';
import { Figure } from '@/components/paper/Figure';
import { SpecTable } from '@/components/paper/SpecTable';
import { Callout, CalloutGrid } from '@/components/paper/Callout';
import { Note } from '@/components/paper/Note';
import { LayeredDiagram } from '@/components/paper/LayeredDiagram';
import { RobotViewer } from '@/components/paper/RobotViewer';
import { Amr4TopView, HolonomicMotion } from '@/components/paper/illustrations';
import { amr4, REPO_PUBLIC } from '@/data/pages/robots';
import { amr4Arch } from '@/data/pages/architecture';

export const metadata = meta('/robots/amr4/', 'AMR4 (in development) | AMR', "AMR4 is AMR's mecanum-drive mobile robot in development, on NVIDIA Jetson Orin Nano with ROS 2 Humble and an RPLidar A1.");
// No roadmap section (Q4 default: hidden). Never shown here: camera features, semantic map, exploration, dashboard, SLAM/Nav2 results.
const contents = [{ id: 'overview', label: 'Overview' }, { id: 'specs', label: 'Specifications' }, { id: 'motion', label: 'Motion model' }, { id: 'architecture', label: 'Software architecture' }, { id: 'code', label: 'Code' }];

export default function Page() {
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'Robots', href: '/robots/' }, { label: 'AMR4' }]} eyebrow="ROBOT" badge={<Badge kind="dev">IN DEVELOPMENT</Badge>}
      title="AMR4" abstract={amr4.lead} meta={`SOURCE project notes (brief §0) · branch ${amr4.branch}`} contents={contents}
      aside={<RobotViewer model={amr4.model} name="AMR4" />} />}>
      <div className="reveal-in mt-4"><Note kind="pending">AMR4 is in development. Navigation and mapping results will be published once they&apos;re validated.</Note></div>
      <PaperSection id="overview" n="1" title="Overview" figure={<Figure id="amr4-1"><Amr4TopView /></Figure>}
        paras={['AMR4 rolls on four mecanum wheels, carries an RPLidar A1 on USB and runs ROS 2 Humble on an NVIDIA Jetson Orin Nano.']} source="brief:§0">
        <CalloutGrid>
          <Callout kind="pending" label="IN DEVELOPMENT" title="Design, not results">AMR4 is described as built so far. No mapping or navigation results are claimed yet.</Callout>
          <Callout kind="finding" title="Custom driver">A custom motor driver runs the four mecanum wheels.</Callout>
          <Callout kind="finding" title="Mecanum odometry">Wheel odometry written for mecanum kinematics tracks how the robot moves.</Callout>
        </CalloutGrid>
      </PaperSection>
      <PaperSection id="specs" n="2" title="Specifications" figure={<Figure id="amr4-2"><SpecTable robot={amr4} caption="AMR4 specifications" /></Figure>}
        paras={['The 1.0 m/s top speed is a design maximum, not a measured result.']} source="brief:§0" />
      <PaperSection id="motion" n="3" title="Motion model" figure={<Figure id="amr4-3"><HolonomicMotion /></Figure>} source="generic mecanum kinematics (illustrative)" />
      <PaperSection id="architecture" n="4" title="Software architecture" figure={<Figure id="amr4-4"><LayeredDiagram arch={amr4Arch} title="AMR4 software, layer by layer" /></Figure>}
        paras={['Node and topic names are pending code review, so they are not shown.']} source="brief:§0" />
      <PaperSection id="code" n="5" title="Code" paras={[REPO_PUBLIC ? 'The code lives on the AMR4 branch.' : 'The code lives on the AMR4 branch of a private repository. A public link will appear here once the repository is opened.']} source={`github.com/amey1942007/Ros_lidar_bot @ ${amr4.branch}`}>
        {REPO_PUBLIC && <a href={amr4.codeUrl} target="_blank" rel="noopener noreferrer" className="pill pill-ghost inline-flex h-11 items-center rounded-full border border-current/40 px-5">View code on GitHub<span className="sr-only"> (opens in new tab)</span></a>}
      </PaperSection>
      <Cta />
    </PageShell>
  );
}
