import type { AuthResult, AuthService, Session } from '../types';
import { isPublishableKey } from './contact.shared';
import { getAuthClient } from '../supabase-client';

/** Minimal slice of supabase-js auth we use (injectable for tests). */
export interface SupabaseAuthLike {
  signInWithPassword(c: { email: string; password: string }): Promise<{ data: unknown; error: unknown }>;
  signOut(): Promise<unknown>;
  getSession(): Promise<{ data: { session: { user?: { id?: string; email?: string }; expires_at?: number } | null } }>;
  onAuthStateChange(cb: (event: string, s: { user?: { id?: string; email?: string }; expires_at?: number } | null) => void): { data: { subscription: { unsubscribe(): void } } };
}

const toSession = (s: { user?: { id?: string; email?: string }; expires_at?: number } | null): Session | null =>
  s ? { email: s.user?.email, userId: s.user?.id, expiresAt: s.expires_at ? s.expires_at * 1000 : undefined } : null;

/**
 * Error mapping (login-spec §1.6, §1.8). Every wrong-credential case, INCLUDING "Email not confirmed" (which would
 * reveal that the account exists), becomes the generic `invalid`. 429 → rate_limited; fetch failure/timeout → network.
 * Provider messages never leave this function.
 */
export function mapAuthError(err: unknown): AuthResult {
  if (!err) return { status: 'ok' };
  const e = err as { name?: string; status?: number; code?: string; message?: string; headers?: Record<string, string>; retryAfter?: number };
  if (e.name === 'TypeError' || e.name === 'AbortError' || e.name === 'TimeoutError' || e.name === 'AuthRetryableFetchError' || e.status === 0) return { status: 'network' };
  if (e.status === 429 || e.code === 'over_request_rate_limit' || e.code === 'over_email_send_rate_limit') {
    const ra = Number(e.retryAfter ?? e.headers?.['retry-after']);
    return Number.isFinite(ra) && ra > 0 ? { status: 'rate_limited', retryAfterSec: Math.ceil(ra) } : { status: 'rate_limited' };
  }
  if (e.status && e.status >= 500) return { status: 'network' };
  if (e.status === 403 || e.code === 'user_banned' || /allowlist/i.test(e.message ?? '')) return { status: 'forbidden' };
  // 400 invalid_credentials, email_not_confirmed / "Email not confirmed", user_not_found, anything else: generic.
  return { status: 'invalid' };
}

export function createSupabaseAuth(cfg: { url: string; key: string; client?: () => Promise<SupabaseAuthLike>; timeoutMs?: number }): AuthService {
  const ok = isPublishableKey(cfg.key) && /^https:\/\//.test(cfg.url);
  const timeoutMs = cfg.timeoutMs ?? 10_000;
  const client = cfg.client ?? (async () => (await getAuthClient(cfg.url, cfg.key, timeoutMs)).auth as unknown as SupabaseAuthLike);
  const timeout = <T,>(p: Promise<T>) => Promise.race([p, new Promise<never>((_, rej) => setTimeout(() => rej(Object.assign(new Error('timeout'), { name: 'TimeoutError' })), timeoutMs))]);
  return {
    name: 'supabase',
    isAvailable: () => ok,
    async signIn({ email, password }) {
      if (!ok) return { status: 'unavailable' };
      try {
        const auth = await client();
        const { error } = await timeout(auth.signInWithPassword({ email: email.trim(), password }));
        return mapAuthError(error);
      } catch (err) {
        return mapAuthError(err ?? { name: 'TypeError' });
      }
    },
    async signOut() { if (ok) { try { await (await client()).signOut(); } catch { /* local session is cleared by supabase-js */ } } },
    async getSession() {
      if (!ok) return null;
      try { return toSession((await (await client()).getSession()).data.session); } catch { return null; }
    },
    onChange(cb) {
      if (!ok) return () => {};
      let unsub: (() => void) | null = null, dead = false;
      client().then((a) => { if (dead) return; const { data } = a.onAuthStateChange((_e, s) => cb(toSession(s))); unsub = () => data.subscription.unsubscribe(); }).catch(() => {});
      return () => { dead = true; unsub?.(); };
    },
  };
}
