import type { ContactService } from '../types';
import { TIMEOUT_MS, defaultKV, isPublishableKey, isValidPayload, markSent, normalise, throttleRemaining, withTimeout, type KV } from './contact.shared';

type Insert = (row: ReturnType<typeof normalise>) => Promise<{ error: unknown }>;

/**
 * Supabase insert into public.contact_submissions (brief §15). ONLY a publishable/anon key is accepted; a secret or
 * service_role key makes the adapter unavailable (→ mailto). supabase-js is dynamically imported on first submit.
 * Every request aborts after 10 s. No .select() after insert (RLS denies select).
 */
export function createSupabaseContact(cfg: { url: string; key: string; kv?: KV; insert?: Insert; timeoutMs?: number }): ContactService {
  const kv = cfg.kv ?? defaultKV();
  const ok = isPublishableKey(cfg.key) && /^https:\/\//.test(cfg.url);
  const timeoutMs = cfg.timeoutMs ?? TIMEOUT_MS;
  let insert: Promise<Insert> | null = cfg.insert ? Promise.resolve(cfg.insert) : null;
  const getInsert = () =>
    (insert ??= import('@supabase/supabase-js').then(({ createClient }) => {
      const sb = createClient(cfg.url, cfg.key, {
        auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
        global: { fetch: (input, init) => fetch(input, { ...init, signal: AbortSignal.timeout(timeoutMs) }) },
      });
      return (row) => sb.from('contact_submissions').insert(row) as unknown as Promise<{ error: unknown }>;
    }));
  return {
    name: 'supabase',
    isAvailable: () => ok,
    async submit(p) {
      if (!ok) return { status: 'unavailable' };
      if (p.website) return { status: 'ok' };
      if (!isValidPayload(p)) return { status: 'error' };
      const left = throttleRemaining(kv);
      if (left) return { status: 'throttled', retryInSec: left };
      try {
        const fn = await getInsert();
        const { error } = await withTimeout(fn(normalise(p)), timeoutMs);
        if (error) return { status: 'error' };
        markSent(kv);
        return { status: 'ok' };
      } catch {
        return { status: 'error' };
      }
    },
  };
}
