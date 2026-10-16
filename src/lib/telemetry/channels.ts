import type { BotId } from './protocol';

/**
 * `NEXT_PUBLIC_PRIVATE_CONTROL` gates the Realtime transport.
 *
 * Default (unset, `0`, `false`, anything else): the live public topic `amr-bot-<id>`.
 * The Pi bridge in this repo still publishes and listens there. Leave the flag off
 * until Review & Debugger OKs the cut-over (spec step D) and the bridge joins the
 * private topics.
 *
 * `1` / `true` / `on` / `yes`: private topics `bot:<id>:status`, `:ctl`, `:cmd`
 * and `user:<uid>:notify`.
 */
export function privateControlEnabled(flag?: string | null): boolean {
  const v = (flag ?? process.env.NEXT_PUBLIC_PRIVATE_CONTROL ?? '').trim().toLowerCase();
  return v === '1' || v === 'true' || v === 'on' || v === 'yes';
}

export function publicChannel(botId: BotId): string {
  return `amr-bot-${botId}`;
}

export function privateTopics(botId: BotId, userId: string) {
  return {
    status: `bot:${botId}:status`,
    ctl: `bot:${botId}:ctl`,
    cmd: `bot:${botId}:cmd`,
    notify: `user:${userId}:notify`,
  } as const;
}

export type ControlRole = 'controller' | 'viewer' | null;

/** Why the client is deciding whether to hold `bot:<id>:cmd`. */
export type CmdJoinEvent = 'join_bot' | 'control_gained' | 'accept' | 'resubscribe' | 'control_lost' | 'heartbeat';

/**
 * Viewers never subscribe to `:cmd`. Join only as controller, and only for a
 * controller-shaped event. `control_lost` always drops it. A listen-channel
 * reconnect uses `resubscribe`, which rejoins `:cmd` only while still controller.
 */
export function shouldHoldCmdChannel(event: CmdJoinEvent, role: ControlRole): boolean {
  if (event === 'control_lost') return false;
  if (role !== 'controller') return false;
  return event === 'join_bot' || event === 'control_gained' || event === 'accept' || event === 'resubscribe' || event === 'heartbeat';
}

/** Topics the shared subscribe/resubscribe path may open. `:cmd` is not included. */
export function privateListenTopics(botId: BotId, userId: string) {
  const topics = privateTopics(botId, userId);
  return { status: topics.status, ctl: topics.ctl, notify: topics.notify } as const;
}
