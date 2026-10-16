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
