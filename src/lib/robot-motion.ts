import type { BuiltPath } from './path-core.mjs';

/**
 * Physical robot motion along the route (user feedback: "the robot's motion looks unrealistic").
 * The robot never follows the scroll directly: scroll gives a TARGET arc length, and the robot chases it under real
 * limits, so a fast scroll means a smooth catch-up, never a teleport:
 *   - speed |v| ≤ 1.0 m/s, and on curves v ≤ √(a_lat / κ) with a_lat = 0.4 m/s² (√(0.4/κ)); 0 at cusps
 *   - longitudinal accel |dv/dt| ≤ 0.5 m/s² (braking for curves/cusps/target is planned ahead with the same limit)
 *   - yaw rate |ω| ≤ 90°/s, yaw accel |dω/dt| ≤ 3 rad/s²; heading eases toward the route heading (feed-forward of
 *     the path's turn rate + a time-optimal correction), so it never snaps; a small heading lag on curves is fine
 *     because the base is mecanum (it slides a little)
 * The robot only drives when its heading is within ~20° of the route heading (it rotates in place first at stops).
 * Approaching the target is critically damped: v_d = min(√(2·a·0.9·|e|), k·|e|), then accel-limited.
 */
export const LIMITS = { vMax: 1.0, aMax: 0.5, aLat: 0.4, wMax: Math.PI / 2, alphaMax: 3.0 } as const;
const K_POS = 1.6; // 1/s, gain of the soft approach (critically damped with the accel limit)
const K_YAW = 4.0;
const SAFETY = 0.9; // plan braking at 90 % of the accel limit so discrete steps never exceed it

export interface Motion { s: number; v: number; yaw: number; w: number }

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));

const maxFinite = (c: Float64Array, i: number) => { let k = 1e-9; for (let j = Math.max(0, i - 2); j <= Math.min(c.length - 1, i + 2); j++) if (c[j] !== Infinity) k = Math.max(k, c[j]); return k; };

/** Per-path speed envelopes (forward / backward travel), cached on the path object. */
interface Env { cap: Float64Array; fwd: Float64Array; bwd: Float64Array }
const envCache = new WeakMap<BuiltPath, Env>();
function envelope(path: BuiltPath): Env {
  const hit = envCache.get(path);
  if (hit) return hit;
  const { N, ds, curvature } = path, a = LIMITS.aMax * SAFETY;
  const cap = new Float64Array(N + 1);
  // Review home-r4 #3: curvature is piecewise (line/arc), so an arc can start between two samples. Each cap uses the
  // largest curvature within ±2 samples, and a 0.95 margin on a_lat, so v²κ stays ≤ 0.4 m/s² between samples too.
  for (let i = 0; i <= N; i++) {
    let k = 0;
    for (let j = Math.max(0, i - 2); j <= Math.min(N, i + 2); j++) k = Math.max(k, curvature[j]);
    cap[i] = k === Infinity ? (curvature[i] === Infinity ? 0 : Math.min(LIMITS.vMax, Math.sqrt(LIMITS.aLat * 0.95 / maxFinite(curvature, i)))) : k > 1e-9 ? Math.min(LIMITS.vMax, Math.sqrt(LIMITS.aLat * 0.95 / k)) : LIMITS.vMax;
  }
  // fwd[i]: max speed at i when driving toward +s so that every cap ahead can still be met with decel a.
  const fwd = Float64Array.from(cap), bwd = Float64Array.from(cap);
  for (let i = N - 1; i >= 0; i--) fwd[i] = Math.min(fwd[i], Math.sqrt(fwd[i + 1] ** 2 + 2 * a * ds));
  for (let i = 1; i <= N; i++) bwd[i] = Math.min(bwd[i], Math.sqrt(bwd[i - 1] ** 2 + 2 * a * ds));
  const env = { cap, fwd, bwd };
  envCache.set(path, env);
  return env;
}

/** Max speed allowed at s when moving in direction dir (+1 toward the end). A cusp just passed doesn't block leaving it. */
export function speedCap(path: BuiltPath, s: number, dir: number): number {
  const e = envelope(path), f = s / path.ds;
  // look at the next table sample ahead in the travel direction (the one behind has been passed already)
  const i = dir > 0 ? Math.min(path.N, Math.floor(f) + 1) : Math.max(0, Math.ceil(f) - 1);
  const tab = dir > 0 ? e.fwd : e.bwd, d = Math.abs(i - f) * path.ds;
  // never above the local curve cap at the samples bracketing s (the envelope term alone can exceed it mid-curve)
  const lo = Math.max(0, Math.floor(f)), hi = Math.min(path.N, Math.ceil(f));
  const local = Math.min(e.cap[lo] || e.cap[hi], e.cap[hi] || e.cap[lo]); // a cusp (cap 0) on one side never blocks leaving it
  return Math.min(LIMITS.vMax, local, Math.sqrt(tab[i] ** 2 + 2 * LIMITS.aMax * SAFETY * d));
}

