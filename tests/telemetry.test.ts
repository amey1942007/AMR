import { describe, expect, it } from 'vitest';
import {
  channelName,
  isBotOffline,
  nextLagMs,
  preferBoardMode,
  HEARTBEAT_OFFLINE_MS,
  LAG_FALLBACK_MS,
  LAG_RECOVER_MS,
} from '@/lib/telemetry/protocol';

describe('telemetry protocol', () => {
  it('names realtime channels per bot', () => {
    expect(channelName('amr4')).toBe('amr-bot-amr4');
    expect(channelName('hardware-bot')).toBe('amr-bot-hardware-bot');
  });

  it('marks bot offline after the 10s heartbeat timeout', () => {
    const now = 1_000_000;
    expect(isBotOffline(null, now)).toBe(true);
    expect(isBotOffline(now - HEARTBEAT_OFFLINE_MS + 100, now)).toBe(false);
    expect(isBotOffline(now - HEARTBEAT_OFFLINE_MS - 1, now)).toBe(true);
  });

  it('falls back to status board when lag is high', () => {
    expect(preferBoardMode(LAG_FALLBACK_MS + 1, false)).toBe(true);
    expect(preferBoardMode(LAG_FALLBACK_MS - 1, false)).toBe(false);
    expect(preferBoardMode(LAG_RECOVER_MS + 1, true)).toBe(true);
    expect(preferBoardMode(LAG_RECOVER_MS - 1, true)).toBe(false);
  });

  it('smooths lag samples', () => {
    const a = nextLagMs(0, 200);
    expect(a).toBe(200);
    const b = nextLagMs(200, 600);
    expect(b).toBeGreaterThan(200);
    expect(b).toBeLessThan(600);
  });
});
