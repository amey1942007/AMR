import { commandRejectText } from './commands';
import {
  CONNECT_GIVE_UP_MS,
  LAST_SEEN_FRESH_MS,
  UNREADABLE_STATUS,
  isSignalFresh,
  type LinkPhase,
} from './link-status';
import { HEARTBEAT_OFFLINE_MS } from './protocol';

/**
 * Three fault signs for the control panel. Shape and words carry the state.
 * Colour is only a reinforcement.
 *
 * - Connected, no data — the bridge is up (heartbeat or a changed last_seen) and telemetry is not.
 * - Not connected — nothing fresh, and we are not still joining.
 * - Error — the bot is reachable, or the page already has a specific failure, and the reason is short.
 */

export const SIGN_NO_DATA = 'Connected, no data';
export const SIGN_DOWN = 'Not connected';
export const SIGN_ERROR = 'Error';

export type StatusSignId = 'nodata' | 'down' | 'error';

export interface StatusSignFacts {
  now: number;
  phase: LinkPhase;
  startedAt: number;
  subscribedAt: number | null;
  channelFailed: boolean;
  realtimeDown: boolean;
  unreadable: boolean;
  /** Local time the operator RPC heartbeat last succeeded. */
  sessionHeartbeatAt: number | null;
  sessionHeartbeatError: string | null;
  /** Local time the latest bridge `hb` broadcast arrived. */
  bridgeHeartbeatAt: number | null;
  /** Local time the latest telemetry broadcast arrived. */
  telemetryAt: number | null;
  /** Local time `last_seen_at` last changed. */
  lastSeenChangedAt: number | null;
  lastSeenReadable: boolean;
  /** Raw reject code from the last command, already shortened. Null after a success. */
  commandError: string | null;
  /** A telemetry broadcast arrived and could not be read. */
  telemetryUnreadable: boolean;
  /** Last link-channel status, plus the subscribe error message when there is one. */
  channelDetail?: string | null;
}

export interface StatusSignView {
  /** Null while still connecting, or while telemetry is healthy and nothing failed. */
  active: StatusSignId | null;
  /** Visible beside the Error sign. Null unless `active` is `error`. */
  errorReason: string | null;
}

const HEALTHY: StatusSignView = { active: null, errorReason: null };

/** Keep a reject code readable. Known limit errors stay as their short phrases. */
export function shortCommandReason(error: string | null | undefined): string | null {
  if (!error) return null;
  const known = commandRejectText(error);
  const raw = (known ?? error).replace(/\s+/g, ' ').trim();
  if (!raw) return null;
  if (/bearer|service_role|sb_secret|eyJ/i.test(raw)) return 'rejected';
  return raw.length > 48 ? `${raw.slice(0, 45)}…` : raw;
}

function sessionHeartbeatOk(facts: StatusSignFacts): boolean {
  return !facts.sessionHeartbeatError
    && isSignalFresh(facts.sessionHeartbeatAt, facts.now, 10_000);
}

function bridgeFresh(facts: StatusSignFacts): boolean {
  return isSignalFresh(facts.bridgeHeartbeatAt, facts.now, HEARTBEAT_OFFLINE_MS);
}

function telemetryFresh(facts: StatusSignFacts): boolean {
  return isSignalFresh(facts.telemetryAt, facts.now, HEARTBEAT_OFFLINE_MS);
}

function lastSeenFresh(facts: StatusSignFacts): boolean {
  return facts.lastSeenReadable && isSignalFresh(facts.lastSeenChangedAt, facts.now, LAST_SEEN_FRESH_MS);
}

function channelSettled(facts: StatusSignFacts): boolean {
  if (facts.channelFailed) return true;
  if (facts.subscribedAt != null && facts.now - facts.subscribedAt >= HEARTBEAT_OFFLINE_MS) return true;
  return Number.isFinite(facts.startedAt) && facts.now - facts.startedAt >= CONNECT_GIVE_UP_MS;
}

function connected(facts: StatusSignFacts): boolean {
  return facts.phase === 'live' || facts.phase === 'idle' || bridgeFresh(facts) || lastSeenFresh(facts) || telemetryFresh(facts);
}

/** First match wins. Each phrase is stable — no clock, so it can sit next to a status sign. */
export function statusErrorReason(facts: StatusSignFacts): string | null {
  const up = connected(facts);
  if (facts.commandError && (up || facts.phase === 'live')) {
    return `Command rejected: ${facts.commandError}`;
  }
  if (facts.telemetryUnreadable) return 'Telemetry error';
  if (facts.unreadable) return UNREADABLE_STATUS;
  // A fresh bridge frame means the data channel is delivering. A latched
  // CHANNEL_ERROR / CLOSED, or a ctl/notify failure, must not say the status
  // channel is down while telemetry or hb is still arriving.
  if ((facts.channelFailed || facts.realtimeDown) && (up || sessionHeartbeatOk(facts))) {
    if (!telemetryFresh(facts) && !bridgeFresh(facts)) {
      return facts.channelDetail ? `Status channel error: ${facts.channelDetail}` : 'Status channel error';
    }
  }
  if (
    sessionHeartbeatOk(facts)
    && channelSettled(facts)
    && !bridgeFresh(facts)
    && !telemetryFresh(facts)
    && !lastSeenFresh(facts)
  ) {
    return 'Heartbeat ok, broadcasts not arriving';
  }
  return null;
}

export function deriveStatusSigns(facts: StatusSignFacts): StatusSignView {
  const reason = statusErrorReason(facts);
  const up = connected(facts) || sessionHeartbeatOk(facts);
  if (reason && (up || facts.unreadable)) return { active: 'error', errorReason: reason };
  if (facts.phase === 'connecting') return HEALTHY;
  if (facts.phase === 'offline' || !connected(facts)) return { active: 'down', errorReason: null };
  if (!telemetryFresh(facts)) return { active: 'nodata', errorReason: null };
  return HEALTHY;
}
