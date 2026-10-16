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

/**
 * `seq` is a millisecond timestamp, then +1 for later commands in that epoch.
 * A reloaded page starts at the current clock, so it cannot go backwards
 * against rows already stored for this epoch.
 */
export function createSeqCounter(now: () => number = Date.now): SeqCounter {
  let epoch = Number.NaN;
  let seq = 0;
  return {
    next(nextEpoch: number) {
      if (!Number.isFinite(nextEpoch)) throw new Error('epoch required');
      const tick = Math.floor(now());
      const base = Number.isFinite(tick) && tick > 0 ? tick : 0;
      if (nextEpoch !== epoch) {
        epoch = nextEpoch;
        seq = base;
        return seq;
      }
      seq = Math.max(seq + 1, base);
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

/** Payload for the private `bot:<id>:cmd` topic. Includes the token. Joy carries both `{a,b}` and `{axes,buttons}`. */
export function privateCmdPayload(cmd: ControlCommand, meta: WireMeta): Record<string, unknown> {
  return { epoch: meta.epoch, token: meta.token, seq: meta.seq, ts: meta.ts, ...commandBody(cmd, true) };
}

/** Lease RPCs set `lease_expires_at` to server now + 15s. */
export const LEASE_MS = 15_000;

/** Milliseconds to add to `Date.now()` so command timestamps match server time. Null when the lease time is unusable. */
export function serverOffsetFromLease(leaseExpiresAt: string | null | undefined, receivedAt: number): number | null {
  if (!leaseExpiresAt) return null;
  const lease = Date.parse(leaseExpiresAt);
  if (!Number.isFinite(lease)) return null;
  return lease - LEASE_MS - receivedAt;
}

export function alignedNow(localNow: number, offsetMs: number | null | undefined): number {
  return localNow + (offsetMs ?? 0);
}

export type PrivateCommandRoute = 'cmd' | 'estop-rpc' | 'blocked';

/**
 * Realtime has no message partitions, so a database push on `:cmdq` is dropped.
 * Every command type is a client broadcast on `bot:<id>:cmd` while that channel
 * is SUBSCRIBED. `send_command` is only the E-STOP fallback when it is not.
 */
export function privateCommandRoute(type: string, cmdSubscribed: boolean): PrivateCommandRoute {
  if (cmdSubscribed) return 'cmd';
  if (type === 'estop') return 'estop-rpc';
  return 'blocked';
}

/** E-STOP uses `send_command` only while `bot:<id>:cmd` is not SUBSCRIBED. */
export function estopUsesRpc(input: { cmdSubscribed: boolean }): boolean {
  return privateCommandRoute('estop', input.cmdSubscribed) === 'estop-rpc';
}

/** Visible copy when `send_command` raises one of the limit errors. Other messages stay as returned. */
export function commandRejectText(message: string | null | undefined): string | null {
  if (!message) return null;
  if (/rate limited/i.test(message)) return 'rate limited';
  if (/command too large/i.test(message)) return 'command too large';
  return null;
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
