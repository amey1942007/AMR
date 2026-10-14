import { CatmullRomCurve3, Vector3 } from 'three';
/** Brief §11.3 waypoints (x, z). */
export const PATH_POINTS: [number, number][] = [[-2.5, 1.5], [-1.2, 0.6], [0.0, 1.0], [0.5, -0.2], [-0.3, -1.2], [1.0, -2.1], [2.6, -1.4], [2.9, 0.3], [2.0, 1.8]];
export const STRAFE: [number, number] = [0.44, 0.56];
export const WHEEL_R = 0.05;

let curve: CatmullRomCurve3 | null = null;
export function pathCurve() {
  return (curve ??= new CatmullRomCurve3(PATH_POINTS.map(([x, z]) => new Vector3(x, 0, z)), false, 'centripetal'));
}
const v = new Vector3(), tg = new Vector3();
/** Pose at arc-length u. Model forward = +Z (glTF export, §7.1); yaw = rotation.y so +Z faces the tangent. Strafe holds heading. */
export function poseAt(u: number) {
  const c = pathCurve();
  c.getPointAt(Math.min(1, Math.max(0, u)), v);
  const hu = u > STRAFE[0] && u < STRAFE[1] ? STRAFE[0] : u;
  c.getTangentAt(Math.min(0.999, Math.max(0.001, hu)), tg);
  return { x: v.x, z: v.z, yaw: Math.atan2(tg.x, tg.z) };
}
