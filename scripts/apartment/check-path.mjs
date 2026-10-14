// CI check: 400 arc-length samples of the robot path with the 0.52 × 0.63 m footprint (oriented by heading; heading held
// during the strafe window) against walls and prop colliders from apartment.json. Exit 1 on any overlap.
import { A, pose, robotRect, obstacles, gap, pathLength, roomAt, cuspPoses } from './geom.mjs';
const N = Number(process.env.SAMPLES || 2000); let fails = 0;
// Review v3 ruling: minimum clearance 0.15 m between the robot footprint and any collider (was: no overlap).
const MIN = Number(process.env.MIN_CLEARANCE ?? 0.15); let minGap = { g: Infinity };
const minProp = { g: Infinity };
const samples = [...Array.from({ length: N }, (_, i) => ({ u: i / (N - 1) })), ...cuspPoses()];
for (const smp of samples) { const u = smp.u; const r = smp.heading === undefined ? robotRect(u) : robotRect(u, smp);
  for (const o of obstacles) { const g = gap(r, o);
    if (g < minGap.g) minGap = { g, u, id: o.id };
    if (o.kind === 'prop' && g < minProp.g) Object.assign(minProp, { g, u, id: o.id });
    if (g < MIN) { fails++; if (fails <= 40) console.log(`CLEARANCE<${MIN} u=${u.toFixed(4)} (${r.x.toFixed(2)}, ${r.z.toFixed(2)}) with ${o.id} depth ${(-g).toFixed(3)} m`); } } }
// doorway crossings: the path must cross each door near its centre
const doors = []; for (const d of A.doorways) { let prev = null;
  for (let i = 0; i <= 4000; i++) { const p = pose(i / 4000); const s = d.axis === 'x' ? p.z - d.center[1] : p.x - d.center[0];
    const along = d.axis === 'x' ? p.x : p.z; const c = (d.span[0] + d.span[1]) / 2;
    if (prev && Math.sign(s) !== Math.sign(prev.s) && Math.abs(along - c) < 1.0) {
      doors.push(`${d.id}: crossed at ${along.toFixed(2)} (centre ${c.toFixed(2)}, off ${(along - c).toFixed(2)})`); }
    prev = { s }; } }
// room sequence along the path (first entry per room, in order)
const seq = []; for (let i = 0; i <= 2000; i++) { const q = pose(i / 2000), r = roomAt(q.x, q.z); const k = r ? r.key : 'outside'; if (!seq.length || seq[seq.length - 1].room !== k) seq.push({ room: k, u: i / 2000 }); }
const roomCheck = [seq.map((x) => `${x.room}@${x.u.toFixed(3)}`).join(' → ')];
console.log(`path length ${pathLength.toFixed(2)} m ; samples ${samples.length} (incl. in-place rotations at ${samples.length - N} cusp poses); obstacles ${obstacles.length}`);
console.log(`min clearance ${minGap.g.toFixed(3)} m at u=${minGap.u.toFixed(3)} (${minGap.id}); min to furniture ${minProp.g.toFixed(3)} m (${minProp.id}, u=${minProp.u?.toFixed(3)})`);
doors.forEach((d) => console.log('  ' + d)); roomCheck.forEach((r) => console.log('  ' + r));
console.log(fails ? `FAIL: ${fails} sample/collider pairs closer than ${MIN} m` : `PASS: clearance >= ${MIN} m everywhere`); process.exit(fails ? 1 : 0);
