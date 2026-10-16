import { describe, expect, it } from 'vitest';
import { privateControlEnabled, privateTopics, publicChannel } from '@/lib/telemetry/channels';
import {
  clampLinAng,
  clampToolParams,
  createSeqCounter,
  isContinuous,
  payloadHasToken,
  privateCmdPayload,
  publicCommandEnvelope,
  shouldFastPoll,
} from '@/lib/telemetry/commands';
import {
  countdownFraction,
  formatCountdown,
  parseHeartbeat,
  passwordRules,
  respondFailure,
  secondsRemaining,
  strengthSegments,
} from '@/lib/control/access';
import { cameraSrc, normalizeTelemetry } from '@/lib/telemetry/normalize';

describe('private control flag', () => {
  it('keeps the public channel unless the flag is explicitly on', () => {
    expect(privateControlEnabled('')).toBe(false);
    expect(privateControlEnabled('0')).toBe(false);
    expect(privateControlEnabled('false')).toBe(false);
    expect(privateControlEnabled('off')).toBe(false);
    for (const on of ['1', 'true', 'on', 'yes', ' TRUE ']) {
      expect(privateControlEnabled(on)).toBe(true);
    }
  });

  it('names public and private topics', () => {
    expect(publicChannel('amr4')).toBe('amr-bot-amr4');
    expect(privateTopics('hardware-bot', 'uid-1')).toEqual({
      status: 'bot:hardware-bot:status',
      ctl: 'bot:hardware-bot:ctl',
      cmd: 'bot:hardware-bot:cmd',
      notify: 'user:uid-1:notify',
    });
  });
});

describe('command wire format', () => {
  it('increases seq inside one epoch and restarts at 1', () => {
    const seq = createSeqCounter();
    expect(seq.next(4)).toBe(1);
    expect(seq.next(4)).toBe(2);
    expect(seq.next(5)).toBe(1);
  });

  it('puts the token only on the private payload', () => {
    const joy = { type: 'joy' as const, a: [0, 1, 0, 0, 0, 0, 0, 0], b: 1 };
    const priv = privateCmdPayload(joy, { epoch: 3, token: 'lease-token', seq: 2, ts: 9 });
    expect(priv).toMatchObject({ epoch: 3, token: 'lease-token', seq: 2, ts: 9, type: 'joy', b: 1 });
    expect(payloadHasToken(priv)).toBe(true);
    expect(priv).not.toHaveProperty('axes');

    const pub = publicCommandEnvelope('amr4', joy, { id: 'c1', epoch: 3, seq: 2, ts: 9 });
    expect(payloadHasToken(pub)).toBe(false);
    expect(pub).not.toHaveProperty('token');
    expect(pub).not.toHaveProperty('from');
    const cmd = pub.cmd as { a: number[]; axes: number[]; buttons: number };
    expect(cmd.axes).toEqual(joy.a);
    expect(cmd.buttons).toBe(1);
  });

  it('treats estop, nudge, joy and drive as continuous', () => {
    expect(isContinuous({ type: 'estop' })).toBe(true);
    expect(isContinuous({ type: 'nudge', lin: 0, ang: 0 })).toBe(true);
    expect(isContinuous({ type: 'nav_goal', x: 1, y: 2 })).toBe(false);
    expect(isContinuous({ type: 'run_tool', tool: 'imu_test' })).toBe(false);
  });

  it('clamps teleop and tool inputs', () => {
    expect(clampLinAng(1, -2)).toEqual({ lin: 0.3, ang: -1 });
    expect(clampToolParams('imu_calibration', { speed: 0.5, rotations: 2 })).toEqual({ speed: '0.5', rotations: '2' });
    expect(clampToolParams('imu_calibration', { speed: 2, rotations: 2 })).toBeNull();
    expect(clampToolParams('drive_distance', { distance: 1, maxVel: 0.3 })).toEqual({ distance: '1', max_vel: '0.3' });
    expect(clampToolParams('drive_distance', { distance: 9, maxVel: 0.3 })).toBeNull();
  });

  it('polls faster while a request is in flight', () => {
    expect(shouldFastPoll({ myStatus: 'pending', incoming: 0 })).toBe(true);
    expect(shouldFastPoll({ myStatus: null, incoming: 1 })).toBe(true);
    expect(shouldFastPoll({ myStatus: 'denied', incoming: 0 })).toBe(false);
  });
});

