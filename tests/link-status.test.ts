import { describe, expect, it } from 'vitest';
import { HEARTBEAT_OFFLINE_MS } from '@/lib/telemetry/protocol';
import {
  CONNECT_GIVE_UP_MS,
  LAST_SEEN_FRESH_MS,
  LINK_LABEL,
  deriveLinkStatus,
  isPrivateControlEnabled,
  parseLastSeenAt,
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
    heartbeatTs: null,
    telemetryTs: null,
    ...over,
  };
}

describe('deriveLinkStatus', () => {
  it('stays connecting until the channel and the bot row have answered', () => {
    const link = deriveLinkStatus(input());
    expect(link.phase).toBe('connecting');
    expect(link.label).toBe('Connecting');
    expect(link.showLag).toBe(false);
    expect(link.mapPlaceholder).toBe('Connecting…');
    expect(link.label).not.toMatch(/lag|ms/i);
  });

  it('shows bot online with no data when last_seen is fresh and telemetry has not arrived', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 4_000,
    }));
    expect(link.phase).toBe('idle');
    expect(link.label).toBe('Bot online, no data yet');
    expect(link.mapPlaceholder).toBe(LINK_LABEL.idle);
    expect(link.showLag).toBe(false);
    expect(link.offlineDetail).toBeNull();
  });

  it('treats a fresh channel heartbeat with no telemetry as online, no data', () => {
    const link = deriveLinkStatus(input({
      heartbeatTs: NOW - 500,
      subscribedAt: NOW - 1_000,
    }));
    expect(link.phase).toBe('idle');
    expect(link.showLag).toBe(false);
  });

  it('shows live with lag once telemetry is flowing', () => {
    const link = deriveLinkStatus(input({
      telemetryTs: NOW - 100,
      lastSeenAtMs: NOW - 20_000,
      lastSeenReadable: true,
      lastSeenSettled: true,
    }));
    expect(link.phase).toBe('live');
    expect(link.label).toBe('Live');
    expect(link.showLag).toBe(true);
    expect(link.mapPlaceholder).toBeNull();
    expect(link.label).not.toMatch(/\d/);
  });

  it('keeps telemetry that is exactly one heartbeat window old', () => {
    expect(deriveLinkStatus(input({ telemetryTs: NOW - HEARTBEAT_OFFLINE_MS })).phase).toBe('live');
    expect(deriveLinkStatus(input({
      telemetryTs: NOW - HEARTBEAT_OFFLINE_MS - 1,
      lastSeenSettled: true,
      lastSeenReadable: true,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    })).phase).toBe('offline');
  });

  it('uses a longer window for last_seen than for channel heartbeats', () => {
    expect(LAST_SEEN_FRESH_MS).toBeGreaterThan(HEARTBEAT_OFFLINE_MS);
    const within = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 10_000,
      heartbeatTs: NOW - 10_000,
    }));
    expect(within.phase).toBe('idle');

    expect(deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - LAST_SEEN_FRESH_MS,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    })).phase).toBe('idle');

    expect(deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - LAST_SEEN_FRESH_MS - 1,
      heartbeatTs: NOW - HEARTBEAT_OFFLINE_MS - 1,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    })).phase).toBe('offline');
  });

  it('does not count an unreadable last_seen row (anon / RLS) as a heartbeat', () => {
    const hidden = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: false,
      lastSeenAtMs: NOW,
      startedAt: NOW - CONNECT_GIVE_UP_MS,
    }));
    expect(hidden.phase).toBe('offline');

    const stillWaiting = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: false,
      lastSeenAtMs: NOW,
    }));
    expect(stillWaiting.phase).toBe('connecting');
  });

  it('does not flash offline while a stale row is known but the channel is still joining', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 60_000,
      startedAt: NOW - 1_000,
    }));
    expect(link.phase).toBe('connecting');
  });

  it('goes offline once the channel has been quiet and last_seen is stale', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 60_000,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
      heartbeatTs: NOW - 10_000,
    }));
    expect(link.phase).toBe('offline');
    expect(link.label).toBe('Offline');
    expect(link.showLag).toBe(false);
    expect(link.offlineDetail).toBe(
      'No fresh heartbeat from the Pi bridge, and no telemetry is arriving.',
    );
    expect(link.offlineDetail).not.toMatch(/\d/);
  });

  it('stays connecting just inside the post-subscribe quiet window', () => {
    const link = deriveLinkStatus(input({
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 60_000,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS + 1,
    }));
    expect(link.phase).toBe('connecting');
  });

  it('gives up when neither source ever answers', () => {
    const link = deriveLinkStatus(input({ startedAt: NOW - CONNECT_GIVE_UP_MS }));
    expect(link.phase).toBe('offline');
  });

  it('lets a fresh last_seen win even after the give-up window', () => {
    const link = deriveLinkStatus(input({
      startedAt: NOW - CONNECT_GIVE_UP_MS - 1,
      channelFailed: true,
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 1_000,
    }));
    expect(link.phase).toBe('idle');
  });

  it('prefers a fresh channel heartbeat over a stale last_seen', () => {
    const link = deriveLinkStatus(input({
      heartbeatTs: NOW - 200,
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 60_000,
      subscribedAt: NOW - 5_000,
    }));
    expect(link.phase).toBe('idle');
  });

  it('drops a heartbeat dated more than a few seconds in the future', () => {
    const link = deriveLinkStatus(input({
      heartbeatTs: NOW + 6_000,
      lastSeenSettled: true,
      lastSeenReadable: true,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    }));
    expect(link.phase).toBe('offline');
    expect(deriveLinkStatus(input({ heartbeatTs: NOW + 4_000 })).phase).toBe('idle');
  });

  it('falls back to idle when telemetry stops but the bridge heartbeat is still fresh', () => {
    const link = deriveLinkStatus(input({
      telemetryTs: NOW - HEARTBEAT_OFFLINE_MS - 1,
      lastSeenSettled: true,
      lastSeenReadable: true,
      lastSeenAtMs: NOW - 2_000,
    }));
    expect(link.phase).toBe('idle');
  });
});

describe('last_seen parsing and private-control flag', () => {
  it('parses timestamptz and rejects empty values', () => {
    expect(parseLastSeenAt(null)).toBeNull();
    expect(parseLastSeenAt('')).toBeNull();
    expect(parseLastSeenAt('not-a-date')).toBeNull();
    expect(parseLastSeenAt('2026-10-16T12:00:00.000Z')).toBe(Date.parse('2026-10-16T12:00:00.000Z'));
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
