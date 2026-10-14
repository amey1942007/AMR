/**
 * Subpage robot facts (pages-spec §3/§4). Source: instruction.md §0 ("brief:§0") ONLY: the Ros_lidar_bot repo is
 * private, so nothing here comes from the code. The two robots are SEPARATE objects; no component may combine
 * fields from both in one card or row (except /robots compare, where each column binds to exactly one object).
 * `pending: true` rows are ⟨CODE-PENDING⟩: they are never rendered until a verified value replaces them.
 */
export type SourceStatus = 'verified' | 'notes' | 'pending';
export interface Fact { key: string; label: string; value: string; source: string; pending?: boolean; absent?: boolean }
export interface RobotFacts {
  id: 'hardware' | 'amr4';
  name: string;
  badge: 'FIELD-TESTED' | 'IN DEVELOPMENT';
  lead: string;
  branch: string;
  codeUrl: string;
  model?: string; // public GLB for RobotViewer (undefined → poster only)
  facts: Fact[];
}

const B = 'brief:§0';
const REPO = 'https://github.com/amey1942007/Ros_lidar_bot';
/** Q1: the repo is private (404 for visitors), so public "View code" links stay hidden until this flips. */
export const REPO_PUBLIC = false;

export const hardware: RobotFacts = {
  id: 'hardware',
  name: 'Hardware Bot',
  badge: 'FIELD-TESTED',
  lead: 'A compact differential-drive robot that maps rooms with lidar, navigates on its own, and labels what it sees.',
  branch: 'hardware',
  codeUrl: `${REPO}/tree/hardware`,
  model: undefined, // Q2: no Hardware Bot GLB yet → poster placeholder
  facts: [
    { key: 'status', label: 'Status', value: 'Field-tested', source: B },
    { key: 'drive', label: 'Drive', value: 'Differential drive, 2 × DDSM115 hub motors + casters', source: B },
    { key: 'chassis', label: 'Chassis', value: '0.45 × 0.25 m', source: B },
    { key: 'compute', label: 'Compute', value: 'Raspberry Pi 5', source: B },
    { key: 'os', label: 'OS / ROS 2', value: 'ROS 2 Jazzy', source: B },
    { key: 'lidar', label: 'LiDAR', value: 'RPLidar S2E (Ethernet)', source: B },
    { key: 'camera', label: 'Camera', value: 'Pan/tilt camera head', source: B },
    { key: 'branch', label: 'Code branch', value: 'hardware', source: B },
    { key: 'packages', label: 'Packages / launch', value: '⟨CODE-PENDING⟩', source: 'hardware:⟨pending⟩', pending: true },
  ],
};

export const amr4: RobotFacts = {
  id: 'amr4',
  name: 'AMR4',
  badge: 'IN DEVELOPMENT',
  lead: 'A holonomic mecanum-drive platform that can move in any direction. In active development.',
  branch: 'AMR4',
  codeUrl: `${REPO}/tree/AMR4`,
  model: '/models/amr_hero_lo.glb',
  facts: [
    { key: 'status', label: 'Status', value: 'In development', source: B },
    { key: 'drive', label: 'Drive', value: '4-wheel mecanum (holonomic)', source: B },
    { key: 'chassis', label: 'Chassis', value: '0.52 × 0.63 m', source: B },
    { key: 'speed', label: 'Max speed', value: '1.0 m/s (design max)', source: B },
    { key: 'compute', label: 'Compute', value: 'NVIDIA Jetson Orin Nano', source: B },
    { key: 'os', label: 'OS / ROS 2', value: 'Ubuntu 22.04 · ROS 2 Humble', source: B },
    { key: 'lidar', label: 'LiDAR', value: 'RPLidar A1 (USB), range 0.15–12 m', source: B },
    { key: 'camera', label: 'Camera', value: '', source: B, absent: true },
    { key: 'software', label: 'Software', value: 'Custom motor driver + mecanum odometry', source: B },
    { key: 'branch', label: 'Code branch', value: 'AMR4', source: B },
    { key: 'nodes', label: 'Nodes / topics', value: '⟨CODE-PENDING⟩', source: 'AMR4:⟨pending⟩', pending: true },
  ],
};

export const robotFacts = { hardware, amr4 } as const;

/** Rows of the /robots comparison (each column binds to exactly one robot object). */
export const COMPARE_KEYS = ['status', 'drive', 'chassis', 'compute', 'os', 'lidar', 'camera', 'branch'] as const;
export function factFor(r: RobotFacts, key: string): Fact | undefined {
  return r.facts.find((f) => f.key === key && !f.pending);
}
/** Footprint in metres [width, length] (brief:§0). */
export const footprint = { hardware: [0.45, 0.25] as const, amr4: [0.52, 0.63] as const };
/** Lidar range in metres; null = not stated in branch (no datasheet values imported). */
export const lidarRange = { hardware: null as null | readonly [number, number], amr4: [0.15, 12] as const };
