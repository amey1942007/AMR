// Robot route geometry shared by the site (TS, via path-core.d.mts) and the node tools (scripts/apartment).
// A route is a polyline of points; every interior corner is rounded with a circular fillet (radius `radius`, never
// below `minRadius`, so the path has continuous tangents and bounded curvature), except at a `cusp`, where the robot
// stops and drives back out (mecanum robots can reverse). Each segment has a heading mode, set on its start point:
//   'fwd'  heading = path tangent (driving forward)
//   'rev'  heading = tangent + π (reversing)
//   'hold' heading held from the previous segment (mecanum strafe: the body slides, it doesn't turn), or set by
//          `faceDeg` on the start point (yaw in degrees; the robot rotates in place at the preceding cusp first)
// Arc length s is exact (lines + arcs), so speed limits and curvature are exact too.

const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));

/** @param {{p:[number,number], mode?:'fwd'|'rev'|'hold', cusp?:boolean, r?:number, faceDeg?:number}[]} route  (r: fillet radius at this corner) */
export function buildPath(route, { radius = 0.45, minRadius = 0.3 } = {}) {
  const P = route.map((r) => r.p), n = P.length;
  if (n < 2) throw new Error('route needs ≥ 2 points');
  const dir = (a, b) => { const dx = b[0] - a[0], dz = b[1] - a[1], l = Math.hypot(dx, dz); return { x: dx / l, z: dz / l, l }; };
  const segs = []; for (let i = 0; i < n - 1; i++) segs.push(dir(P[i], P[i + 1]));
  // Fillet at each interior non-cusp corner: tangent length t = R·tan(φ/2), using ≤ 45 % of each adjacent segment.
  const cut = new Array(n).fill(0), fil = new Array(n).fill(null);
  for (let i = 1; i < n - 1; i++) {
    if (route[i].cusp) continue;
    const a = segs[i - 1], b = segs[i];
    const phi = Math.acos(Math.max(-1, Math.min(1, a.x * b.x + a.z * b.z)));
    if (phi < 1e-4) continue;
    if (phi > Math.PI - 1e-3) throw new Error(`route point ${i}: reversal without cusp`);
    const tan = Math.tan(phi / 2);
    const R = Math.min(route[i].r ?? radius, (0.45 * Math.min(a.l, b.l)) / tan);
    if (R < minRadius - 1e-9) throw new Error(`route point ${i} (${P[i]}): fillet radius ${R.toFixed(3)} m < ${minRadius} m (segments too short for a ${(phi * 180 / Math.PI).toFixed(0)}° turn)`);
    cut[i] = R * tan;
    const turn = Math.sign(a.x * b.z - a.z * b.x); // +1 = turning toward +z from +x (left in x/z with y up = CW from above)
    // centre: offset from the fillet start along the in-direction's normal on the turning side
    const sx = P[i][0] - a.x * cut[i], sz = P[i][1] - a.z * cut[i];
    const nx = -a.z * turn, nz = a.x * turn;
    fil[i] = { R, phi, turn, cx: sx + nx * R, cz: sz + nz * R, a0: Math.atan2(-nz, -nx) };
  }
  // Pieces: line (from P[i] + cut[i] to P[i+1] - cut[i+1]) then the arc at P[i+1].
  const pieces = []; let s = 0;
  const modeOf = (i) => route[i].mode ?? 'fwd';
  for (let i = 0; i < n - 1; i++) {
    const d = segs[i], l0 = cut[i], l1 = d.l - cut[i + 1];
    if (l1 - l0 < -1e-9) throw new Error(`segment ${i} too short for its fillets`);
    pieces.push({ kind: 'line', s0: s, len: l1 - l0, x0: P[i][0] + d.x * l0, z0: P[i][1] + d.z * l0, dx: d.x, dz: d.z, mode: modeOf(i), seg: i, face: route[i].faceDeg });
    s += l1 - l0;
    const f = fil[i + 1];
    if (f) {
      // the arc belongs half to each segment's mode; use the outgoing mode for its second half
      pieces.push({ kind: 'arc', s0: s, len: f.R * f.phi, ...f, mode: modeOf(i), mode2: modeOf(i + 1), seg: i });
      s += f.R * f.phi;
    }
  }
  const length = s;
  const cuspS = []; { let acc = 0; for (const pc of pieces) { if (pc.kind === 'line' && pc.seg > 0 && route[pc.seg].cusp && Math.abs(pc.s0 - acc) < 1e-9) cuspS.push(pc.s0); acc = pc.s0 + pc.len; } }

  /** Raw geometry at arc length s: position, unit tangent (direction of increasing s), signed curvature. */
  function geo(sq) {
    const t = Math.max(0, Math.min(length, sq));
    let lo = 0, hi = pieces.length - 1;
    while (lo < hi) { const m = (lo + hi + 1) >> 1; if (pieces[m].s0 <= t) lo = m; else hi = m - 1; }
    const pc = pieces[lo], q = t - pc.s0;
    if (pc.kind === 'line') return { x: pc.x0 + pc.dx * q, z: pc.z0 + pc.dz * q, tx: pc.dx, tz: pc.dz, k: 0, mode: pc.mode, piece: lo, face: pc.face };
    const a = pc.a0 + pc.turn * (q / pc.R); // the angle advances in the turn direction
    const x = pc.cx + Math.cos(a) * pc.R, z = pc.cz + Math.sin(a) * pc.R;
    // tangent = derivative of position wrt q
    const tx = -Math.sin(a) * pc.turn, tz = Math.cos(a) * pc.turn;
    return { x, z, tx, tz, k: 1 / pc.R, mode: q < pc.len / 2 ? pc.mode : pc.mode2, piece: lo };
  }
  // Target heading table (hold = keep the previous heading), sampled densely so it is cheap at runtime.
  const N = Math.max(200, Math.ceil(length / 0.01));
  const ds = length / N, head = new Float64Array(N + 1), kap = new Float64Array(N + 1);
  let last = 0;
  for (let i = 0; i <= N; i++) {
    const g = geo(i * ds), tang = Math.atan2(g.tx, g.tz);
    let h = g.mode === 'rev' ? wrap(tang + Math.PI) : g.mode === 'hold' ? (g.face !== undefined ? (g.face * Math.PI) / 180 : last) : tang;
    if (i > 0) h = last + wrap(h - last); // unwrap so the table is continuous
    head[i] = h; last = h; kap[i] = g.k;
  }
  for (const c of cuspS) kap[Math.round(c / ds)] = Infinity; // the robot must stop at a cusp
  const lerpTab = (tab, sq) => { const f = Math.max(0, Math.min(N, sq / ds)), i = Math.min(N - 1, Math.floor(f)); return tab[i] + (tab[i + 1] - tab[i]) * (f - i); };
  return {
    length, pieces, cuspS, N, ds,
    /** position + target heading (yaw, three.js rotation.y with model forward = +Z) + curvature at arc length s */
    at(sq) { const g = geo(sq); return { x: g.x, z: g.z, tx: g.tx, tz: g.tz, k: g.k, mode: g.mode, heading: lerpTab(head, sq) }; },
    heading: (sq) => lerpTab(head, sq),
    /** curvature table (1/m) with Infinity at cusps; index i ↔ s = i·ds */
    curvature: kap,
  };
}