/**
 * Review home-r4 #1: a big scroll jump would leave the hero empty for ~25 s while the robot drives back. Snap
 * (re-init at the target) when the gap is large and the robot is off camera at both ends, or when the scroll sits at
 * an end of the drive (uDrive 0 or 1, where the camera frames a fixed pose and must show the robot there).
 */
export const SNAP_GAP = 2.0; // m
export function shouldSnap(gap: number, uDrive: number, offCamera: boolean): boolean {
  if (Math.abs(gap) < SNAP_GAP) return false;
  return offCamera || uDrive <= 0.001 || uDrive >= 0.999;
}

export function initMotion(path: BuiltPath, s = 0): Motion {
  return { s, v: 0, yaw: path.heading(s), w: 0 };
}

/** Advances the robot by dt toward target arc length sTarget. Pure; mutates and returns m. */
export function stepMotion(m: Motion, sTarget: number, dt: number, path: BuiltPath): Motion {
  if (dt <= 0) return m;
  const L = path.length, a = LIMITS.aMax;
  const tgt = Math.max(0, Math.min(L, sTarget)), e = tgt - m.s;
  const dir = Math.abs(e) < 1e-6 ? 0 : Math.sign(e);
  // desired velocity: soft, critically damped approach, capped by the stopping distance and the curve envelope
  let vd = 0;
  // Don't drive while the body is still far off the route heading (after a cusp it first rotates in place):
  // full speed within 5°, none beyond 20°.
  const herr = Math.abs(wrap(path.heading(m.s) - m.yaw));
  const align = Math.max(0, Math.min(1, (0.35 - herr) / (0.35 - 0.087)));
  if (dir !== 0) vd = dir * align * Math.min(Math.sqrt(2 * a * SAFETY * Math.abs(e)), K_POS * Math.abs(e), speedCap(path, m.s, dir),
    // look one frame ahead (plus 2 samples) so a curve that starts inside this step is already respected
    speedCap(path, Math.max(0, Math.min(L, m.s + dir * (Math.abs(m.v) * dt * 2 + 2 * path.ds))), dir));
  // if moving the other way, the envelope in the current direction still applies while braking
  const dv = Math.max(-a * dt, Math.min(a * dt, vd - m.v));
  m.v += dv;
  m.s = Math.max(0, Math.min(L, m.s + m.v * dt));
  if ((m.s <= 0 && m.v < 0) || (m.s >= L && m.v > 0)) m.v = 0;
  // heading: feed-forward of the route's heading change + time-optimal correction, rate and accel limited
  const h = path.heading(m.s), hAhead = path.heading(Math.max(0, Math.min(L, m.s + 0.01 * Math.sign(m.v || 1))));
  const ff = (wrap(hAhead - h) / 0.01) * Math.abs(m.v);
  const err = wrap(h - m.yaw);
  const corr = Math.sign(err) * Math.min(Math.sqrt(2 * LIMITS.alphaMax * SAFETY * Math.abs(err)), K_YAW * Math.abs(err));
  const wd = Math.max(-LIMITS.wMax, Math.min(LIMITS.wMax, ff + corr));
  m.w += Math.max(-LIMITS.alphaMax * dt, Math.min(LIMITS.alphaMax * dt, wd - m.w));
  m.w = Math.max(-LIMITS.wMax, Math.min(LIMITS.wMax, m.w));
  m.yaw += m.w * dt;
  return m;
}

/**
 * Mecanum (X-roller) inverse kinematics: wheel angular speeds (rad/s) from the body's actual planar motion.
 * vx/vz: world velocity (m/s), yaw: heading (model forward = +Z), w: yaw rate (rad/s, +CCW from above = +rotation.y).
 * k = half wheelbase + half track. Order: FL, FR, RL, RR. Positive = rolling forward.
 */
export function mecanumWheels(vx: number, vz: number, yaw: number, w: number, r = 0.05, k = 0.42): [number, number, number, number] {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);            // forward (+Z rotated by yaw)
  const lx = fz, lz = -fx;                                   // left of forward when looking down +Y (x right, z toward viewer)
  const vf = vx * fx + vz * fz, vl = vx * lx + vz * lz;
  return [(vf - vl - k * w) / r, (vf + vl + k * w) / r, (vf + vl - k * w) / r, (vf - vl + k * w) / r];
}
