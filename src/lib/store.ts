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
}>(() => ({ uMap: 0, mapPct: 0, speed: 0, tier: 'high', navDark: false, fps: 0, robotSource: 'placeholder' }));
/** Robot world→screen projection, written each frame by the 3D scene, read by the leader line. */
export const robotScreen = { x: 0, y: 0, visible: false };
/** Robot pose for the minimap (written by RobotDriver). */
export const robotPose = { x: -2.5, z: 1.5, yaw: 0 };
