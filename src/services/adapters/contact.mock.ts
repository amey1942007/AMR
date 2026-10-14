import type { ContactService } from '../types';
import { defaultKV, markSent, throttleRemaining, type KV } from './contact.shared';

export type MockMode = 'ok' | 'error' | 'slow';

/** Dev override: ?mock=error | ?mock=slow (read at submit time, so static prerender is unaffected). */
function modeFromUrl(): MockMode {
  if (typeof window === 'undefined') return 'ok';
  const m = new URLSearchParams(window.location.search).get('mock');
  return m === 'error' || m === 'slow' ? m : 'ok';
}

/** Mock adapter: ok after 800 ms; 'error' → error; 'slow' → ok after 4 s. Throttle + honeypot like real adapters. */
export function createMockContact(opts: { mode?: MockMode; delayMs?: number; kv?: KV } = {}): ContactService {
  const kv = opts.kv ?? defaultKV();
  return {
    name: 'mock',
    isAvailable: () => true,
    async submit(p) {
      const mode = opts.mode ?? modeFromUrl();
      const delay = opts.delayMs ?? (mode === 'slow' ? 4000 : 800);
      if (p.website) return { status: 'ok' };
      const left = throttleRemaining(kv);
      if (left) return { status: 'throttled', retryInSec: left };
      await new Promise((r) => setTimeout(r, delay));
      if (mode === 'error') return { status: 'error' };
      markSent(kv);
      return { status: 'ok' };
    },
  };
}
