import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The one place supabase-js clients are created for auth (login-spec §1.6). The auth client persists its session
 * (localStorage, storageKey 'amr-auth'), so it is a separate instance from the contact client (persistSession:false).
 * supabase-js is dynamically imported: it never lands in the initial bundle.
 */
let authClient: Promise<SupabaseClient> | null = null;
export function getAuthClient(url: string, key: string, timeoutMs = 10_000): Promise<SupabaseClient> {
  return (authClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'amr-auth' },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) }) },
    }),
  ));
}
