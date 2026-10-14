// Bakes site/public/data/map_reveal.bin (format: apartment.json → map, and README): 100×70 cells @ 0.1 m, 3 uint8 planes.
import { fileURLToPath, pathToFileURL } from 'node:url';
// Occupied = wall footprints + prop colliders taller than the lidar scan plane. Reveal = 2-D lidar (12 m, 720 rays) swept along
// the path; walls/props block rays, so rooms reveal as the robot enters them.
import fs from 'node:fs'; import path from 'node:path';
import { A, pose, obstacles, corners, roomAt } from './geom.mjs';
const { cols: C, rows: R, cell: S, origin: [ox, oz] } = A.map; const N = C * R;
const SCAN_Y = Number(process.env.SCAN_Y || 0.40), RANGE = 12, RAYS = 720, STEPS = Number(process.env.STEPS || 600);
const state = new Uint8Array(N), reveal = new Uint8Array(N).fill(255), room = new Uint8Array(N).fill(255);
const inRect = (o, x, z) => { const c = Math.cos(o.ang), s = Math.sin(o.ang); const dx = x - o.cx, dz = z - o.cz;
  const lx = dx * c - dz * s, lz = dx * s + dz * c; return Math.abs(lx) <= o.hw && Math.abs(lz) <= o.hd; };
const blockers = obstacles.filter((o) => o.kind === 'wall' || o.h >= SCAN_Y);
for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { const i = r * C + c, x = ox + (c + 0.5) * S, z = oz + (r + 0.5) * S;
  const rm = roomAt(x, z); room[i] = rm ? rm.id : 255;
  state[i] = blockers.some((o) => inRect(o, x, z)) ? 2 : rm ? 1 : 0; }
// sweep
for (let k = 0; k <= STEPS; k++) { const u = k / STEPS, p = pose(u), uv = Math.min(254, Math.ceil(u * 255));
  for (let a = 0; a < RAYS; a++) { const th = (a / RAYS) * Math.PI * 2, dx = Math.cos(th), dz = Math.sin(th);
    for (let t = 0; t < RANGE; t += S * 0.5) { const x = p.x + dx * t, z = p.z + dz * t;
      const c = Math.floor((x - ox) / S), r = Math.floor((z - oz) / S); if (c < 0 || r < 0 || c >= C || r >= R) break;
      const i = r * C + c; if (state[i] === 0) break; if (reveal[i] > uv) reveal[i] = uv; if (state[i] === 2) break; } } }
const out = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../public/data/map_reveal.bin');
fs.mkdirSync(path.dirname(out), { recursive: true });
fs.writeFileSync(out, Buffer.concat([Buffer.from(reveal), Buffer.from(state), Buffer.from(room)]));
const seen = [...reveal].filter((v) => v < 255).length, known = [...room].filter((v) => v !== 255).length;
console.log(`wrote ${out} (${fs.statSync(out).size} bytes); free ${state.filter((v) => v === 1).length}, occupied ${state.filter((v) => v === 2).length}, revealed ${seen}/${known} interior cells`);
for (const rm of A.rooms) { let n = 0, s = 0, first = 255; for (let i = 0; i < N; i++) if (room[i] === rm.id) { n++; if (reveal[i] < 255) { s++; first = Math.min(first, reveal[i]); } }
  console.log(`  ${rm.key.padEnd(9)} ${Math.round((100 * s) / n)}% revealed, first seen u=${(first / 255).toFixed(3)}`); }
// debug PNG-free preview (ASCII, every 2nd cell)
if (process.env.ASCII) for (let r = 0; r < R; r += 2) console.log([...Array(C / 2).keys()].map((c) => { const i = r * C + c * 2; return state[i] === 2 ? '#' : reveal[i] === 255 ? ' ' : '.'; }).join(''));
