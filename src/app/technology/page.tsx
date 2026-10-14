import { PageShell, Cta, meta } from '@/components/paper/PageShell';
import { PageHeader } from '@/components/paper/PageHeader';
import { PaperSection } from '@/components/paper/PaperSection';
import { Figure } from '@/components/paper/Figure';
import { StackDiagram, type StackTier } from '@/components/paper/StackDiagram';
import { RangeChart, MatrixChart } from '@/components/paper/Chart';
import { LayeredDiagram } from '@/components/paper/LayeredDiagram';
import { Mermaid } from '@/components/paper/Mermaid';
import { Callout, CalloutGrid } from '@/components/paper/Callout';
import { Toc } from '@/components/paper/Toc';
import { Tagged } from '@/components/paper/RobotTag';
import { Absent } from '@/components/paper/Absent';
import { OccupancyGrid, DashboardSketch, LidarSweep } from '@/components/paper/illustrations';
import { lidarRange } from '@/data/pages/robots';
import { ekfArch } from '@/data/pages/architecture';

export const metadata = meta('/technology/', 'Technology | AMR', 'How AMR robots see, map and move: ROS 2, lidar SLAM with slam_toolbox, Nav2 navigation, EKF localisation, semantic mapping and a web dashboard.');

const toc = [
  { id: 'ros2', label: 'ROS 2 and the stack' }, { id: 'lidar', label: 'Lidar' }, { id: 'slam', label: 'SLAM' }, { id: 'nav2', label: 'Navigation' },
  { id: 'ekf', label: 'Localisation' }, { id: 'semantic', label: 'Semantic mapping' }, { id: 'dashboard', label: 'Dashboard' },
];
const tiers: StackTier[] = [
  { label: 'Hardware', items: [
    { name: 'Raspberry Pi 5', icon: 'raspberrypi', robot: 'hardware' }, { name: 'Jetson Orin Nano', icon: 'nvidia', robot: 'amr4' },
    { name: 'RPLidar S2E', robot: 'hardware' }, { name: 'RPLidar A1', robot: 'amr4' }, { name: 'DDSM115 hub motors', robot: 'hardware' },
    { name: 'mecanum wheels', robot: 'amr4' }, { name: 'pan/tilt camera', robot: 'hardware' }] },
  { label: 'OS', items: [{ name: 'Ubuntu 22.04', icon: 'ubuntu', robot: 'amr4' }, { name: 'Hardware Bot OS: absent in notes', robot: 'hardware', absent: true }] },
  { label: 'Middleware', items: [{ name: 'ROS 2 Jazzy', icon: 'ros', robot: 'hardware' }, { name: 'ROS 2 Humble', icon: 'ros', robot: 'amr4' }] },
  { label: 'Robot software', items: [
    { name: 'slam_toolbox', robot: 'hardware' }, { name: 'Nav2', robot: 'hardware' }, { name: 'robot_localization EKF', robot: 'hardware' },
    { name: 'frontier exploration', robot: 'hardware' }, { name: 'safety stop', robot: 'hardware' }, { name: 'YOLO-World', robot: 'hardware' },
    { name: 'custom motor driver', robot: 'amr4' }, { name: 'mecanum odometry', robot: 'amr4' }] },
  { label: 'Apps / web', items: [{ name: 'web dashboard', robot: 'hardware' }] },
];

