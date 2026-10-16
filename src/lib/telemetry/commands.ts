import type { ControlCommand } from './protocol';

export const REQUEST_WINDOW_S = 10;
export const COOLDOWN_S = 30;
export const HEARTBEAT_MS = 5_000;
export const PENDING_POLL_MS = 2_000;
export const NUDGE_REPEAT_MS = 150;
export const JOY_HZ = 15;
export const ESTOP_RETRY_MS = 250;
export const LIN_LIMIT = 0.3;
export const ANG_LIMIT = 1;

const CONTINUOUS = new Set(['estop', 'nudge', 'joy', 'drive']);

export function isContinuous(cmd: ControlCommand): boolean {
  return CONTINUOUS.has(cmd.type);
}

export function isDiscrete(cmd: ControlCommand): boolean {
  return !isContinuous(cmd);
}

export function clampLinAng(lin: number, ang: number): { lin: number; ang: number } {
  return {
    lin: clamp(lin, -LIN_LIMIT, LIN_LIMIT),
    ang: clamp(ang, -ANG_LIMIT, ANG_LIMIT),
  };
}

export function clamp(n: number, lo: number, hi: number): number {
  if (!Number.isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

/** IMU calibration and drive-distance inputs. Returns null when a field is invalid. */
export function clampToolParams(
  tool: 'imu_calibration' | 'drive_distance',
  raw: { speed?: number; rotations?: number; distance?: number; maxVel?: number },
): Record<string, string> | null {
  if (tool === 'imu_calibration') {
    const speed = raw.speed;
    const rotations = raw.rotations;
    if (speed == null || rotations == null || speed < 0.1 || speed > 1 || rotations < 0.5 || rotations > 4) return null;
    return { speed: String(speed), rotations: String(rotations) };
  }
  const distance = raw.distance;
  const maxVel = raw.maxVel;
  if (distance == null || maxVel == null || distance < -5 || distance > 5 || maxVel < 0.05 || maxVel > 0.5) return null;
  return { distance: String(distance), max_vel: String(maxVel) };
}

export interface SeqCounter {
  next(epoch: number): number;
}

/** `seq` starts at 1 and increases for one epoch. A new epoch starts again at 1. */
export function createSeqCounter(): SeqCounter {
  let epoch = Number.NaN;
  let seq = 0;
  return {
    next(nextEpoch: number) {
      if (!Number.isFinite(nextEpoch)) throw new Error('epoch required');
      if (nextEpoch !== epoch) {
        epoch = nextEpoch;
        seq = 0;
      }
      seq += 1;
      return seq;
    },
  };
}

export interface WireMeta {
  epoch: number;
  token: string;
  seq: number;
  ts: number;
}

/** Payload for the private `bot:<id>:cmd` topic. Includes the token. */
export function privateCmdPayload(cmd: ControlCommand, meta: WireMeta): Record<string, unknown> {
  return { epoch: meta.epoch, token: meta.token, seq: meta.seq, ts: meta.ts, ...commandBody(cmd) };
}

/**
 * Public `amr-bot-*` envelope. Epoch and seq travel along, but the token does not:
 * that topic is still public. Joy is sent with both the new `{a,b}` fields and the
 * `{axes,buttons}` aliases the in-repo bridge reads.
 */
export function publicCommandEnvelope(
  botId: string,
  cmd: ControlCommand,
  meta: Omit<WireMeta, 'token'> & { id: string },
): Record<string, unknown> {
  return {
    id: meta.id,
    botId,
    ts: meta.ts,
    epoch: meta.epoch,
    seq: meta.seq,
    cmd: commandBody(cmd, true),
  };
}

function commandBody(cmd: ControlCommand, legacyJoy = false): Record<string, unknown> {
  if (cmd.type === 'joy') {
    const body: Record<string, unknown> = { type: 'joy', a: cmd.a, b: cmd.b };
    if (legacyJoy) {
      body.axes = cmd.a;
      body.buttons = cmd.b;
    }
    return body;
  }
  return { ...cmd };
}

export function payloadHasToken(payload: Record<string, unknown>): boolean {
  return typeof payload.token === 'string' && payload.token.length > 0;
}

export function shouldFastPoll(input: { myStatus?: string | null; incoming: number }): boolean {
  return input.myStatus === 'pending' || input.incoming > 0;
}
