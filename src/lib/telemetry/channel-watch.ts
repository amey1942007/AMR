/**
 * Join bookkeeping for /control Realtime channels.
 *
 * `removeChannel` delivers CLOSED on the channel that was just torn down.
 * Treating that callback like a real drop set channelFailed / realtimeDown and
 * scheduled another resubscribe, which tore the replacement channel down too.
 * A status is applied only for an id that is still in `live` at the generation
 * it was opened with. Ids are moved to `retired` before `removeChannel`.
 */

export const SIDE_CHANNEL_NOTE = 'Private channel unavailable';
/** Wait past the client’s own recover-after-error (~1s) before tearing a channel down. */
export const LINK_RETRY_BASE_MS = 2_500;

/**
 * A public join can report CHANNEL_ERROR and then SUBSCRIBED on its own.
 * Arming a retry on the error and leaving it armed destroys that recovery.
 * SUBSCRIBED cancels the timer. A later real failure may arm it again.
 */
export function linkRetryAction(status: string): 'arm' | 'cancel' | 'none' {
  if (status === 'SUBSCRIBED') return 'cancel';
  if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' || status === 'CLOSED') return 'arm';
  return 'none';
}

/** Short status line for the Error sign. Tokens are redacted. */
export function formatChannelDetail(status: string, err?: { message?: string } | null): string {
  const message = (err?.message ?? '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/eyJ[A-Za-z0-9._-]+/g, '[jwt]')
    .replace(/sb_(?:publishable|secret)_[A-Za-z0-9_-]+/g, '[key]');
  const short = message.length > 72 ? `${message.slice(0, 69)}…` : message;
  return short ? `${status}: ${short}` : status;
}

const DOWN = new Set(['CHANNEL_ERROR', 'TIMED_OUT', 'CLOSED']);

export interface ChannelMembership {
  /** Bumped when every listen channel is replaced. */
  generation: number;
  /** Ids opened for the current generation and not yet removed. */
  live: ReadonlySet<number>;
  /** Ids passed to removeChannel on purpose. Their later status is ignored. */
  retired: ReadonlySet<number>;
}

export function emptyChannelMembership(): ChannelMembership {
  return { generation: 0, live: new Set(), retired: new Set() };
}

export function openChannel(membership: ChannelMembership, id: number): ChannelMembership {
  const live = new Set(membership.live);
  live.add(id);
  return { generation: membership.generation, live, retired: membership.retired };
}

/**
 * Call before `removeChannel`. `bump` (default) starts a new generation so a
 * callback that captured the old one cannot land on the replacement channels.
 * A single side-channel retry passes `bump: false` so the link channel stays current.
 */
export function retireChannels(
  membership: ChannelMembership,
  ids: readonly number[],
  bump = true,
): ChannelMembership {
  const retired = new Set(membership.retired);
  const live = new Set(membership.live);
  for (const id of ids) {
    retired.add(id);
    live.delete(id);
  }
  return {
    generation: bump ? membership.generation + 1 : membership.generation,
    live,
    retired,
  };
}

export interface ChannelStatusInput {
  id: number;
  /** Generation captured when this channel was opened. */
  generation: number;
  /** Public topic, or private `bot:<id>:status`. ctl / notify are not the link. */
  carriesLink: boolean;
  status: string;
}

export interface ChannelStatusEffect {
  /** Callback belongs to a removed channel or an older generation. Apply nothing. */
  ignore: boolean;
  /** True when the id was marked retired before removeChannel. */
  intentionalClose: boolean;
  /** `null` leaves the flag unchanged. */
  channelFailed: boolean | null;
  /** `null` leaves the flag unchanged. */
  realtimeDown: boolean | null;
  /** `undefined` leaves the note unchanged. `null` clears it. */
  note: string | null | undefined;
  /** Rebuild listen channels. Never set for a retired channel's CLOSED. */
  resubscribe: boolean;
}

const UNCHANGED: ChannelStatusEffect = {
  ignore: false,
  intentionalClose: false,
  channelFailed: null,
  realtimeDown: null,
  note: undefined,
  resubscribe: false,
};

export function interpretChannelStatus(
  membership: ChannelMembership,
  event: ChannelStatusInput,
): ChannelStatusEffect {
  const retired = membership.retired.has(event.id);
  const stale = retired || !membership.live.has(event.id) || event.generation !== membership.generation;
  if (stale) {
    return {
      ignore: true,
      intentionalClose: retired,
      channelFailed: null,
      realtimeDown: null,
      note: undefined,
      resubscribe: false,
    };
  }
  if (event.status === 'SUBSCRIBED') {
    if (event.carriesLink) {
      return {
        ignore: false,
        intentionalClose: false,
        channelFailed: false,
        realtimeDown: false,
        note: undefined,
        resubscribe: false,
      };
    }
    return {
      ignore: false,
      intentionalClose: false,
      channelFailed: null,
      realtimeDown: null,
      note: null,
      resubscribe: false,
    };
  }
  if (DOWN.has(event.status)) {
    if (!event.carriesLink) {
      return {
        ignore: false,
        intentionalClose: false,
        channelFailed: null,
        realtimeDown: null,
        note: SIDE_CHANNEL_NOTE,
        resubscribe: false,
      };
    }
    return {
      ignore: false,
      intentionalClose: false,
      channelFailed: true,
      realtimeDown: true,
      note: undefined,
      resubscribe: true,
    };
  }
  return UNCHANGED;
}

/** Token refresh events that must push the operator access token into Realtime. */
export function authEventRefreshesRealtime(event: string): boolean {
  return event === 'TOKEN_REFRESHED' || event === 'SIGNED_IN';
}

/**
 * Token placed on the listen socket before `channel.subscribe`.
 * Public `amr-bot-*` gets the publishable key. The operator access token is only
 * for private topics. A cold join that snapshots `accessTokenValue` before this
 * runs is sent with no token; the 10s phoenix timer then fires `TIMED_OUT`.
 */
export function listenAccessToken(
  privateControl: boolean,
  publishableKey: string,
  operatorToken: string | null,
): string | null {
  if (!privateControl) return publishableKey || null;
  return operatorToken;
}

/**
 * `channel.subscribe` starts the 10s join timer even when the frame is only
 * buffered. Wait until the previous topic is gone (so `channel()` cannot reuse
 * a channel whose `subscribe` is a no-op) and the socket is already open.
 */
export function readyToJoin(previousRemovalSettled: boolean, socketOpen: boolean): boolean {
  return previousRemovalSettled && socketOpen;
}

/** Poll `pred` until it is true or `timeoutMs` has elapsed. */
export async function waitUntil(
  pred: () => boolean,
  timeoutMs: number,
  now: () => number,
  sleep: (ms: number) => Promise<void>,
): Promise<boolean> {
  const start = now();
  while (!pred()) {
    if (now() - start >= timeoutMs) return false;
    await sleep(25);
  }
  return true;
}
