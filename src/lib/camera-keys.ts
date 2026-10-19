export interface CamKey { p: number; pos: readonly [number, number, number]; tgt: readonly [number, number, number]; fov: number }
/** Art direction v3 §3.3 K0–K6 (apartment framing); K7–K8 per brief §9.2. */
export const KEYS: readonly CamKey[] = [
  // K0: frame the robot on the path start (−2.6, 2.45) so it sits centered in the hero.
  { p: 0.0, pos: [-2.6, 0.45, 4.2], tgt: [-2.6, 0.22, 2.45], fov: 28 },
  { p: 0.12, pos: [-2.6, 1.0, 5.6], tgt: [-2.6, 0.2, 2.5], fov: 31 },
  { p: 0.26, pos: [-2.2, 3.4, 8.2], tgt: [-2.2, 0, 1.4], fov: 36 },
  { p: 0.4, pos: [-1.2, 6.4, 8.8], tgt: [-1.6, 0, -0.4], fov: 40 },
  { p: 0.54, pos: [0.8, 9.2, 7.6], tgt: [0.2, 0, -0.6], fov: 42 },
  { p: 0.66, pos: [1.2, 16, 4.4], tgt: [0.6, 0, -0.4], fov: 44 },
  { p: 0.76, pos: [0.4, 32, 1.6], tgt: [0, 0, 0], fov: 46 },
  { p: 0.88, pos: [0, 52, 0.6], tgt: [0, 20, -8], fov: 48 },
  { p: 1.0, pos: [0, 70, 0.2], tgt: [0, 64, -60], fov: 50 },
];
