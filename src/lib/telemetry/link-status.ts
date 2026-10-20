import { HEARTBEAT_OFFLINE_MS } from './protocol';

/**
 * /control link phase.
 *
 * Broadcast freshness uses the browser's receipt time, not the Pi stamp, so a
 * skewed robot clock cannot keep the panel on Connecting or mark it live.
 * `amr_bots.last_seen_at` counts as fresh only after the value changes, and
 * only for 15s of local time after that change (the bridge touches the row
 * about every 5s). The first read is not a change.
 *
 * Anon cannot SELECT `amr_bots` (RLS is `authenticated` only). A failed read
 * is not a heartbeat. `NEXT_PUBLIC_PRIVATE_CONTROL` is on in the Pages build (`"1"`).
 */

/** Bridge `_presence_touch_loop` waits 5s between `touch_amr_bot` calls. */
export const BRIDGE_TOUCH_INTERVAL_MS = 5_000;
/** Three touch intervals: one delayed write still counts as up. */
export const LAST_SEEN_FRESH_MS = BRIDGE_TOUCH_INTERVAL_MS * 3;
/** Stop saying "Connecting" if neither the channel nor the row ever answers. */
export const CONNECT_GIVE_UP_MS = 8_000;
/** Steady poll of `amr_bots.last_seen_at`. */
export const POLL_OK_MS = 3_000;
/** After repeated read failures, wait this long before trying again. */
export const POLL_BACKOFF_MS = 12_000;
/** Keep the last good row through a single blip; the next failure is unreadable. */
export const POLL_FAILURES_BEFORE_UNREADABLE = 2;

export type LinkPhase = 'connecting' | 'idle' | 'live' | 'offline';

export interface LinkStatusInput {
  now: number;
  /** When this bot's watch started (reset on bot change). */
  startedAt: number;
  /** When the public channel last reached SUBSCRIBED; null if it has not. */
  subscribedAt: number | null;
  /** Subscribe ended in error, timeout, or an unexpected close. */
  channelFailed: boolean;
  /** The `amr_bots` read finished (row or error). */
  lastSeenSettled: boolean;
  /** False when RLS / anon / repeated errors rejected the read. */
  lastSeenReadable: boolean;
  /** Server timestamp from the last good row. Display only — not used for freshness. */
  lastSeenAtMs: number | null;
  /** Local time the last_seen value last changed. Null until a second, different sample. */
  lastSeenChangedAt: number | null;
  /** Local time the latest `hb` broadcast was received. */
  heartbeatReceivedAt: number | null;
  /** Local time the latest telemetry broadcast was received. */
  telemetryReceivedAt: number | null;
}

export interface LinkStatusView {
  phase: LinkPhase;
  /** Stable phrase. Must not include lag or a clock — it sits in an aria-live region. */
  label: string;
  /** Canvas copy when there is no pose. Null while telemetry is on screen. */
  mapPlaceholder: string | null;
  showLag: boolean;
  offlineDetail: string | null;
  /** The bot row could not be read, so this is not a normal offline robot. */
  unreadable: boolean;
  lastSeenAtMs: number | null;
}

export const LINK_LABEL: Record<LinkPhase, string> = {
  connecting: 'Connecting',
  idle: 'Online · waiting for data',
  live: 'Live',
  offline: 'Offline',
};

export const MAP_WAITING = 'Waiting for robot…';
export const MAP_IDLE = 'Robot is online. Waiting for its first map update…';

export const OFFLINE_DETAIL =
  "We haven't heard from the robot recently. Check that it is powered on and connected.";

export const UNREADABLE_STATUS = "Can't read bot status";

export function isPrivateControlEnabled(flag: string | undefined): boolean {
  return flag === '1';
}

export function parseLastSeenAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

/** `receivedAt` is local time (receipt or observed change), never a remote clock. */
export function isSignalFresh(
  receivedAt: number | null | undefined,
  now: number,
  windowMs: number,
): boolean {
  if (
    receivedAt == null
    || !Number.isFinite(receivedAt)
    || !Number.isFinite(now)
    || !Number.isFinite(windowMs)
  ) {
    return false;
  }
  const age = now - receivedAt;
  if (age < 0) return false;
  return age <= windowMs;
}

