import { describe, expect, it } from 'vitest';
import { HEARTBEAT_OFFLINE_MS } from '@/lib/telemetry/protocol';
import { CONNECT_GIVE_UP_MS, LAST_SEEN_FRESH_MS } from '@/lib/telemetry/link-status';
import {
  SIGN_DOWN,
  SIGN_ERROR,
  SIGN_NO_DATA,
  deriveStatusSigns,
  shortCommandReason,
  type StatusSignFacts,
} from '@/lib/telemetry/status-signs';

const NOW = 1_000_000;

function facts(over: Partial<StatusSignFacts> = {}): StatusSignFacts {
  return {
    now: NOW,
    phase: 'connecting',
    startedAt: NOW,
    subscribedAt: null,
    channelFailed: false,
    realtimeDown: false,
    unreadable: false,
    sessionHeartbeatAt: null,
    sessionHeartbeatError: null,
    bridgeHeartbeatAt: null,
    telemetryAt: null,
    lastSeenChangedAt: null,
    lastSeenReadable: false,
    commandError: null,
    telemetryUnreadable: false,
    ...over,
  };
}

describe('status signs', () => {
  it('names the three signs in words', () => {
    expect(SIGN_NO_DATA).toBe('Connected, no data');
    expect(SIGN_DOWN).toBe('Not connected');
    expect(SIGN_ERROR).toBe('Error');
  });

  it('leaves every sign off while still connecting', () => {
    expect(deriveStatusSigns(facts()).active).toBeNull();
  });

  it('marks connected with no data when the bridge heartbeat is fresh and telemetry is not', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      bridgeHeartbeatAt: NOW - 500,
      subscribedAt: NOW - 1_000,
    }));
    expect(view.active).toBe('nodata');
    expect(view.errorReason).toBeNull();
  });

  it('marks connected with no data when last_seen changed and no broadcast has arrived', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 4_000,
      subscribedAt: NOW,
    }));
    expect(view.active).toBe('nodata');
  });

  it('marks not connected once the link is offline and nothing else is known', () => {
    const view = deriveStatusSigns(facts({
      phase: 'offline',
      startedAt: NOW - CONNECT_GIVE_UP_MS,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
    }));
    expect(view.active).toBe('down');
    expect(view.errorReason).toBeNull();
  });

  it('stays quiet when telemetry is healthy', () => {
    expect(deriveStatusSigns(facts({
      phase: 'live',
      telemetryAt: NOW - 100,
      bridgeHeartbeatAt: NOW - 100,
    })).active).toBeNull();
  });

  it('shows a command reject code while the bot is still connected', () => {
    const view = deriveStatusSigns(facts({
      phase: 'live',
      telemetryAt: NOW,
      commandError: 'rate limited',
    }));
    expect(view.active).toBe('error');
    expect(view.errorReason).toBe('Command rejected: rate limited');
  });

  it('shows that the bot status could not be read', () => {
    const view = deriveStatusSigns(facts({
      phase: 'offline',
      unreadable: true,
      startedAt: NOW - CONNECT_GIVE_UP_MS,
    }));
    expect(view.active).toBe('error');
    expect(view.errorReason).toBe("Can't read bot status");
  });

  it('does not call fresh telemetry a status-channel error', () => {
    const view = deriveStatusSigns(facts({
      phase: 'live',
      telemetryAt: NOW - 100,
      bridgeHeartbeatAt: NOW - 100,
      channelFailed: true,
      realtimeDown: true,
    }));
    expect(view.active).toBeNull();
    expect(view.errorReason).toBeNull();
  });

  it('keeps connected-no-data when the bridge heartbeat is fresh and the channel flag is stale', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      bridgeHeartbeatAt: NOW - 500,
      subscribedAt: NOW - 1_000,
      channelFailed: true,
      realtimeDown: true,
    }));
    expect(view.active).toBe('nodata');
    expect(view.errorReason).toBeNull();
  });

  it('shows the channel status on the error line when no frames are arriving', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 2_000,
      channelFailed: true,
      realtimeDown: true,
      channelDetail: 'CHANNEL_ERROR: JwtSignatureError: Failed to validate JWT signature',
    }));
    expect(view.active).toBe('error');
    expect(view.errorReason).toBe('Status channel error: CHANNEL_ERROR: JwtSignatureError: Failed to validate JWT signature');
  });

  it('shows a status-channel error when the bot is still present', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - 2_000,
      channelFailed: true,
      realtimeDown: true,
    }));
    expect(view.active).toBe('error');
    expect(view.errorReason).toBe('Status channel error');
  });

  it('shows a telemetry read error from a broadcast the page could not parse', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      bridgeHeartbeatAt: NOW,
      telemetryUnreadable: true,
    }));
    expect(view.errorReason).toBe('Telemetry error');
  });

  it('says broadcasts are missing when the session heartbeat is fine and the bridge is silent', () => {
    const view = deriveStatusSigns(facts({
      phase: 'offline',
      sessionHeartbeatAt: NOW - 1_000,
      subscribedAt: NOW - HEARTBEAT_OFFLINE_MS,
      startedAt: NOW - CONNECT_GIVE_UP_MS,
    }));
    expect(view.active).toBe('error');
    expect(view.errorReason).toBe('Heartbeat ok, broadcasts not arriving');
  });

  it('does not call a fresh last_seen a missing broadcast', () => {
    const view = deriveStatusSigns(facts({
      phase: 'idle',
      sessionHeartbeatAt: NOW,
      lastSeenReadable: true,
      lastSeenChangedAt: NOW - LAST_SEEN_FRESH_MS + 1_000,
      subscribedAt: NOW - 2_000,
    }));
    expect(view.active).toBe('nodata');
    expect(view.errorReason).toBeNull();
  });

  it('shortens command errors and drops secret-looking text', () => {
    expect(shortCommandReason('rate limited: slow down')).toBe('rate limited');
    expect(shortCommandReason('rejected')).toBe('rejected');
    expect(shortCommandReason('eyJhbGciOiJIUzI1NiJ9.payload')).toBe('rejected');
    expect(shortCommandReason(null)).toBeNull();
  });
});
