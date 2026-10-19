import { create } from 'zustand';
export type Tier = 'high' | 'low';
/** Low-frequency scene state for DOM subscribers. Per-frame values live in S (timeline.ts). */
export const useScene = create<{
  uMap: number;
  mapPct: number;
  speed: number;
  tier: Tier;
  navDark: boolean;
  fps: number;
  robotSource: 'placeholder' | 'lo' | 'hi';
  load: number;
  /** ui-spec §14.3: true while the simulation video is playing → canvas renders 0 frames. */
  renderPaused: boolean;
}>(() => ({ uMap: 0, mapPct: 0, speed: 0, tier: 'high', navDark: false, fps: 0, robotSource: 'placeholder', load: 0, renderPaused: false }));
/** Robot world→screen projection, written each frame by the 3D scene, read by the leader line. */
export const robotScreen = { x: 0, y: 0, visible: false };
/** Robot pose for the minimap (written by RobotDriver). */
export const robotPose = { x: -2.6, z: 2.45, yaw: 0 };
/** lidar_top world position (written by HeroRobot). */
export const lidarWorld = { x: -2.6, y: 0.21, z: 2.45 };
