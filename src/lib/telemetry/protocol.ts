/** Shared cloud ↔ Pi ↔ /control protocol (amr-bridge). */

export type BotId = 'amr4' | 'hardware-bot';

/** Higher wins control lock. Viewer cannot drive; Operator can; Admin/Owner preempt. */
export type AuthorityRank = 0 | 1 | 2 | 3;

export const RANK_LABEL: Record<AuthorityRank, string> = {
  0: 'Viewer',
  1: 'Operator',
  2: 'Admin',
  3: 'Owner',
};

export const BOTS: { id: BotId; label: string }[] = [
  { id: 'amr4', label: 'AMR4' },
  { id: 'hardware-bot', label: 'Hardware bot' },
];

export const HEARTBEAT_OFFLINE_MS = 3000;
export const FULL_RATE_HZ = 10;
export const BOARD_RATE_HZ = 1;
/** Mean inter-frame lag above this → status-board fallback. */
export const LAG_FALLBACK_MS = 800;
/** Recover to full 3D when lag stays below this for a few samples. */
export const LAG_RECOVER_MS = 400;

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
  /** Lidar points as [angle_rad, range_m] in laser frame — omitted in board mode. */
  scan?: [number, number][];
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
  | { type: 'drive'; lin: number; ang: number } // continuous teleop pulse (same as nudge)
  | { type: 'joy'; axes: number[]; buttons: number } // Xbox layout → Pi web_gamepad /api/joy
  | { type: 'nav_goal'; x: number; y: number }
  | { type: 'nav_cancel' }
  | { type: 'vision'; on: boolean }
  | { type: 'save_map'; name?: string }
  | { type: 'run_tool'; tool: string; params?: Record<string, unknown> }
  | { type: 'stop_tool' }
  | { type: 'blacklist'; action: 'add'; x: number; y: number; radius: number; duration: number }
  | { type: 'blacklist'; action: 'clear' }
  | { type: 'set_rate'; mode: 'full' | 'board' };

export interface CommandEnvelope {
  id: string;
  botId: BotId;
  ts: number;
  from: { userId: string; email?: string; rank: AuthorityRank };
  cmd: ControlCommand;
}

export interface ControlLockPresence {
  userId: string;
  email?: string;
  rank: AuthorityRank;
  controlling: boolean;
  since: number;
}

export interface HeartbeatMsg {
  t: 'hb';
  botId: BotId;
  ts: number;
  bridgeVersion: string;
}

export function canDrive(rank: AuthorityRank): boolean {
  return rank >= 1;
}

/** True if challenger may take (or keep) the control lock from current holder. */
export function canTakeControl(
  challenger: AuthorityRank,
  holder: AuthorityRank | null | undefined,
): boolean {
  if (!canDrive(challenger)) return false;
  if (holder == null) return true;
  return challenger >= holder;
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

export function clampAuthority(n: unknown): AuthorityRank {
  const v = Number(n);
  if (v >= 3) return 3;
  if (v === 2) return 2;
  if (v === 1) return 1;
  return 0;
}
