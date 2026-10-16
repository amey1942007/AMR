import { describe, expect, it } from 'vitest';
import { HEARTBEAT_OFFLINE_MS } from '@/lib/telemetry/protocol';
import {
  CONNECT_GIVE_UP_MS,
  LAST_SEEN_FRESH_MS,
  LAST_SEEN_SAMPLE,
  LINK_LABEL,
  MAP_IDLE,
  MAP_WAITING,
  OFFLINE_DETAIL,
  POLL_BACKOFF_MS,
  POLL_OK_MS,
  UNREADABLE_STATUS,
  deriveLinkStatus,
  formatLastSeenAgo,
  isPrivateControlEnabled,
  isSignalFresh,
  nextPollDelay,
  noteLastSeenFailure,
  noteLastSeenRead,
  observeLastSeen,
  offlineMessage,
  parseLastSeenAt,
  reduceChannelStatus,
  type LinkStatusInput,
} from '@/lib/telemetry/link-status';

const NOW = 1_000_000;

function input(over: Partial<LinkStatusInput> = {}): LinkStatusInput {
  return {
    now: NOW,
    startedAt: NOW,
    subscribedAt: null,
    channelFailed: false,
    lastSeenSettled: false,
    lastSeenReadable: false,
    lastSeenAtMs: null,
    lastSeenChangedAt: null,
    heartbeatReceivedAt: null,
    telemetryReceivedAt: null,
    ...over,
  };
}

