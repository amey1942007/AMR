import { describe, expect, it } from 'vitest';
import { LIMITS, initMotion, mecanumWheels, stepMotion, type Motion } from '@/lib/robot-motion';
import { ROUTE } from '@/lib/path';
import { OBSTACLES, type Box } from '@/lib/room';

const wrap = (a: number) => Math.atan2(Math.sin(a), Math.cos(a));
const L = ROUTE.length;

/** Simulates the robot at 60 fps against a scroll trace target(t) (normalised 0..1); returns the limit maxima. */
function simulate(target: (t: number) => number, T: number, dt = 1 / 60) {
  const m: Motion = initMotion(ROUTE, target(0) * L);
  let vMax = 0, aMax = 0, wMax = 0, alphaMax = 0, latMax = 0, prevV = 0, prevW = 0, prevYaw = m.yaw;
  const poses: { s: number; yaw: number }[] = [];
  for (let t = 0; t < T; t += dt) {
    stepMotion(m, target(t) * L, dt, ROUTE);
    const w = wrap(m.yaw - prevYaw) / dt;
    vMax = Math.max(vMax, Math.abs(m.v));
    aMax = Math.max(aMax, Math.abs(m.v - prevV) / dt);
    wMax = Math.max(wMax, Math.abs(w));
    alphaMax = Math.max(alphaMax, Math.abs(w - prevW) / dt);
    const k = ROUTE.at(m.s).k;
    latMax = Math.max(latMax, m.v * m.v * k);
    prevV = m.v; prevW = w; prevYaw = m.yaw;
    poses.push({ s: m.s, yaw: m.yaw });
  }
  return { vMax, aMax, wMax, alphaMax, latMax, end: m, poses };
}
const TOL = 1e-6;
function expectLimits(r: ReturnType<typeof simulate>) {
  expect(r.vMax).toBeLessThanOrEqual(LIMITS.vMax + TOL);
  expect(r.aMax).toBeLessThanOrEqual(LIMITS.aMax + TOL);
  expect(r.wMax).toBeLessThanOrEqual(LIMITS.wMax + TOL);
  expect(r.alphaMax).toBeLessThanOrEqual(LIMITS.alphaMax + 1e-3);
  expect(r.latMax).toBeLessThanOrEqual(LIMITS.aLat + TOL); // review home-r4 #3: v²κ ≤ 0.4 m/s² everywhere, no slack
}

