import { describe, expect, it } from 'vitest';
import {
  SIDE_CHANNEL_NOTE,
  authEventRefreshesRealtime,
  emptyChannelMembership,
  interpretChannelStatus,
  openChannel,
  retireChannels,
} from '@/lib/telemetry/channel-watch';
import { controlListenPlan } from '@/lib/telemetry/channels';

describe('control listen plan', () => {
  it('joins only the public hardware topic when private control is off', () => {
    expect(controlListenPlan('hardware-bot', 'operator-1', '')).toEqual([
      { topic: 'amr-bot-hardware-bot', private: false, carriesLink: true },
    ]);
    expect(controlListenPlan('hardware-bot', 'operator-1', '0')).toEqual([
      { topic: 'amr-bot-hardware-bot', private: false, carriesLink: true },
    ]);
    expect(controlListenPlan('hardware-bot', 'operator-1', 'false')).toEqual([
      { topic: 'amr-bot-hardware-bot', private: false, carriesLink: true },
    ]);
  });

  it('joins private status, ctl, and notify when the flag is on', () => {
    expect(controlListenPlan('hardware-bot', 'operator-1', '1')).toEqual([
      { topic: 'bot:hardware-bot:status', private: true, carriesLink: true },
      { topic: 'bot:hardware-bot:ctl', private: true, carriesLink: false },
      { topic: 'user:operator-1:notify', private: true, carriesLink: false },
    ]);
  });
});

describe('channel subscribe generation', () => {
  it('ignores CLOSED from a channel removed on purpose and does not re-arm resubscribe', () => {
    let membership = emptyChannelMembership();
    membership = openChannel(membership, 1);
    const openedAt = membership.generation;

    const failed = interpretChannelStatus(membership, {
      id: 1,
      generation: openedAt,
      carriesLink: true,
      status: 'CHANNEL_ERROR',
    });
    expect(failed.ignore).toBe(false);
    expect(failed.channelFailed).toBe(true);
    expect(failed.realtimeDown).toBe(true);
    expect(failed.resubscribe).toBe(true);

    const timedOut = interpretChannelStatus(membership, {
      id: 1,
      generation: openedAt,
      carriesLink: true,
      status: 'TIMED_OUT',
    });
    expect(timedOut.resubscribe).toBe(true);
    expect(timedOut.channelFailed).toBe(true);

    membership = retireChannels(membership, [1]);
    expect(membership.generation).toBe(openedAt + 1);
    expect(membership.live.has(1)).toBe(false);
    expect(membership.retired.has(1)).toBe(true);

    const closed = interpretChannelStatus(membership, {
      id: 1,
      generation: openedAt,
      carriesLink: true,
      status: 'CLOSED',
    });
    expect(closed.ignore).toBe(true);
    expect(closed.intentionalClose).toBe(true);
    expect(closed.channelFailed).toBeNull();
    expect(closed.realtimeDown).toBeNull();
    expect(closed.resubscribe).toBe(false);

    membership = openChannel(membership, 2);
    const subscribed = interpretChannelStatus(membership, {
      id: 2,
      generation: membership.generation,
      carriesLink: true,
      status: 'SUBSCRIBED',
    });
    expect(subscribed.ignore).toBe(false);
    expect(subscribed.channelFailed).toBe(false);
    expect(subscribed.realtimeDown).toBe(false);
    expect(subscribed.resubscribe).toBe(false);

    const late = interpretChannelStatus(membership, {
      id: 1,
      generation: openedAt,
      carriesLink: true,
      status: 'CLOSED',
    });
    expect(late.ignore).toBe(true);
    expect(late.intentionalClose).toBe(true);
    expect(late.resubscribe).toBe(false);
    expect(late.channelFailed).toBeNull();
    expect(late.realtimeDown).toBeNull();
  });

  it('still fails a CLOSED on the channel that is live in this generation', () => {
    let membership = emptyChannelMembership();
    membership = openChannel(membership, 7);
    const effect = interpretChannelStatus(membership, {
      id: 7,
      generation: membership.generation,
      carriesLink: true,
      status: 'CLOSED',
    });
    expect(effect.ignore).toBe(false);
    expect(effect.intentionalClose).toBe(false);
    expect(effect.channelFailed).toBe(true);
    expect(effect.realtimeDown).toBe(true);
    expect(effect.resubscribe).toBe(true);
  });

  it('does not fail the link when only a side channel drops', () => {
    let membership = emptyChannelMembership();
    membership = openChannel(membership, 1);
    membership = openChannel(membership, 2);
    const effect = interpretChannelStatus(membership, {
      id: 2,
      generation: membership.generation,
      carriesLink: false,
      status: 'CHANNEL_ERROR',
    });
    expect(effect.channelFailed).toBeNull();
    expect(effect.realtimeDown).toBeNull();
    expect(effect.resubscribe).toBe(false);
    expect(effect.note).toBe(SIDE_CHANNEL_NOTE);

    const back = interpretChannelStatus(membership, {
      id: 2,
      generation: membership.generation,
      carriesLink: false,
      status: 'SUBSCRIBED',
    });
    expect(back.note).toBeNull();
    expect(back.channelFailed).toBeNull();
    expect(back.resubscribe).toBe(false);
  });
});

describe('realtime auth refresh', () => {
  it('pushes the access token on refresh and sign-in', () => {
    expect(authEventRefreshesRealtime('TOKEN_REFRESHED')).toBe(true);
    expect(authEventRefreshesRealtime('SIGNED_IN')).toBe(true);
    expect(authEventRefreshesRealtime('SIGNED_OUT')).toBe(false);
    expect(authEventRefreshesRealtime('INITIAL_SESSION')).toBe(false);
  });
});
