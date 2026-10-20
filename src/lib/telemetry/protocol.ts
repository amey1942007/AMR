/** Shared cloud ↔ Pi ↔ /control protocol (amr-bridge). */

export type BotId = 'amr4' | 'hardware-bot';

export const BOTS: { id: BotId; label: string }[] = [
  { id: 'hardware-bot', label: 'Hardware bot' },
  { id: 'amr4', label: 'AMR4' },
];

/** No telemetry for this long → OFFLINE pill (access-flow spec). */
export const HEARTBEAT_OFFLINE_MS = 10_000;
/** Canvas stale veil — long enough that brief lag does not flash “no data”. */
export const STALE_VEIL_MS = 6_000;
export const FULL_RATE_HZ = 10;
export const BOARD_RATE_HZ = 1;
/** Mean inter-frame lag above this → status-board fallback. */
export const LAG_FALLBACK_MS = 800;
/** Recover to full 3D when lag stays below this for a few samples. */
export const LAG_RECOVER_MS = 400;

/** Public Realtime topic. Kept until Review & Debugger turns public access off. */
export function channelName(botId: BotId): string {
  return `amr-bot-${botId}`;
}

export interface Pose3 {
  x: number;
  y: number;
  yaw: number;
}

export interface SysVitals {
  cpu?: number;
  load?: number;
  mem?: [number, number];
  temp?: number;
  disk?: [number, number];
  up?: string;
  throttled?: number;
}

export interface TopicRate {
  hz?: number;
  age?: number | null;
}

export interface ConsoleLogLine {
  time: string;
  level: string;
  text: string;
  ts?: number;
}

export interface BotTelemetry {
  /** Wall-clock ms when the bridge stamped this frame. */
  ts: number;
  botId: BotId;
  seq: number;
  mode: 'full' | 'board';
  online: true;
  pose: [number, number, number];
  mapPose?: [number, number, number] | null;
  vel: [number, number];
  cmd: [number, number];
  imu?: { gz: number; ax: number; ay: number };
  /**
   * Lidar points as [angle_rad, range_m] in the laser frame.
   * `null` keeps the previous cloud. Board mode sends `[]`.
   */
  scan?: [number, number][] | null;
  rates?: Record<string, TopicRate | number>;
  nodes?: Record<string, boolean>;
  tf?: Record<string, { ok: boolean; age: number | null }>;
  nav?: { status?: string; feedback?: string } | null;
  path?: [number, number][];
  goal?: [number, number] | null;
  yoloDet?: unknown[] | string[];
  sem?: [number, number, string][];
  /** zones: [x,y,r,kind]; queue: [x,y] in map frame */
  frontier?: { zones: (number | string)[][]; queue: number[][] };
  sys?: SysVitals;
  tool?: string | null;
  vision?: boolean;
  saving?: boolean;
  logs?: ConsoleLogLine[];
  /** Optional low-rate JPEG data-URL / base64 — only in full mode when camera enabled. */
  cameraJpegB64?: string | null;
  cameraUrl?: string | null;
  seqGoals?: { goals: [number, number][]; idx: number } | null;
}

export interface MapFrame {
  t: 'map';
  botId: BotId;
  ts: number;
  w: number;
  h: number;
  res: number;
  origin: [number, number];
  tf: [number, number, number];
  /** zlib+base64 occupancy cells: 0 unknown, 1 free, 2 occupied */
  data: string;
}

export type ControlCommand =
  | { type: 'estop' }
  | { type: 'nudge'; lin: number; ang: number }
  | { type: 'drive'; lin: number; ang: number }
  | { type: 'joy'; a: number[]; b: number }
  | { type: 'nav_goal'; x: number; y: number }
  | { type: 'nav_cancel' }
  | { type: 'vision'; on: boolean }
  | { type: 'save_map'; name?: string }
  | { type: 'run_tool'; tool: string; params?: Record<string, unknown> }
  | { type: 'stop_tool' }
  | { type: 'blacklist'; action: 'add'; x: number; y: number; radius: number; duration: number }
  | { type: 'blacklist'; action: 'clear' }
  | { type: 'set_rate'; mode: 'full' | 'board' };

/** Public-channel envelope. No token: `amr-bot-*` is still world-readable. */
export interface CommandEnvelope {
  id: string;
  botId: BotId;
  ts: number;
  epoch: number;
  seq: number;
  cmd: ControlCommand | { type: 'joy'; a: number[]; b: number; axes: number[]; buttons: number };
}

export interface HeartbeatMsg {
  t: 'hb';
  botId: BotId;
  ts: number;
  bridgeVersion: string;
}

export function isBotOffline(lastTs: number | null | undefined, now = Date.now()): boolean {
  if (lastTs == null) return true;
  return now - lastTs > HEARTBEAT_OFFLINE_MS;
}

/** Rolling lag estimator for adaptive full ↔ board fallback. */
export function nextLagMs(prev: number, interArrivalMs: number, alpha = 0.35): number {
  if (!Number.isFinite(interArrivalMs) || interArrivalMs < 0) return prev;
  if (!Number.isFinite(prev) || prev <= 0) return interArrivalMs;
  return prev * (1 - alpha) + interArrivalMs * alpha;
}

export function preferBoardMode(lagMs: number, currentlyBoard: boolean): boolean {
  if (currentlyBoard) return lagMs > LAG_RECOVER_MS;
  return lagMs > LAG_FALLBACK_MS;
}