describe('robot motion: physical limits under any scroll', () => {
  it('fast scroll p 0 → 1 in 0.5 s: no teleport, smooth catch-up within all limits, arrives', () => {
    const r = simulate((t) => Math.min(1, t / 0.5), 80);
    expectLimits(r);
    expect(r.end.s).toBeCloseTo(L, 2);
    expect(Math.abs(r.end.v)).toBeLessThan(1e-3);
  });
  it('jumps back and forth (anchor jumps / scroll flicks) never exceed the limits', () => {
    const jumps = [0.0, 0.8, 0.1, 0.55, 0.3, 1.0, 0.0];
    const r = simulate((t) => jumps[Math.min(jumps.length - 1, Math.floor(t / 6))], 6 * jumps.length + 30);
    expectLimits(r);
  });
  it('lateral accel ≤ 0.4 m/s² sampled densely (240 fps) through every curve, incl. right after cusps', () => {
    const r = simulate((t) => Math.min(1, t / 0.5), 80, 1 / 240);
    expect(r.latMax).toBeLessThanOrEqual(LIMITS.aLat + TOL);
    console.log(`latMax ${r.latMax.toFixed(4)} vMax ${r.vMax.toFixed(4)} aMax ${r.aMax.toFixed(4)} wMax(deg/s) ${(r.wMax * 180 / Math.PI).toFixed(2)}`);
  });
  it('jittery trackpad scroll (sawtooth target) stays within limits', () => {
    const r = simulate((t) => Math.min(1, Math.max(0, t / 60 + 0.03 * Math.sin(t * 9))), 70);
    expectLimits(r);
  });
  it('heading never snaps: per-frame yaw change ≤ ω_max·dt at 30 fps too', () => {
    const r = simulate((t) => Math.min(1, t / 3), 60, 1 / 30);
    expectLimits(r);
  });
  it('the actually-driven poses keep ≥ 0.15 m from every collider', () => {
    const r = simulate((t) => Math.min(1, t / 0.5), 80);
    let min = Infinity, at = '';
    const rect = (x: number, z: number, hw: number, hd: number, a: number) => {
      const c = Math.cos(a), s = Math.sin(a);
      return { pts: [[1, 1], [1, -1], [-1, -1], [-1, 1]].map(([i, j]) => [x + i * hw * c + j * hd * s, z - i * hw * s + j * hd * c]), ax: [[c, -s], [s, c]] };
    };
    const gap = (A: ReturnType<typeof rect>, B: ReturnType<typeof rect>) => {
      let best = -Infinity;
      for (const ax of [...A.ax, ...B.ax]) {
        const pa = A.pts.map((p) => p[0] * ax[0] + p[1] * ax[1]), pb = B.pts.map((p) => p[0] * ax[0] + p[1] * ax[1]);
        best = Math.max(best, Math.min(...pb) - Math.max(...pa), Math.min(...pa) - Math.max(...pb));
      }
      return best;
    };
    const obs = (OBSTACLES as Box[]).map((b) => ({ b, R: rect(b.x, b.z, b.w / 2, b.d / 2, b.yaw) }));
    for (let i = 0; i < r.poses.length; i += 3) {
      const p = r.poses[i], q = ROUTE.at(p.s), R = rect(q.x, q.z, 0.26, 0.315, p.yaw);
      for (const o of obs) { const g = gap(R, o.R); if (g < min) { min = g; at = `${o.b.name} @ s=${p.s.toFixed(2)}`; } }
    }
    expect(min, at).toBeGreaterThanOrEqual(0.15);
  });
  it('route: minimum turn radius ≥ 0.3 m', () => {
    let minR = Infinity;
    for (let i = 0; i <= ROUTE.N; i++) { const k = ROUTE.curvature[i]; if (k > 0 && k !== Infinity) minR = Math.min(minR, 1 / k); }
    expect(minR).toBeGreaterThanOrEqual(0.3 - 1e-9);
  });
  it('mecanum wheels: forward = all equal; strafe left = FL/RR back, FR/RL forward; turn left = left side slower', () => {
    const f = mecanumWheels(0, 1, 0, 0);
    expect(f.every((w) => Math.abs(w - f[0]) < 1e-9 && w > 0)).toBe(true);
    const sl = mecanumWheels(1, 0, 0, 0); // +X is the robot's left at yaw 0
    expect(sl[0]).toBeLessThan(0); expect(sl[3]).toBeLessThan(0); expect(sl[1]).toBeGreaterThan(0); expect(sl[2]).toBeGreaterThan(0);
    const tl = mecanumWheels(0, 0.5, 0, 1);
    expect(tl[0]).toBeLessThan(tl[1]); expect(tl[2]).toBeLessThan(tl[3]);
  });
});

describe('snap on big jumps (review home-r4 #1)', () => {
  it('snaps when the gap ≥ 2 m and off camera, or at uDrive 0/1; never for small gaps', async () => {
    const { shouldSnap } = await import('@/lib/robot-motion');
    expect(shouldSnap(20.6, 0, false)).toBe(true);   // End → Home: hero shows the robot at s=0 immediately
    expect(shouldSnap(-20, 1, false)).toBe(true);
    expect(shouldSnap(10, 0.4, true)).toBe(true);    // fling while the robot is out of frame
    expect(shouldSnap(10, 0.4, false)).toBe(false);  // visible: drive physically
    expect(shouldSnap(1.5, 0, true)).toBe(false);    // small gaps always drive
  });
});