export default function Page() {
  return (
    <PageShell header={<PageHeader crumbs={[{ label: 'Home', href: '/' }, { label: 'Technology' }]} eyebrow="TECHNOLOGY" title="How our robots see, map and move."
      abstract="ROS 2, lidar SLAM, navigation, localisation and semantic mapping, figure by figure. Every statement is tagged with the robot it applies to." />}>
      <div className="grid grid-cols-1 gap-10 lg:grid-cols-[220px_1fr]">
        <div><Toc items={toc} /></div>
        <div className="min-w-0">
          <PaperSection id="ros2" n="1" title="ROS 2 and the stack" figure={<Figure id="tech-1"><StackDiagram tiers={tiers} /></Figure>}
            paras={['ROS 2 is the robot software framework: small programs (nodes) pass messages over named channels (topics), and launch files start them together.']} source="brief:§0">
            <div className="flex flex-col gap-3 text-white/85">
              <Tagged robot="hardware">ROS 2 Jazzy on a Raspberry Pi 5.</Tagged>
              <Tagged robot="amr4">ROS 2 Humble on an NVIDIA Jetson Orin Nano (Ubuntu 22.04).</Tagged>
            </div>
          </PaperSection>
          <PaperSection id="lidar" n="2" title="Lidar"
            figure={<div className="flex flex-col gap-10">
              <Figure id="tech-2"><RangeChart title="Lidar range (m)" unit="m" max={12} rows={[{ robot: 'hardware', label: 'Hardware Bot · RPLidar S2E', range: lidarRange.hardware }, { robot: 'amr4', label: 'AMR4 · RPLidar A1', range: lidarRange.amr4 }]} /></Figure>
              <Figure id="tech-3"><MatrixChart title="Sensor presence" rows={[{ label: 'Lidar', hardware: 'RPLidar S2E', amr4: 'RPLidar A1' }, { label: 'Lidar interface', hardware: 'Ethernet', amr4: 'USB' }, { label: 'Camera', hardware: 'pan/tilt camera', amr4: null }]} /></Figure>
            </div>}
            paras={['A 2D lidar spins a laser and measures the distance to everything around it in one flat slice. Each turn gives a scan: a ring of points where the beam hit something.']} source="brief:§0">
            <div className="grid grid-cols-1 items-center gap-6 md:grid-cols-2">
              <LidarSweep />
              <div className="flex flex-col gap-3 text-white/85">
                <Tagged robot="hardware">RPLidar S2E over Ethernet.</Tagged>
                <Tagged robot="amr4">RPLidar A1 over USB, 0.15–12 m.</Tagged>
              </div>
            </div>
          </PaperSection>
          <PaperSection id="slam" n="3" title="SLAM" figure={<Figure id="tech-4"><OccupancyGrid /></Figure>}
            paras={['SLAM means building a map while working out where you are on it. The robot compares each new scan with the map so far and adds what it sees.']} source="brief:§0">
            <CalloutGrid>
              <Callout kind="finding" title="Hardware Bot">slam_toolbox builds a 5 cm occupancy grid.</Callout>
              <Callout kind="note" title="AMR4"><Absent text="NOT YET: IN DEVELOPMENT" /></Callout>
            </CalloutGrid>
          </PaperSection>
          <PaperSection id="nav2" n="4" title="Navigation" figure={<Figure id="tech-5"><Mermaid name="tech-nav" title="From goal to wheels" label="Flowchart: frontier exploration picks a goal; the global planner finds a route; the controller turns it into wheel speeds for the DDSM115 motors; the safety stop can halt the motors." /></Figure>}
            paras={['Nav2 plans and follows paths. Frontier exploration picks the next unmapped area as a goal, and a safety stop halts the robot when something gets too close.']} source="brief:§0">
            <div className="flex flex-col gap-3 text-white/85">
              <Tagged robot="hardware">Nav2, frontier exploration and a safety stop.</Tagged>
              <p className="flex flex-wrap items-baseline gap-3"><span className="eyebrow inline-flex h-6 items-center rounded-full border border-violet px-2.5 text-white">AMR4</span><Absent /></p>
            </div>
          </PaperSection>
          <PaperSection id="ekf" n="5" title="Localisation" figure={<Figure id="tech-6"><LayeredDiagram arch={ekfArch} title="Knowing where it is" /></Figure>}
            paras={['An extended Kalman filter (EKF) blends noisy measurements into one smoothed position estimate. Which inputs Hardware Bot fuses is pending code review.']} source="brief:§0">
            <div className="flex flex-col gap-3 text-white/85">
              <Tagged robot="hardware">robot_localization EKF.</Tagged>
              <Tagged robot="amr4">Mecanum wheel odometry.</Tagged>
            </div>
          </PaperSection>
          <PaperSection id="semantic" n="6" title="Semantic mapping" figure={<Figure id="tech-7"><Mermaid name="tech-semantic" title="Seeing and naming objects" label="Flowchart: the pan/tilt camera feeds YOLO-World, which produces object labels; labels and the slam_toolbox map combine into the semantic map shown on the web dashboard." /></Figure>}
            paras={['YOLO-World is an open-vocabulary object detector: it can find objects described in plain words. Its detections are placed on the occupancy map.']} source="brief:§0">
            <div className="flex flex-col gap-3 text-white/85">
              <Tagged robot="hardware">YOLO-World on the pan/tilt camera.</Tagged>
              <p className="flex flex-wrap items-baseline gap-3"><span className="eyebrow inline-flex h-6 items-center rounded-full border border-violet px-2.5 text-white">AMR4</span><Absent text="ABSENT: NO CAMERA" /></p>
            </div>
          </PaperSection>
          <PaperSection id="dashboard" n="7" title="Dashboard" figure={<Figure id="tech-8"><DashboardSketch /></Figure>}
            paras={['Hardware Bot has a web dashboard. What it shows will be described once confirmed from the code; a public control panel link will appear once it is live.']} source="brief:§0">
            <Tagged robot="hardware">Web dashboard.</Tagged>
          </PaperSection>
          <Cta />
        </div>
      </div>
    </PageShell>
  );
}
