export interface CamKey { p: number; pos: readonly [number, number, number]; tgt: readonly [number, number, number]; fov: number }
/** Brief §9.2 — exact values. */
export const KEYS: readonly CamKey[] = [
  { p: 0.0, pos: [-2.5, 0.45, 3.1], tgt: [-2.5, 0.22, 1.5], fov: 28 },
  { p: 0.12, pos: [-2.4, 0.95, 4.4], tgt: [-2.5, 0.2, 1.5], fov: 31 },
  { p: 0.26, pos: [-1.6, 2.7, 6.7], tgt: [-1.8, 0.1, 1.1], fov: 36 },
  { p: 0.4, pos: [-0.2, 5.0, 7.6], tgt: [-0.8, 0, 0.5], fov: 40 },
  { p: 0.54, pos: [1.2, 7.8, 6.2], tgt: [0.2, 0, -0.2], fov: 42 },
  { p: 0.66, pos: [0.8, 15, 3.4], tgt: [0.3, 0, -0.3], fov: 44 },
  { p: 0.76, pos: [0.3, 30, 1.4], tgt: [0, 0, 0], fov: 46 },
  { p: 0.88, pos: [0, 52, 0.6], tgt: [0, 20, -8], fov: 48 },
  { p: 1.0, pos: [0, 70, 0.2], tgt: [0, 64, -60], fov: 50 },
];
