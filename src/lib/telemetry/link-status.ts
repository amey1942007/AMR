import { HEARTBEAT_OFFLINE_MS } from './protocol';

/**
 * /control link phase.
 *
 * The public `amr-bot-*` channel delivers broadcast `hb` and `telemetry`.
 * The bridge also stamps `amr_bots.last_seen_at` (via `touch_amr_bot`) about
 * every 5s — that write still happens when the base is unpowered and no
 * odometry is published. The page used to ignore the column, so a live bridge
 * with no telemetry frames stayed on "Connecting".
 *
 * Anon cannot SELECT `amr_bots` (RLS is `authenticated` only). A signed-in
 * operator can. A failed read must not be treated as a fresh heartbeat.
 *
 * `NEXT_PUBLIC_PRIVATE_CONTROL` stays off unless it is exactly "1". Private
 * realtime channels need database policies this repo does not add.
 */

/** Bridge `_presence_touch_loop` waits 5s between `touch_amr_bot` calls. */
export const BRIDGE_TOUCH_INTERVAL_MS = 5_000;
/** Three touch intervals: one delayed write plus clock skew still counts as up. */
export const LAST_SEEN_FRESH_MS = BRIDGE_TOUCH_INTERVAL_MS * 3;
/** Stop saying "Connecting" if neither the channel nor the row ever answers. */
export const CONNECT_GIVE_UP_MS = 8_000;
/** Ignore heartbeats dated more than this far in the future (bad clock). */
export const SIGNAL_FUTURE_SKEW_MS = 5_000;

export type LinkPhase = 'connecting' | 'idle' | 'live' | 'offline';

export interface LinkStatusInput {
  now: number;
  /** When this bot's watch started (reset on bot change). */
  startedAt: number;
  /** When the public channel reached SUBSCRIBED; null if it has not. */
  subscribedAt: number | null;
  /** Subscribe ended in error, timeout, or an unexpected close. */
  channelFailed: boolean;
  /** The `amr_bots` read finished (row or error). */
  lastSeenSettled: boolean;
  /** False when RLS / anon rejected the read. A null timestamp is then not proof the bridge is down. */
  lastSeenReadable: boolean;
  lastSeenAtMs: number | null;
  heartbeatTs: number | null;
  telemetryTs: number | null;
}

export interface LinkStatusView {
  phase: LinkPhase;
  /** Stable phrase. Must not include lag or a clock — it sits in an aria-live region. */
  label: string;
  /** Canvas copy when there is no pose. Null while telemetry is on screen. */
  mapPlaceholder: string | null;
  showLag: boolean;
  offlineDetail: string | null;
}

export const LINK_LABEL: Record<LinkPhase, string> = {
  connecting: 'Connecting',
  idle: 'Bot online, no data yet',
  live: 'Live',
  offline: 'Offline',
};

export const OFFLINE_DETAIL =
  'No fresh heartbeat from the Pi bridge, and no telemetry is arriving.';

const CONNECTING_PLACEHOLDER = 'Connecting…';

export function isPrivateControlEnabled(flag: string | undefined): boolean {
  return flag === '1';
}

export function parseLastSeenAt(value: string | null | undefined): number | null {
  if (!value) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? ms : null;
}

export function isSignalFresh(
  ts: number | null | undefined,
  now: number,
  windowMs: number,
): boolean {
  if (ts == null || !Number.isFinite(ts) || !Number.isFinite(now) || !Number.isFinite(windowMs)) {
    return false;
  }
  const age = now - ts;
  if (age < -SIGNAL_FUTURE_SKEW_MS) return false;
  return age <= windowMs;
}

function view(
  phase: LinkPhase,
  extra: Pick<LinkStatusView, 'mapPlaceholder' | 'showLag' | 'offlineDetail'>,
): LinkStatusView {
  return { phase, label: LINK_LABEL[phase], ...extra };
}

export function offlineLink(): LinkStatusView {
  return view('offline', { mapPlaceholder: null, showLag: false, offlineDetail: OFFLINE_DETAIL });
}

/** Session or client still coming up — not a claim that the bridge is down. */
export function connectingLink(): LinkStatusView {
  return view('connecting', {
    mapPlaceholder: CONNECTING_PLACEHOLDER,
    showLag: false,
    offlineDetail: null,
  });
}

/**
 * connecting — still waiting to hear from the channel and the bot row.
 * idle — bridge heartbeat / last_seen is fresh, but no telemetry frame is.
 * live — telemetry is flowing (lag is shown beside this, not inside the label).
 * offline — both signals had a chance and are stale.
 */
export function deriveLinkStatus(input: LinkStatusInput): LinkStatusView {
  const hbFresh = isSignalFresh(input.heartbeatTs, input.now, HEARTBEAT_OFFLINE_MS);
  const seenFresh = input.lastSeenReadable
    && isSignalFresh(input.lastSeenAtMs, input.now, LAST_SEEN_FRESH_MS);
  const telFresh = isSignalFresh(input.telemetryTs, input.now, HEARTBEAT_OFFLINE_MS);

  if (telFresh) {
    return view('live', { mapPlaceholder: null, showLag: true, offlineDetail: null });
  }
  if (hbFresh || seenFresh) {
    return view('idle', {
      mapPlaceholder: LINK_LABEL.idle,
      showLag: false,
      offlineDetail: null,
    });
  }

  const channelQuiet = input.channelFailed
    || (input.subscribedAt != null && input.now - input.subscribedAt >= HEARTBEAT_OFFLINE_MS);
  const gaveUp = Number.isFinite(input.startedAt) && input.now - input.startedAt >= CONNECT_GIVE_UP_MS;
  const channelDone = channelQuiet || gaveUp;
  const dbDone = input.lastSeenSettled || gaveUp;
  if (!channelDone || !dbDone) {
    return view('connecting', {
      mapPlaceholder: CONNECTING_PLACEHOLDER,
      showLag: false,
      offlineDetail: null,
    });
  }
  return offlineLink();
}