export function formatLastSeenAgo(atMs: number, now: number): string {
  const age = Math.max(0, now - atMs);
  if (age < 60_000) return 'just now';
  const min = Math.floor(age / 60_000);
  if (min < 60) return `${min} min ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return hr === 1 ? '1 hr ago' : `${hr} hr ago`;
  const day = Math.floor(hr / 24);
  return day === 1 ? '1 day ago' : `${day} days ago`;
}

/** Designer offline copy, plus a relative last-seen phrase when a row timestamp exists. */
export function offlineMessage(detail: string, lastSeenAtMs: number | null, now: number): string {
  if (lastSeenAtMs == null || !Number.isFinite(lastSeenAtMs)) return detail;
  return `${detail} · last seen ${formatLastSeenAgo(lastSeenAtMs, now)}`;
}

/**
 * First sample is stored and does not count as a change (an old row must not
 * look freshly touched). A later different value stamps local time.
 */
export function observeLastSeen(
  previousRaw: string | null | undefined,
  previousChangedAt: number | null,
  nextRaw: string | null,
  now: number,
): { raw: string | null; changedAt: number | null } {
  if (previousRaw === undefined) return { raw: nextRaw, changedAt: null };
  if (nextRaw == null) return { raw: null, changedAt: null };
  if (nextRaw !== previousRaw) return { raw: nextRaw, changedAt: now };
  return { raw: nextRaw, changedAt: previousChangedAt };
}

export interface LastSeenSample {
  /** `undefined` until the first successful read. `null` is an empty column. */
  raw: string | null | undefined;
  changedAt: number | null;
  at: number | null;
  failures: number;
  settled: boolean;
  readable: boolean;
}

export const LAST_SEEN_SAMPLE: LastSeenSample = {
  raw: undefined,
  changedAt: null,
  at: null,
  failures: 0,
  settled: false,
  readable: false,
};

export function noteLastSeenRead(prev: LastSeenSample, raw: string | null, now: number): LastSeenSample {
  const observed = observeLastSeen(prev.raw, prev.changedAt, raw, now);
  return {
    raw: observed.raw,
    changedAt: observed.changedAt,
    at: parseLastSeenAt(raw),
    failures: 0,
    settled: true,
    readable: true,
  };
}

/** Keeps the last good timestamp. Readable stays true until the second consecutive failure. */
export function noteLastSeenFailure(prev: LastSeenSample): LastSeenSample {
  const failures = prev.failures + 1;
  return {
    ...prev,
    failures,
    settled: true,
    readable: failures < POLL_FAILURES_BEFORE_UNREADABLE,
  };
}

export function nextPollDelay(consecutiveFailures: number): number {
  return consecutiveFailures >= POLL_FAILURES_BEFORE_UNREADABLE ? POLL_BACKOFF_MS : POLL_OK_MS;
}

export interface ChannelWatch {
  subscribedAt: number | null;
  channelFailed: boolean;
}

/** Each SUBSCRIBED (including reconnect) restarts the quiet window. */
export function reduceChannelStatus(state: ChannelWatch, status: string, now: number): ChannelWatch {
  if (status === 'SUBSCRIBED') return { subscribedAt: now, channelFailed: false };
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') {
    return { subscribedAt: null, channelFailed: true };
  }
  return state;
}

function view(
  phase: LinkPhase,
  extra: Omit<LinkStatusView, 'phase' | 'label'> & { label?: string },
): LinkStatusView {
  const { label, ...rest } = extra;
  return { phase, label: label ?? LINK_LABEL[phase], ...rest };
}

const emptySeen = { unreadable: false, lastSeenAtMs: null as number | null };

export function offlineLink(): LinkStatusView {
  return view('offline', {
    mapPlaceholder: null,
    showLag: false,
    offlineDetail: OFFLINE_DETAIL,
    ...emptySeen,
  });
}

/** Session or client still coming up — not a claim that the robot is down. */
export function connectingLink(): LinkStatusView {
  return view('connecting', {
    mapPlaceholder: MAP_WAITING,
    showLag: false,
    offlineDetail: null,
    ...emptySeen,
  });
}

/**
 * connecting — still waiting to hear from the channel and the bot row.
 * idle — a local heartbeat or a changed last_seen is fresh, but no telemetry is.
 * live — telemetry is flowing (lag is shown beside this, not inside the label).
 * offline — both signals had a chance and are stale.
 */
export function deriveLinkStatus(input: LinkStatusInput): LinkStatusView {
  const hbFresh = isSignalFresh(input.heartbeatReceivedAt, input.now, HEARTBEAT_OFFLINE_MS);
  const seenFresh = input.lastSeenReadable
    && isSignalFresh(input.lastSeenChangedAt, input.now, LAST_SEEN_FRESH_MS);
  const telFresh = isSignalFresh(input.telemetryReceivedAt, input.now, HEARTBEAT_OFFLINE_MS);
  const seen = { unreadable: false, lastSeenAtMs: input.lastSeenAtMs };

  if (telFresh) {
    return view('live', { mapPlaceholder: null, showLag: true, offlineDetail: null, ...seen });
  }
  if (hbFresh || seenFresh) {
    return view('idle', { mapPlaceholder: MAP_IDLE, showLag: false, offlineDetail: null, ...seen });
  }

  const channelQuiet = input.channelFailed
    || (input.subscribedAt != null && input.now - input.subscribedAt >= HEARTBEAT_OFFLINE_MS);
  const gaveUp = Number.isFinite(input.startedAt) && input.now - input.startedAt >= CONNECT_GIVE_UP_MS;
  const channelDone = channelQuiet || gaveUp;
  const dbDone = input.lastSeenSettled || gaveUp;
  if (!channelDone || !dbDone) {
    return view('connecting', {
      mapPlaceholder: MAP_WAITING,
      showLag: false,
      offlineDetail: null,
      ...seen,
    });
  }
  if (input.lastSeenSettled && !input.lastSeenReadable) {
    return view('offline', {
      label: UNREADABLE_STATUS,
      mapPlaceholder: null,
      showLag: false,
      offlineDetail: UNREADABLE_STATUS,
      unreadable: true,
      lastSeenAtMs: input.lastSeenAtMs,
    });
  }
  return view('offline', {
    mapPlaceholder: null,
    showLag: false,
    offlineDetail: OFFLINE_DETAIL,
    ...seen,
  });
}
