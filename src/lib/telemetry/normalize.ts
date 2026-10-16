/**
 * Telemetry normalizer.
 *
 * The in-repo bridge (`amr-bridge/amr_telemetry_bridge/bridge.py`) broadcasts camelCase
 * (`mapPose`, `yoloDet`, `cameraJpegB64`). The dashboard spec assumed the Pi SSE dict
 * (`map_pose`, `yolo_det`, and an unnamed JPEG field). Both are accepted.
 * The Ros_lidar_bot `hardware` branch bridge.py was not readable from GitHub (404).
 */

import type { MapFrame } from './protocol';

export interface NormState {
  pose: [number, number, number] | null;
  mapPose: [number, number, number] | null;
  vel: [number, number];
  cmd: [number, number];
  imu: { gz: number };
  scan: [number, number][];
  path: [number, number][];
  goal: [number, number] | null;
  frontier: { zones: [number, number, number, string][]; queue: [number, number][] };
  sem: [number, number, string][];
  nodes: Record<string, boolean>;
  rates: Record<string, { hz: number; age: number | null }>;
  tf: Record<string, { ok: boolean; age: number | null }>;
  sys: {
    cpu?: number;
    temp?: number;
    mem?: [number, number];
    disk?: [number, number];
    load?: number;
    up?: string;
    throttled?: number;
  };
  tool: string | null;
  vision: boolean;
  saving: boolean;
  seq: { goals: [number, number][]; idx: number } | null;
  yoloText: string;
  /** Raw base64 or a data URL. Null when the frame field is absent. */
  camera: string | null;
  ts: number | null;
}

const CAMERA_KEYS = ['cameraJpegB64', 'camera_jpeg_b64', 'camera_jpeg', 'jpeg', 'frame', 'camera_frame'];

export function normalizeTelemetry(raw: unknown): NormState | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (o.t === 'map' || o.t === 'log' || o.t === 'hb') return null;
  const pose = vec3(o.pose);
  const mapPose = vec3(o.mapPose ?? o.map_pose);
  return {
    pose,
    mapPose,
    vel: vec2(o.vel),
    cmd: vec2(o.cmd),
    imu: { gz: num((o.imu as { gz?: unknown } | undefined)?.gz) ?? 0 },
    scan: pairs(o.scan),
    path: pairs(o.path),
    goal: vec2orNull(o.goal),
    frontier: frontier(o.frontier),
    sem: sem(o.sem),
    nodes: boolMap(o.nodes),
    rates: rates(o.rates),
    tf: tf(o.tf),
    sys: sys(o.sys),
    tool: typeof o.tool === 'string' && o.tool ? o.tool : null,
    vision: Boolean(o.vision),
    saving: Boolean(o.saving),
    seq: seq(o.seq),
    yoloText: yolo(o.yoloDet ?? o.yolo_det),
    camera: cameraOf(o),
    ts: typeof o.ts === 'number' ? o.ts : null,
  };
}

export function normalizeMap(raw: unknown): MapFrame | null {
  if (!raw || typeof raw !== 'object') return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.data !== 'string' || !Array.isArray(o.tf)) return null;
  const tf = o.tf as unknown[];
  return {
    t: 'map',
    botId: (o.botId as MapFrame['botId']) ?? 'amr4',
    ts: typeof o.ts === 'number' ? o.ts : Date.now(),
    w: num(o.w) ?? 0,
    h: num(o.h) ?? 0,
    res: num(o.res) ?? 0.05,
    origin: [num((o.origin as unknown[] | undefined)?.[0]) ?? 0, num((o.origin as unknown[] | undefined)?.[1]) ?? 0],
    tf: [num(tf[0]) ?? 0, num(tf[1]) ?? 0, num(tf[2]) ?? 0],
    data: o.data,
  };
}

export function cameraSrc(camera: string | null): string | null {
  if (!camera) return null;
  if (camera.startsWith('data:')) return camera;
  return `data:image/jpeg;base64,${camera}`;
}

export function yoloText(raw: unknown): string {
  return yolo(raw);
}

function cameraOf(o: Record<string, unknown>): string | null {
  for (const k of CAMERA_KEYS) {
    const v = o[k];
    if (typeof v === 'string' && v.length > 16) return v;
  }
  return null;
}

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function vec3(v: unknown): [number, number, number] | null {
  if (!Array.isArray(v) || v.length < 3) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  const c = num(v[2]);
  if (a == null || b == null || c == null) return null;
  return [a, b, c];
}

