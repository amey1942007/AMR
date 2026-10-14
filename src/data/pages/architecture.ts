/** Layered architecture (pages-spec §11.5). Brief-level nodes (status 'notes'); topic edge labels omitted until §9. */
export type NodeStatus = 'verified' | 'notes' | 'absent';
export interface ArchNode { id: string; label: string; status: NodeStatus }
export interface ArchLayer { id: string; label: string; nodes: ArchNode[] }
export interface Arch { robot: 'hardware' | 'amr4'; middleware: string; layers: ArchLayer[]; edges: { from: string; to: string }[] }

const n = (id: string, label: string, status: NodeStatus = 'notes'): ArchNode => ({ id, label, status });

export const hardwareArch: Arch = {
  robot: 'hardware',
  middleware: 'ROS 2 Jazzy',
  layers: [
    { id: 'L5', label: 'L5 Interfaces', nodes: [n('dash', 'web dashboard')] },
    { id: 'L4', label: 'L4 Autonomy', nodes: [n('nav2', 'Nav2'), n('frontier', 'frontier exploration'), n('safety', 'safety stop'), n('yolo', 'YOLO-World')] },
    { id: 'L3', label: 'L3 Perception & mapping', nodes: [n('slam', 'slam_toolbox (5 cm)'), n('sem', 'semantic map layer')] },
    { id: 'L2', label: 'L2 State estimation', nodes: [n('ekf', 'robot_localization EKF'), n('odom', 'odometry')] },
    { id: 'L1', label: 'L1 Drivers', nodes: [n('lidar_drv', 'RPLidar S2E driver'), n('motor_drv', 'DDSM115 motor driver'), n('cam_drv', 'pan/tilt camera driver')] },
    { id: 'L0', label: 'L0 Hardware', nodes: [n('pi', 'Raspberry Pi 5'), n('lidar', 'RPLidar S2E (Ethernet)'), n('motors', '2 × DDSM115 + casters'), n('cam', 'pan/tilt camera')] },
  ],
  edges: [
    { from: 'lidar_drv', to: 'slam' }, { from: 'motor_drv', to: 'odom' }, { from: 'odom', to: 'ekf' }, { from: 'ekf', to: 'slam' },
    { from: 'slam', to: 'nav2' }, { from: 'nav2', to: 'motor_drv' }, { from: 'cam_drv', to: 'yolo' }, { from: 'yolo', to: 'sem' },
    { from: 'slam', to: 'dash' }, { from: 'sem', to: 'dash' },
  ],
};

export const amr4Arch: Arch = {
  robot: 'amr4',
  middleware: 'ROS 2 Humble · Ubuntu 22.04',
  layers: [
    { id: 'L5', label: 'L5 Interfaces', nodes: [n('a_if', 'absent', 'absent')] },
    { id: 'L4', label: 'L4 Autonomy', nodes: [n('a_auto', 'absent', 'absent')] },
    { id: 'L3', label: 'L3 Perception & mapping', nodes: [n('a_map', 'absent', 'absent')] },
    { id: 'L2', label: 'L2 State estimation', nodes: [n('mo', 'mecanum odometry')] },
    { id: 'L1', label: 'L1 Drivers', nodes: [n('drv', 'custom motor driver'), n('a1_drv', 'lidar driver: pending', 'absent')] },
    { id: 'L0', label: 'L0 Hardware', nodes: [n('jetson', 'Jetson Orin Nano'), n('a1', 'RPLidar A1 (USB)'), n('wheels', '4 mecanum wheels')] },
  ],
  edges: [{ from: 'drv', to: 'mo' }],
};

/** Localisation mini diagram (/technology Fig. 6): inputs pending. */
export const ekfArch: Arch = {
  robot: 'hardware',
  middleware: 'ROS 2 Jazzy',
  layers: [
    { id: 'out', label: 'Output', nodes: [n('tf', 'odom → base_link')] },
    { id: 'est', label: 'Estimator', nodes: [n('ekf2', 'robot_localization EKF')] },
    { id: 'in', label: 'Inputs', nodes: [n('in_p', 'inputs: pending', 'absent')] },
  ],
  edges: [{ from: 'ekf2', to: 'tf' }],
};
