import type { ContactService } from '../types';
import { defaultKV, markSent, normalise, throttleRemaining, type KV } from './contact.shared';

/**
 * Supabase insert into public.contact_submissions (brief §15). Uses ONLY the publishable key.
 * supabase-js is dynamically imported on first submit so it never lands in the initial bundle.
 * No .select() after insert — RLS denies select.
 */
export function createSupabaseContact(cfg: { url: string; key: string; kv?: KV }): ContactService {
  const kv = cfg.kv ?? defaultKV();
  let client: Promise<import('@supabase/supabase-js').SupabaseClient> | null = null;
  const getClient = () =>
    (client ??= import('@supabase/supabase-js').then(({ createClient }) =>
      createClient(cfg.url, cfg.key, { auth: { persistSession: false, autoRefreshToken: false } }),
    ));
  return {
    name: 'supabase',
    isAvailable: () => true,
    async submit(p) {
      if (p.website) return { status: 'ok' };
      const left = throttleRemaining(kv);
      if (left) return { status: 'throttled', retryInSec: left };
      try {
        const sb = await getClient();
        const { error } = await sb.from('contact_submissions').insert(normalise(p));
        if (error) return { status: 'error' };
        markSent(kv);
        return { status: 'ok' };
      } catch {
        return { status: 'error' };
      }
    },
  };
}
