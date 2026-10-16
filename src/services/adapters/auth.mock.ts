import type { AuthResult, AuthService, Session } from '../types';

export const MOCK_USER = 'demo@amrslam.tech';
/** Invite-only username mapped to MOCK_USER when the mock auth adapter is active. */
export const MOCK_USERNAME = 'demo';
const MOCK_PASSWORD = 'demo-password';

/**
 * Dev-only mock: demo@amrslam.tech / demo-password → ok after 600 ms; anything else → invalid.
 * `?mock=locked` → rate_limited, `?mock=network` → network, `?mock=slow` → 4 s. Session lives in memory only
 * (nothing is written to storage, so a reload signs you out).
 */
export function createMockAuth(opts: { mode?: () => string | null; delay?: (ms: number) => Promise<void> } = {}): AuthService {
  const mode = opts.mode ?? (() => (typeof location === 'undefined' ? null : new URLSearchParams(location.search).get('mock')));
  const wait = opts.delay ?? ((ms: number) => new Promise<void>((r) => setTimeout(r, ms)));
  let session: Session | null = null;
  const subs = new Set<(s: Session | null) => void>();
  const emit = () => subs.forEach((cb) => cb(session));
  return {
    name: 'mock',
    isAvailable: () => true,
    async signIn({ email, password }): Promise<AuthResult> {
      const m = mode();
      await wait(m === 'slow' ? 4000 : 600);
      if (m === 'locked') return { status: 'rate_limited', retryAfterSec: 300 };
      if (m === 'network') return { status: 'network' };
      if (email.trim().toLowerCase() !== MOCK_USER || password !== MOCK_PASSWORD) return { status: 'invalid' };
      session = { email: MOCK_USER, userId: '00000000-0000-4000-8000-0000000000d1', expiresAt: Date.now() + 3600_000 };
      emit();
      return { status: 'ok' };
    },
    async signOut() { session = null; emit(); },
    async getSession() { return session; },
    onChange(cb) { subs.add(cb); return () => void subs.delete(cb); },
  };
}
