import { BOTS, type BotId } from '@/lib/telemetry/protocol';

const KEY = 'amr-control-bot';

export function isBotId(v: string | null | undefined): v is BotId {
  return !!v && BOTS.some((b) => b.id === v);
}

/** URL `?bot=` wins, then localStorage, then Hardware bot. */
export function readStoredBot(fallback: BotId = 'hardware-bot'): BotId {
  if (typeof window === 'undefined') return fallback;
  try {
    const q = new URLSearchParams(window.location.search).get('bot');
    if (isBotId(q)) return q;
    const s = localStorage.getItem(KEY);
    if (isBotId(s)) return s;
  } catch { /* private mode */ }
  return fallback;
}

export function persistBot(id: BotId): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(KEY, id);
    const url = new URL(window.location.href);
    if (url.searchParams.get('bot') !== id) {
      url.searchParams.set('bot', id);
      window.history.replaceState(null, '', `${url.pathname}${url.search}${url.hash}`);
    }
  } catch { /* private mode */ }
}