describe('access flow parsers', () => {
  it('parses a heartbeat and hides the token from viewers', () => {
    const view = parseHeartbeat({
      role: 'viewer',
      bot_id: 'amr4',
      epoch: 2,
      controller: 'abc',
      controller_name: 'Ada',
      token: 'should-not-stick',
      pending_requests: [{ id: 'r1', requester: 'u2', name: 'Bea', expires_at: '2026-10-16T00:00:10Z' }],
      my_request: { id: 'r1', status: 'pending', expires_at: '2026-10-16T00:00:10Z' },
      retry_after: null,
    });
    expect(view?.role).toBe('viewer');
    expect(view?.token).toBeNull();
    expect(view?.controllerName).toBe('Ada');
    expect(view?.pendingRequests[0]?.name).toBe('Bea');
    expect(view?.myRequest?.status).toBe('pending');

    const drive = parseHeartbeat({ role: 'controller', epoch: 2, token: 'lease-token' });
    expect(drive?.token).toBe('lease-token');
  });

  it('formats the 10s countdown', () => {
    const now = Date.parse('2026-10-16T00:00:00Z');
    const exp = '2026-10-16T00:00:10Z';
    expect(secondsRemaining(exp, now)).toBe(10);
    expect(formatCountdown(10)).toBe('0:10');
    expect(countdownFraction(exp, now)).toBe(1);
    expect(secondsRemaining(exp, now + 10_500)).toBe(0);
  });

  it('maps respond failures and password rules', () => {
    expect(respondFailure('expired')).toBe('ended');
    expect(respondFailure('not_found')).toBe('ended');
    expect(respondFailure('denied')).toBe('ended');
    expect(respondFailure('requester_inactive')).toBe('left');
    expect(respondFailure('not_controller')).toBe('lost');
    expect(respondFailure('network')).toBe('retry');
    expect(passwordRules('short', 'short').length).toBe(false);
    expect(passwordRules('longenough1', 'longenough1')).toEqual({ length: true, match: true });
    expect(passwordRules('longenough1', 'longenough2').match).toBe(false);
    expect(strengthSegments('')).toBe(0);
    expect(strengthSegments('Longenough1!')).toBeGreaterThan(0);
  });
});

describe('telemetry normalizer', () => {
  it('accepts the in-repo camelCase payload and the assumed snake_case keys', () => {
    const camel = normalizeTelemetry({
      pose: [1, 2, 0.1],
      mapPose: [3, 4, 0],
      yoloDet: ['chair'],
      cameraJpegB64: 'abc123456789012345',
      nodes: { slam_toolbox: true },
      sys: { cpu: 10, mem: [1, 2], up: '1h' },
    });
    expect(camel?.mapPose).toEqual([3, 4, 0]);
    expect(camel?.yoloText).toContain('chair');
    expect(camel?.camera).toBe('abc123456789012345');
    expect(cameraSrc(camel!.camera)).toBe('data:image/jpeg;base64,abc123456789012345');
    expect(camel?.sys.mem).toEqual([1, 2]);
    expect(camel?.sys.up).toBe('1h');

    const snake = normalizeTelemetry({
      map_pose: [5, 6, 0],
      yolo_det: [{ name: 'door' }],
      camera_frame: 'framebytes1234567890',
      sys: { ram: [3, 4], uptime: '2h', soc: 40 },
    });
    expect(snake?.mapPose).toEqual([5, 6, 0]);
    expect(snake?.yoloText).toContain('door');
    expect(snake?.camera).toBe('framebytes1234567890');
    expect(snake?.sys.mem).toEqual([3, 4]);
    expect(snake?.sys.up).toBe('2h');
    expect(snake?.sys.temp).toBe(40);
  });
});