describe('deriveLinkStatus', () => {
  it('stays connecting until the channel and the bot row have answered', () => {
    const link = deriveLinkStatus(input());
    expect(link.phase).toBe('connecting');
    expect(link.label).toBe('Connecting');
    expect(link.showLag).toBe(false);
    expect(link.mapPlaceholder).toBe(MAP_WAITING);
    expect(link.label).not.toMatch(/lag|ms/i);
  });

  it('shows online with no data when last_seen changed recently and telemetry has not arrived', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 60_000,
      lastSeenChangedAt: NOW - 4_000,
    }));
    expect(link.phase).toBe('idle');
    expect(link.label).toBe('Online · waiting for data');
    expect(link.mapPlaceholder).toBe(MAP_IDLE);
    expect(link.showLag).toBe(false);
    expect(link.offlineDetail).toBeNull();
  });

  it('does not treat the first last_seen sample as fresh when its clock matches local time', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW,
      lastSeenChangedAt: null,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    }));
    expect(link.phase).toBe('offline');
  });

  it('treats a freshly received channel heartbeat with no telemetry as online, no data', () => {
    const link = deriveLinkStatus(input({
      heartbeatReceivedAt: NOW - 500,
      subscribedAt: NOW - 1_000,
    }));
    expect(link.phase).toBe('idle');
    expect(link.showLag).toBe(false);
  });

  it('shows live with lag once telemetry has been received', () => {
    const link = deriveLinkStatus(input({
      telemetryReceivedAt: NOW - 100,
      lastSeenChangedAt: NOW - 20_000,
      lastSeenReadable: true,
      lastSeenSettled: true,
    }));
    expect(link.phase).toBe('live');
    expect(link.label).toBe('Live');
    expect(link.showLag).toBe(true);
    expect(link.mapPlaceholder).toBeNull();
    expect(link.label).not.toMatch(/\d/);
  });

  it('keeps telemetry that was received exactly one heartbeat window ago', () => {
    expect(deriveLinkStatus(input({ telemetryReceivedAt: NOW - HEARTBEAT_OFFLINE_MS })).phase).toBe('live');
    expect(deriveLinkStatus(input({
      telemetryReceivedAt: NOW - HEARTBEAT_OFFLINE_MS - 1,
      lastSeenSettled: true,
      lastSeenReadable: true,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    })).phase).toBe('offline');
  });

  it('uses a longer window for a changed last_seen than for channel heartbeats', () => {
    expect(LAST_SEEN_FRESH_MS).toBeGreaterThan(HEARTBEAT_OFFLINE_MS);
    const within = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 10_000,
      heartbeatReceivedAt: NOW - 10_000,
    }));
    expect(within.phase).toBe('idle');

    expect(deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - LAST_SEEN_FRESH_MS,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    })).phase).toBe('idle');

    expect(deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - LAST_SEEN_FRESH_MS - 1,
      heartbeatReceivedAt: NOW - HEARTBEAT_OFFLINE_MS - 1,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    })).phase).toBe('offline');
  });

  it('says the bot status cannot be read when the row stays unreadable', () => {
    const hidden = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: false,
      lastSeenAtMs: NOW,
      lastSeenChangedAt: NOW,
      startedAt: NOW - CONNECT_GIVE_UP_MS,
    }));
    expect(hidden.phase).toBe('offline');
    expect(hidden.unreadable).toBe(true);
    expect(hidden.label).toBe(UNREADABLE_STATUS);
    expect(hidden.offlineDetail).toBe(UNREADABLE_STATUS);

    const stillWaiting = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: false,
      lastSeenChangedAt: NOW,
    }));
    expect(stillWaiting.phase).toBe('connecting');
  });

  it('does not flash offline while a stale row is known but the channel is still joining', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 60_000,
      startedAt: NOW - 1_000,
    }));
    expect(link.phase).toBe('connecting');
  });

  it('goes offline once the channel has been quiet and last_seen has not changed', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 2 * 60_000,
      lastSeenChangedAt: NOW - 60_000,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
      heartbeatReceivedAt: NOW - 10_000,
    }));
    expect(link.phase).toBe('offline');
    expect(link.label).toBe('Offline');
    expect(link.showLag).toBe(false);
    expect(link.offlineDetail).toBe(OFFLINE_DETAIL);
    expect(link.offlineDetail).not.toMatch(/Pi bridge|heartbeat/i);
    expect(offlineMessage(link.offlineDetail ?? '', link.lastSeenAtMs, NOW)).toBe(
      `${OFFLINE_DETAIL} · last seen 2 min ago`,
    );
  });

  it('stays connecting just inside the post-subscribe quiet window', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 60_000,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS + 1,
    }));
    expect(link.phase).toBe('connecting');
  });

  it('gives up when neither source ever answers', () => {
    const link = deriveLinkStatus(input({ startedAt: NOW - CONNECT_GIVE_UP_MS }));
    expect(link.phase).toBe('offline');
    expect(link.unreadable).toBe(false);
  });

  it('lets a recently changed last_seen win even after the give-up window', () => {
    const link = deriveLinkStatus(input({
      startedAt: NOW - CONNECT_GIVE_UP_MS - 1,
      channelFailed: true,
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 1_000,
    }));
    expect(link.phase).toBe('idle');
  });

  it('prefers a fresh channel heartbeat over a stale last_seen', () => {
    const link = deriveLinkStatus(input({
      heartbeatReceivedAt: NOW - 200,
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 60_000,
      subscribedAt: NOW - 5_000,
    }));
    expect(link.phase).toBe('idle');
  });

  it('ignores a receipt time in the future instead of treating clock skew as fresh', () => {
    const link = deriveLinkStatus(input({
      heartbeatReceivedAt: NOW + 6_000,
      lastSeenSettled: true,
      lastSeenReadable: true,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    }));
    expect(link.phase).toBe('offline');
    expect(deriveLinkStatus(input({ heartbeatReceivedAt: NOW + 4_000 })).phase).toBe('connecting');
  });

  it('falls back to idle when telemetry stops but last_seen is still changing', () => {
    const link = deriveLinkStatus(input({
      telemetryReceivedAt: NOW - HEARTBEAT_OFFLINE_MS - 1,
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 2_000,
    }));
    expect(link.phase).toBe('idle');
    expect(LINK_LABEL.idle).not.toBe(LINK_LABEL.live);
  });
});

