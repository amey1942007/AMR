import type { ContactService } from '../types';
import { TIMEOUT_MS, defaultKV, isValidPayload, markSent, normalise, throttleRemaining, type KV } from './contact.shared';

/** POST JSON to a server route (e.g. Vercel /api/contact). 2xx → ok, 429 → throttled (Retry-After), else error. 10 s timeout. */
export function createHttpContact(cfg: { endpoint?: string; kv?: KV; fetchImpl?: typeof fetch; timeoutMs?: number } = {}): ContactService {
  const kv = cfg.kv ?? defaultKV();
  const endpoint = cfg.endpoint;
  const f = cfg.fetchImpl ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  return {
    name: 'http',
    isAvailable: () => !!endpoint,
    async submit(p) {
      if (!endpoint) return { status: 'unavailable' };
      if (p.website) return { status: 'ok' };
      if (!isValidPayload(p)) return { status: 'error' };
      const left = throttleRemaining(kv);
      if (left) return { status: 'throttled', retryInSec: left };
      try {
        const res = await f(endpoint, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(normalise(p)),
          signal: AbortSignal.timeout(cfg.timeoutMs ?? TIMEOUT_MS),
        });
        if (res.status === 429) return { status: 'throttled', retryInSec: Number(res.headers.get('retry-after')) || 30 };
        if (!res.ok) return { status: 'error' };
        markSent(kv);
        return { status: 'ok' };
      } catch {
        return { status: 'error' };
      }
    },
  };
}
