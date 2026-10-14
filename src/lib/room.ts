/** Shared room layout (brief §11.2): metres, room 8 × 6 centred at origin, floor y 0. Used by 3D, lidar and grid. */
export const ROOM = { w: 8, d: 6, wallH: 0.6, wallT: 0.1 } as const;

export interface Box { name: string; x: number; z: number; w: number; d: number; h: number; yaw: number; kind: 'wall' | 'prop'; shape?: 'box' | 'cyl' | 'cone'; color?: string }

const hw = ROOM.w / 2, hd = ROOM.d / 2, t = ROOM.wallT, H = ROOM.wallH;
const DOOR_X = 1.5, DOOR_W = 0.9;

/** Walls with pStart for the near-first fade (camera starts south-west). South wall has the door gap. */
export const WALLS: (Box & { pStart: number })[] = [
  { name: 'wall_S_a', x: (-hw + DOOR_X - DOOR_W / 2) / 2, z: hd + t / 2, w: DOOR_X - DOOR_W / 2 + hw, d: t, h: H, yaw: 0, kind: 'wall', pStart: 0.08 },
  { name: 'wall_S_b', x: (hw + DOOR_X + DOOR_W / 2) / 2, z: hd + t / 2, w: hw - DOOR_X - DOOR_W / 2, d: t, h: H, yaw: 0, kind: 'wall', pStart: 0.1 },
  { name: 'wall_W', x: -hw - t / 2, z: 0, w: t, d: ROOM.d + 2 * t, h: H, yaw: 0, kind: 'wall', pStart: 0.12 },
  { name: 'wall_E', x: hw + t / 2, z: 0, w: t, d: ROOM.d + 2 * t, h: H, yaw: 0, kind: 'wall', pStart: 0.15 },
  { name: 'wall_N', x: 0, z: -hd - t / 2, w: ROOM.w, d: t, h: H, yaw: 0, kind: 'wall', pStart: 0.18 },
];
export const DOOR = { x: DOOR_X, w: DOOR_W };

const deg = Math.PI / 180;
/** Primitive stand-ins at the §11.2 positions (rise-in staggered 0.10–0.30 p in order). */
export const PROPS: Box[] = [
  { name: 'prop_table_1', x: 1.2, z: -1.0, w: 1.2, d: 0.7, h: 0.45, yaw: 0, kind: 'prop' },
  { name: 'prop_chair_1', x: 0.6, z: -1.0, w: 0.45, d: 0.45, h: 0.85, yaw: 90 * deg, kind: 'prop' },
  { name: 'prop_chair_2', x: 1.8, z: -1.0, w: 0.45, d: 0.45, h: 0.85, yaw: -90 * deg, kind: 'prop' },
  { name: 'prop_shelves_1', x: -1.0, z: -2.75, w: 2.0, d: 0.4, h: 1.8, yaw: 0, kind: 'prop' },
  { name: 'prop_cabinet_1', x: 2.9, z: -2.6, w: 0.6, d: 0.5, h: 1.0, yaw: 0, kind: 'prop' },
  { name: 'prop_box_1', x: -1.8, z: -0.4, w: 0.4, d: 0.3, h: 0.3, yaw: 15 * deg, kind: 'prop' },
  { name: 'prop_box_2', x: -1.6, z: -0.9, w: 0.45, d: 0.35, h: 0.35, yaw: -10 * deg, kind: 'prop' },
  { name: 'prop_box_3', x: 3.2, z: 1.0, w: 0.4, d: 0.3, h: 0.3, yaw: 30 * deg, kind: 'prop' },
  { name: 'prop_crate_1', x: -0.5, z: -1.8, w: 0.55, d: 0.4, h: 0.3, yaw: 0, kind: 'prop' },
  { name: 'prop_plant_1', x: 3.4, z: 2.4, w: 0.45, d: 0.45, h: 1.0, yaw: 0, kind: 'prop', shape: 'cyl' },
  { name: 'prop_cone_1', x: 0.0, z: 0.2, w: 0.3, d: 0.3, h: 0.45, yaw: 0, kind: 'prop', shape: 'cone' },
  { name: 'prop_cone_2', x: 2.2, z: 0.0, w: 0.3, d: 0.3, h: 0.45, yaw: 0, kind: 'prop', shape: 'cone' },
];
export const OBSTACLES: Box[] = [...WALLS, ...PROPS];

/** 2D ray (origin, unit dir) vs yawed box footprint in XZ. Returns distance or Infinity. */
export function rayBox(ox: number, oz: number, dx: number, dz: number, b: Box): number {
  const c = Math.cos(-b.yaw), s = Math.sin(-b.yaw);
  const lx = (ox - b.x) * c - (oz - b.z) * s, lz = (ox - b.x) * s + (oz - b.z) * c;
  const ldx = dx * c - dz * s, ldz = dx * s + dz * c;
  const hx = b.w / 2, hz = b.d / 2;
  let t0 = -Infinity, t1 = Infinity;
  for (const [o, d, h] of [[lx, ldx, hx], [lz, ldz, hz]] as const) {
    if (Math.abs(d) < 1e-9) { if (o < -h || o > h) return Infinity; continue; }
    let a = (-h - o) / d, bb = (h - o) / d;
    if (a > bb) [a, bb] = [bb, a];
    t0 = Math.max(t0, a); t1 = Math.min(t1, bb);
    if (t0 > t1) return Infinity;
  }
  return t1 < 0 ? Infinity : Math.max(0, t0);
}

export function castRay(ox: number, oz: number, ang: number, max = 12, list: Box[] = OBSTACLES) {
  const dx = Math.cos(ang), dz = Math.sin(ang);
  let best = max;
  for (const b of list) { const d = rayBox(ox, oz, dx, dz, b); if (d < best) best = d; }
  return { dist: best, hit: best < max, x: ox + dx * best, z: oz + dz * best };
}