function vec2(v: unknown): [number, number] {
  if (!Array.isArray(v)) return [0, 0];
  return [num(v[0]) ?? 0, num(v[1]) ?? 0];
}

function vec2orNull(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  if (a == null || b == null) return null;
  return [a, b];
}

function pairs(v: unknown): [number, number][] {
  if (!Array.isArray(v)) return [];
  const out: [number, number][] = [];
  for (const row of v) {
    const p = vec2orNull(row);
    if (p) out.push(p);
  }
  return out;
}

function frontier(v: unknown): NormState['frontier'] {
  const empty = { zones: [] as [number, number, number, string][], queue: [] as [number, number][] };
  if (!v || typeof v !== 'object') return empty;
  const o = v as { zones?: unknown; queue?: unknown };
  if (Array.isArray(o.zones)) {
    for (const z of o.zones) {
      if (!Array.isArray(z) || z.length < 3) continue;
      const x = num(z[0]);
      const y = num(z[1]);
      const r = num(z[2]);
      if (x == null || y == null || r == null) continue;
      empty.zones.push([x, y, r, typeof z[3] === 'string' ? z[3] : 'bl']);
    }
  }
  empty.queue = pairs(o.queue);
  return empty;
}

function sem(v: unknown): [number, number, string][] {
  if (!Array.isArray(v)) return [];
  const out: [number, number, string][] = [];
  for (const row of v) {
    if (!Array.isArray(row) || row.length < 3) continue;
    const x = num(row[0]);
    const y = num(row[1]);
    if (x == null || y == null) continue;
    out.push([x, y, String(row[2])]);
  }
  return out;
}

function boolMap(v: unknown): Record<string, boolean> {
  if (!v || typeof v !== 'object') return {};
  const out: Record<string, boolean> = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) out[k] = Boolean(val);
  return out;
}

function rates(v: unknown): NormState['rates'] {
  if (!v || typeof v !== 'object') return {};
  const out: NormState['rates'] = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (typeof val === 'number') out[k] = { hz: val, age: null };
    else if (val && typeof val === 'object') {
      const r = val as { hz?: unknown; age?: unknown };
      out[k] = { hz: num(r.hz) ?? 0, age: r.age == null ? null : num(r.age) };
    }
  }
  return out;
}

function tf(v: unknown): NormState['tf'] {
  if (!v || typeof v !== 'object') return {};
  const out: NormState['tf'] = {};
  for (const [k, val] of Object.entries(v as Record<string, unknown>)) {
    if (!val || typeof val !== 'object') continue;
    const r = val as { ok?: unknown; age?: unknown };
    out[k] = { ok: Boolean(r.ok), age: r.age == null ? null : num(r.age) };
  }
  return out;
}

function sys(v: unknown): NormState['sys'] {
  if (!v || typeof v !== 'object') return {};
  const o = v as Record<string, unknown>;
  const mem = pair(o.mem ?? o.ram);
  const disk = pair(o.disk);
  return {
    cpu: num(o.cpu) ?? undefined,
    temp: num(o.temp ?? o.soc) ?? undefined,
    mem: mem ?? undefined,
    disk: disk ?? undefined,
    load: num(o.load) ?? undefined,
    up: typeof o.up === 'string' ? o.up : typeof o.uptime === 'string' ? o.uptime : undefined,
    throttled: num(o.throttled) ?? undefined,
  };
}

function pair(v: unknown): [number, number] | null {
  if (!Array.isArray(v) || v.length < 2) return null;
  const a = num(v[0]);
  const b = num(v[1]);
  if (a == null || b == null) return null;
  return [a, b];
}

function seq(v: unknown): NormState['seq'] {
  if (!v || typeof v !== 'object') return null;
  const o = v as { goals?: unknown; idx?: unknown };
  return { goals: pairs(o.goals), idx: num(o.idx) ?? -1 };
}

function yolo(v: unknown): string {
  if (!v) return '';
  if (typeof v === 'string') return v;
  if (!Array.isArray(v)) return '';
  const names = v.map((d) => {
    if (typeof d === 'string') return d;
    if (d && typeof d === 'object' && 'name' in d) return String((d as { name: unknown }).name);
    return '';
  }).filter(Boolean);
  return names.join(', ');
}
