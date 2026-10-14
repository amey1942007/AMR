import { PageShell, Cta, meta } from '@/components/paper/PageShell';
import { PageHeader, Badge } from '@/components/paper/PageHeader';
import { PaperSection } from '@/components/paper/PaperSection';
import { Figure } from '@/components/paper/Figure';
import { SpecTable } from '@/components/paper/SpecTable';
import { Callout, CalloutGrid } from '@/components/paper/Callout';
import { LayeredDiagram } from '@/components/paper/LayeredDiagram';
import { RobotViewer } from '@/components/paper/RobotViewer';
import { HardwareTopView } from '@/components/paper/illustrations';
import { hardware, REPO_PUBLIC } from '@/data/pages/robots';
import { hardwareArch } from '@/data/pages/architecture';
import Link from '@/components/nav/AppLink';

export const metadata = meta('/robots/hardware-bot/', 'Hardware Bot | AMR', 'Field-tested differential-drive robot on Raspberry Pi 5 and ROS 2 Jazzy, with RPLidar S2E SLAM, Nav2 navigation and a semantic map.');

const caps = [
  ['Mapping', 'slam_toolbox builds a 5 cm occupancy grid.'],
  ['Navigation', 'Nav2 plans and follows paths.'],
  ['Localisation', 'An EKF fuses odometry and sensors.'],
  ['Exploration', 'Frontier exploration finds unmapped space on its own.'],
  ['Safety stop', 'Stops when something gets too close.'],
  ['Semantic map', 'YOLO-World labels objects on the map.'],
  ['Dashboard', 'A web dashboard shows the map and robot state.'],
] as const;
const contents = [{ id: 'overview', label: 'Overview' }, { id: 'specs', label: 'Specifications' }, { id: 'capabilities', label: 'Capabilities' }, { id: 'architecture', label: 'Software architecture' }, { id: 'code', label: 'Code' }];
const ld = { '@context': 'https://schema.org', '@type': 'Product', name: 'Hardware Bot', brand: { '@type': 'Brand', name: 'AMR' }, description: hardware.lead };

export default function Page() {
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'Robots', href: '/robots/' }, { label: 'Hardware Bot' }]} eyebrow="ROBOT" badge={<Badge kind="tested">FIELD-TESTED</Badge>}
      title="Hardware Bot" abstract={hardware.lead} meta={`SOURCE project notes (brief §0) · branch ${hardware.branch}`} contents={contents}
      aside={<RobotViewer model={hardware.model} name="Hardware Bot" />} />}>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <PaperSection id="overview" n="1" title="Overview" figure={<Figure id="hw-1"><HardwareTopView /></Figure>}
        paras={['Hardware Bot drives on two DDSM115 hub motors with casters for balance. A Raspberry Pi 5 runs ROS 2 Jazzy; an RPLidar S2E on Ethernet scans the room, and a pan/tilt camera looks for objects.']} source="brief:§0" />
      <PaperSection id="specs" n="2" title="Specifications" figure={<Figure id="hw-2"><SpecTable robot={hardware} caption="Hardware Bot specifications" /></Figure>} source="brief:§0" />
      <PaperSection id="capabilities" n="3" title="Capabilities" figure={<Figure id="hw-3"><CalloutGrid>{caps.map(([t, d]) => <Callout key={t} kind="finding" title={t}>{d}</Callout>)}</CalloutGrid></Figure>} source="brief:§0" />
      <PaperSection id="architecture" n="4" title="Software architecture" figure={<Figure id="hw-4"><LayeredDiagram arch={hardwareArch} title="Hardware Bot software, layer by layer" /></Figure>}
        paras={['Component view from project notes; the topic-level diagram is pending code review. Each subsystem is explained on the technology page.']} source="brief:§0">
        <Link href="/technology/" className="inline-flex min-h-11 items-center text-white underline underline-offset-4">How each part works →</Link>
      </PaperSection>
      <PaperSection id="code" n="5" title="Code" paras={[REPO_PUBLIC ? 'The code lives on the hardware branch.' : 'The code lives on the hardware branch of a private repository. A public link will appear here once the repository is opened.']} source={`github.com/amey1942007/Ros_lidar_bot @ ${hardware.branch}`}>
        {REPO_PUBLIC && <a href={hardware.codeUrl} target="_blank" rel="noopener noreferrer" className="pill pill-ghost inline-flex h-11 items-center rounded-full border border-current/40 px-5">View code on GitHub<span className="sr-only"> (opens in new tab)</span></a>}
      </PaperSection>
      <Cta />
    </PageShell>
  );
}
