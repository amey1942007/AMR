/** Single source of copy and robot specs. The two robots are SEPARATE objects — never merge (brief §0). */
export const COMPANY_NAME = 'AMR'; // placeholder (D2) — replace once Amey confirms the legal name
export const FOUNDER = 'Amey Chaudhari';
export const EMAIL = 'amey@amrslam.tech';
export const REPO_URL = 'https://github.com/amey1942007/Ros_lidar_bot';

export const copy = {
  eyebrow: 'Autonomous mobile robots',
  tagline: 'Robots that map, navigate and work on their own.', // placeholder (D3)
  metaTitle: 'AMR: Autonomous Mobile Robots | amrslam.tech',
  metaDescription:
    'AMR builds autonomous mobile robots that map rooms with LiDAR, plan paths and navigate on their own. Founded by Amey Chaudhari.',
  callouts: [
    { id: 'c1', eyebrow: 'SEE', title: '360° LiDAR pulses scan the room.' },
    { id: 'c2', eyebrow: 'MAP', title: 'Each scan adds to a live occupancy map.' },
    { id: 'c3', eyebrow: 'MOVE', title: 'Plans a path and moves in any direction (mecanum).' },
  ],
  beyond: 'Beyond the room.',
  /** Center overlays during the long cloud stretch (fills dead scroll after the room). */
  cloudBeats: [
    { id: 'cb1', eyebrow: 'SCALE', title: 'Beyond the room.' },
    { id: 'cb2', eyebrow: 'BUILD', title: 'Jetson AMR4 · Pi 5 Hardware Bot.' },
    { id: 'cb3', eyebrow: 'STACK', title: 'ROS 2 · Nav2 · slam_toolbox.' },
    { id: 'cb4', eyebrow: 'DRIVE', title: 'Browser teleop — or explore alone.' },
  ],
} as const;

export interface RobotSpec {
  id: 'amr4' | 'hardware';
  name: string;
  badge: 'In development' | 'Field-tested';
  summary: string;
  specs: { label: string; value: string }[];
  branch: string;
  codeUrl: string;
  /** Image slot: undefined in v1 (text-only cards). Set to a public path when a render/photo exists. */
  image?: { src: string; alt: string; width: number; height: number };
}

const amr4: RobotSpec = {
  id: 'amr4',
  name: 'AMR4',
  badge: 'In development',
  summary: 'Holonomic mecanum platform for indoor mapping and navigation.',
  specs: [
    { label: 'Status', value: 'In development' },
    { label: 'Drive', value: '4-wheel mecanum (holonomic), max 1.0 m/s' },
    { label: 'Chassis', value: '0.52 × 0.63 m' },
    { label: 'Compute / OS', value: 'NVIDIA Jetson Orin Nano, Ubuntu 22.04, ROS 2 Humble' },
    { label: 'LiDAR', value: 'RPLidar A1 (USB), 0.15–12 m' },
    { label: 'Notes', value: 'No camera. Custom driver + mecanum odometry.' },
  ],
  branch: 'AMR4',
  codeUrl: `${REPO_URL}/tree/AMR4`,
};

const hardware: RobotSpec = {
  id: 'hardware',
  name: 'Hardware Bot',
  badge: 'Field-tested',
  summary: 'Differential-drive robot with SLAM, navigation and a semantic map.',
  specs: [
    { label: 'Status', value: 'Field-tested' },
    { label: 'Drive', value: 'Differential drive (2 DDSM115 hub motors + casters)' },
    { label: 'Chassis', value: '0.45 × 0.25 m' },
    { label: 'Compute / OS', value: 'Raspberry Pi 5, ROS 2 Jazzy' },
    { label: 'LiDAR', value: 'RPLidar S2E (Ethernet)' },
    {
      label: 'Extras',
      value:
        'Pan/tilt camera head, slam_toolbox (5 cm grid), Nav2, EKF, frontier exploration, safety stop, YOLO-World semantic map, web dashboard',
    },
  ],
  branch: 'hardware',
  codeUrl: `${REPO_URL}/tree/hardware`,
};

export const robots = { amr4, hardware } as const;

export const techStack = [
  { label: 'ROS 2 (Jazzy/Humble)', icon: 'ros' },
  { label: 'Nav2' },
  { label: 'slam_toolbox' },
  { label: 'robot_localization (EKF)' },
  { label: 'Raspberry Pi 5', icon: 'raspberrypi' },
  { label: 'Jetson Orin Nano', icon: 'nvidia' },
  { label: 'RPLidar' },
  { label: 'Python', icon: 'python' },
  { label: 'C++/Arduino', icon: 'cplusplus' },
  { label: 'Three.js', icon: 'threedotjs' },
] as const;

export const navItems = [
  { label: 'Home', href: '/' },
  { label: 'Robots', href: '/robots/' },
  { label: 'Technology', href: '/technology/' },
  { label: 'About', href: '/about/' },
  { label: 'Contact', action: 'contact' as const },
  { label: 'Privacy', href: '/privacy/' },
] as const;

/** LinkRow items (brief §12.4). `demo` shows only when media.hasDemoVideo; `control` uses config.controlPanelUrl. */
export const links = [
  { id: 'github', label: 'GitHub repo', href: REPO_URL, external: true },
  { id: 'demo', label: 'Watch demo' },
  { id: 'control', label: 'Control panel' },
  { id: 'contact', label: 'Contact' },
  { id: 'email', label: EMAIL, href: `mailto:${EMAIL}` },
] as const;
