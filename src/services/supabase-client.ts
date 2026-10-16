import type { SupabaseClient } from '@supabase/supabase-js';

/**
 * The one place supabase-js clients are created for auth (login-spec §1.6). The auth client persists its session
 * (localStorage, storageKey 'amr-auth'), so it is a separate instance from the contact client (persistSession:false).
 * supabase-js is dynamically imported: it never lands in the initial bundle.
 */
/**
 * Auth options for the public `amr-bot-*` socket.
 * No persisted session, so Realtime never receives the operator JWT.
 * A signed-in token on that public topic is rejected (`JwtSignatureError` /
 * authorization) and the page then tears the channel down.
 *
 * `storageKey` is not the default `sb-<project>-auth-token`. The contact client
 * uses that default in the same page, and GoTrue treats two clients on one key
 * as undefined. The operator session stays on `amr-auth`.
 */
export const BROADCAST_AUTH = {
  persistSession: false,
  autoRefreshToken: false,
  detectSessionInUrl: false,
  storageKey: 'amr-broadcast',
} as const;

/** Publishable key the broadcast client was constructed with. Empty if missing. */
export function publishableKeyOf(client: { supabaseKey?: string } | null): string {
  const key = client?.supabaseKey;
  return typeof key === 'string' ? key : '';
}

let authClient: Promise<SupabaseClient> | null = null;
let broadcastClient: Promise<SupabaseClient> | null = null;

/** Session-less client used only for public broadcast topics. */
export function getBroadcastClient(url: string, key: string, timeoutMs = 10_000): Promise<SupabaseClient> {
  return (broadcastClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, {
      auth: BROADCAST_AUTH,
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) }) },
    }),
  ));
}

export function getAuthClient(url: string, key: string, timeoutMs = 10_000): Promise<SupabaseClient> {
  return (authClient ??= import('@supabase/supabase-js').then(({ createClient }) =>
    createClient(url, key, {
      auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: false, storageKey: 'amr-auth' },
      global: { fetch: (input, init) => fetch(input, { ...init, signal: init?.signal ?? AbortSignal.timeout(timeoutMs) }) },
    }),
  ));
}