describe('last_seen polling and channel reconnect', () => {
  it('parses timestamptz and rejects empty values', () => {
    expect(parseLastSeenAt(null)).toBeNull();
    expect(parseLastSeenAt('')).toBeNull();
    expect(parseLastSeenAt('not-a-date')).toBeNull();
    expect(parseLastSeenAt('2026-10-16T12:00:00.000Z')).toBe(Date.parse('2026-10-16T12:00:00.000Z'));
  });

  it('stamps a local change only when the row value actually changes', () => {
    const first = observeLastSeen(undefined, null, '2026-10-16T12:00:00.000Z', NOW);
    expect(first.changedAt).toBeNull();
    const same = observeLastSeen(first.raw, first.changedAt, '2026-10-16T12:00:00.000Z', NOW + 3_000);
    expect(same.changedAt).toBeNull();
    const next = observeLastSeen(same.raw, same.changedAt, '2026-10-16T12:00:05.000Z', NOW + 5_000);
    expect(next.changedAt).toBe(NOW + 5_000);
    expect(isSignalFresh(next.changedAt, NOW + 5_000, LAST_SEEN_FRESH_MS)).toBe(true);
  });

  it('keeps the last good row through one failure and backs off after the second', () => {
    const read = noteLastSeenRead(LAST_SEEN_SAMPLE, '2026-10-16T12:00:05.000Z', NOW);
    const once = noteLastSeenFailure(read);
    expect(once.readable).toBe(true);
    expect(once.at).toBe(read.at);
    expect(once.raw).toBe(read.raw);
    expect(nextPollDelay(once.failures)).toBe(POLL_OK_MS);

    const twice = noteLastSeenFailure(once);
    expect(twice.readable).toBe(false);
    expect(twice.at).toBe(read.at);
    expect(nextPollDelay(twice.failures)).toBe(POLL_BACKOFF_MS);
    expect(POLL_BACKOFF_MS).toBeGreaterThanOrEqual(10_000);
    expect(POLL_BACKOFF_MS).toBeLessThanOrEqual(15_000);

    const recovered = noteLastSeenRead(twice, '2026-10-16T12:00:10.000Z', NOW + 12_000);
    expect(recovered.readable).toBe(true);
    expect(recovered.failures).toBe(0);
    expect(recovered.changedAt).toBe(NOW + 12_000);
    expect(nextPollDelay(recovered.failures)).toBe(POLL_OK_MS);
  });

  it('resets the subscribe clock when the channel joins again', () => {
    let watch = reduceChannelStatus({ subscribedAt: null, channelFailed: false }, 'SUBSCRIBED', 1_000);
    expect(watch).toEqual({ subscribedAt: 1_000, channelFailed: false });
    watch = reduceChannelStatus(watch, 'CLOSED', 4_000);
    expect(watch).toEqual({ subscribedAt: null, channelFailed: true });
    watch = reduceChannelStatus(watch, 'SUBSCRIBED', 6_000);
    expect(watch).toEqual({ subscribedAt: 6_000, channelFailed: false });
    expect(reduceChannelStatus(watch, 'JOINING', 7_000)).toBe(watch);
  });

  it('formats last seen without a per-second phrase', () => {
    expect(formatLastSeenAgo(NOW - 30_000, NOW)).toBe('just now');
    expect(formatLastSeenAgo(NOW - 2 * 60_000, NOW)).toBe('2 min ago');
    expect(formatLastSeenAgo(NOW - 60 * 60_000, NOW)).toBe('1 hr ago');
    expect(offlineMessage(OFFLINE_DETAIL, null, NOW)).toBe(OFFLINE_DETAIL);
    expect(MAP_WAITING).toBe('Waiting for robot…');
  });

  it('keeps private control off unless the flag is exactly 1', () => {
    expect(isPrivateControlEnabled(undefined)).toBe(false);
    expect(isPrivateControlEnabled('')).toBe(false);
    expect(isPrivateControlEnabled('0')).toBe(false);
    expect(isPrivateControlEnabled('false')).toBe(false);
    expect(isPrivateControlEnabled('true')).toBe(false);
    expect(isPrivateControlEnabled('1')).toBe(true);
  });
});
