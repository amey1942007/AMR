import apartment from '@/data/apartment.json';
import { Vector3 } from 'three';
import { buildPath, type BuiltPath, type RoutePoint } from './path-core.mjs';

/**
 * The robot route (apartment.json path.route): straight lines joined by circular fillets (R 0.3–0.45 m) with stop
 * points (cusps) for the mecanum moves (rotate in place, strafe, reverse). Same builder as scripts/apartment, so
 * check:path and the map bake see exactly this path.
 */
const p = apartment.path as unknown as { route: RoutePoint[]; fillet: { radius: number; minRadius: number } };
export const ROUTE: BuiltPath = buildPath(p.route, p.fillet);
/** Route corner points (for the runtime map service). */
export const PATH_POINTS = p.route.map((r) => r.p);
export const WHEEL_R = 0.05;

/** Arc length of the drive path in metres (≈ 20.7 m). */
export const pathLength = () => ROUTE.length;

/** Pose at normalised arc length u: position and the route's target heading (yaw = rotation.y, model forward = +Z). */
export function poseAt(u: number) {
  const q = ROUTE.at(Math.min(1, Math.max(0, u)) * ROUTE.length);
  return { x: q.x, z: q.z, yaw: q.heading };
}

/** Curve-like adapter for the trail and minimap (getPointAt on normalised arc length). */
const adapter = {
  getPointAt(u: number, target = new Vector3()) { const q = ROUTE.at(Math.min(1, Math.max(0, u)) * ROUTE.length); return target.set(q.x, 0, q.z); },
  getLength: () => ROUTE.length,
};
export const pathCurve = () => adapter;

/** Robot's ACTUAL arc parameter (0..1), written by HeroRobot each frame from the physical motion model. */
export const robotU = { value: 0 };
