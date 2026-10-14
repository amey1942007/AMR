import { describe, it, expect, vi } from 'vitest';
import { createMockAuth } from '@/services/adapters/auth.mock';
import { mapAuthError, createSupabaseAuth } from '@/services/adapters/auth.supabase';
import { noneAuth } from '@/services/adapters/auth.none';
import { redirectTarget, isSafeRelative } from '@/lib/redirect';
import { backoffRemaining, recordFailure, clearFailures, type KV } from '@/lib/login-backoff';
import { resolveAuthAdapter, readSupabaseKey } from '@/lib/config';

const memKV = (): KV => { const m = new Map<string, string>(); return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) }; };

describe('AuthService · mock', () => {
  it('ok / invalid / rate_limited / network / unavailable matrix', async () => {
    const delay = () => Promise.resolve();
    const ok = createMockAuth({ mode: () => null, delay });
    expect(ok.isAvailable()).toBe(true);
    expect((await ok.signIn({ email: 'demo@amrslam.tech', password: 'demo-password' })).status).toBe('ok');
    expect((await ok.signIn({ email: 'x@y.z', password: 'nope' })).status).toBe('invalid');
    expect((await createMockAuth({ mode: () => 'locked', delay }).signIn({ email: 'a', password: 'b' })).status).toBe('rate_limited');
    expect((await createMockAuth({ mode: () => 'network', delay }).signIn({ email: 'a', password: 'b' })).status).toBe('network');
    expect((await noneAuth.signIn({ email: 'a', password: 'b' })).status).toBe('unavailable');
    expect(noneAuth.isAvailable()).toBe(false);
  });
  it('session is in-memory only (no storage)', async () => {
    const a = createMockAuth({ delay: () => Promise.resolve() });
    await a.signIn({ email: 'demo@amrslam.tech', password: 'demo-password' });
    expect(await a.getSession()).toEqual(expect.objectContaining({ email: 'demo@amrslam.tech' }));
    // A fresh instance has no session (nothing persisted).
    expect(await createMockAuth({ delay: () => Promise.resolve() }).getSession()).toBeNull();
  });
});

describe('AuthService · supabase mapping', () => {
  it('maps Email not confirmed and invalid_credentials to invalid', () => {
    expect(mapAuthError({ status: 400, message: 'Email not confirmed' }).status).toBe('invalid');
    expect(mapAuthError({ status: 400, code: 'invalid_credentials' }).status).toBe('invalid');
    expect(mapAuthError({ status: 429, headers: { 'retry-after': '42' } })).toEqual({ status: 'rate_limited', retryAfterSec: 42 });
    expect(mapAuthError({ name: 'TypeError' }).status).toBe('network');
    expect(mapAuthError({ name: 'TimeoutError' }).status).toBe('network');
  });
  it('createSupabaseAuth refuses a secret key', () => {
    const a = createSupabaseAuth({ url: 'https://x.supabase.co', key: 'sb_secret_abc' });
    expect(a.isAvailable()).toBe(false);
  });
});

describe('redirectTarget open-redirect guard', () => {
  const allow = ['https://bot.amrslam.tech'];
  it('accepts same-origin relative paths and allow-listed absolutes', () => {
    expect(redirectTarget({ next: '/control/', allowlist: allow })).toBe('/control/');
    expect(redirectTarget({ next: '/robots/amr4/?x=1', allowlist: allow })).toBe('/robots/amr4/?x=1');
    expect(redirectTarget({ next: 'https://bot.amrslam.tech', allowlist: allow })).toBe('https://bot.amrslam.tech');
  });
  it('rejects //evil.com, https://evil.com, /\\evil', () => {
    for (const bad of ['//evil.com', 'https://evil.com', '/\\evil', '/%2fevil', 'javascript:alert(1)']) {
      expect(isSafeRelative(bad)).toBe(false);
      expect(redirectTarget({ next: bad, allowlist: allow })).toBe('/control/');
    }
  });
  it('falls back to controlPanelUrl (allow-listed) then /control/', () => {
    expect(redirectTarget({ allowlist: allow, controlPanelUrl: 'https://bot.amrslam.tech' })).toBe('https://bot.amrslam.tech');
    expect(redirectTarget({ allowlist: allow, controlPanelUrl: 'https://evil.com' })).toBe('/control/');
    expect(redirectTarget({ allowlist: allow })).toBe('/control/');
  });
});

describe('client backoff', () => {
  it('waits 30→60→120 s after 5 failures in 10 min', () => {
    const kv = memKV();
    let now = 1_000_000;
    for (let i = 0; i < 4; i++) { recordFailure(kv, now); now += 1000; }
    expect(backoffRemaining(kv, now)).toBe(0);
    expect(recordFailure(kv, now)).toBe(30);
    expect(recordFailure(kv, now + 1000)).toBe(60);
    expect(recordFailure(kv, now + 2000)).toBe(120);
    clearFailures(kv);
    expect(backoffRemaining(kv, now + 3000)).toBe(0);
  });
});

describe('config', () => {
  it('reads PUBLISHABLE_KEY first, then ANON_KEY; never a secret', () => {
    expect(readSupabaseKey({ publishable: 'sb_publishable_x', anon: 'anon' })).toBe('sb_publishable_x');
    expect(readSupabaseKey({ anon: 'legacy-anon' })).toBe('legacy-anon');
    expect(resolveAuthAdapter({ adapter: 'mock' })).toBe('mock');
    expect(resolveAuthAdapter({ adapter: 'supabase', nodeEnv: 'production' })).toBe('none');
    expect(resolveAuthAdapter({ adapter: 'none' })).toBe('none');
    expect(resolveAuthAdapter({ supabaseUrl: 'https://x.co', supabaseKey: 'k', nodeEnv: 'production' })).toBe('supabase');
    expect(resolveAuthAdapter({ nodeEnv: 'production' })).toBe('none');
    expect(resolveAuthAdapter({ nodeEnv: 'development' })).toBe('mock');
    // review login #1: mock is refused in production.
    expect(resolveAuthAdapter({ adapter: 'mock', nodeEnv: 'production' })).toBe('none');
    expect(resolveAuthAdapter({ adapter: 'mock', supabaseUrl: 'https://x.co', supabaseKey: 'k', nodeEnv: 'production' })).toBe('supabase');
  });
});

describe('no credential logging', () => {
  it('signIn never puts the password in storage or console', async () => {
    const log = vi.spyOn(console, 'log').mockImplementation(() => {});
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    const err = vi.spyOn(console, 'error').mockImplementation(() => {});
    const kv = memKV();
    const a = createMockAuth({ delay: () => Promise.resolve() });
    await a.signIn({ email: 'demo@amrslam.tech', password: 'demo-password' });
    recordFailure(kv);
    const blob = JSON.stringify({ logs: [log.mock.calls, warn.mock.calls, err.mock.calls], storage: kv.get('amr-login-fails') });
    expect(blob).not.toMatch(/demo-password/);
    expect(blob).not.toMatch(/demo@amrslam\.tech/); // failures store timestamps only
    log.mockRestore(); warn.mockRestore(); err.mockRestore();
  });
});

describe('redirect hardening (review login #2)', () => {
  const allow = ['https://bot.amrslam.tech'];
  it.each(['/.//evil.com', '/%09/evil.com', '/../../evil', '/./x', '/a/%2e%2e/b', '//evil.com', '/\\evil'])('rejects %s', (n) => {
    expect(redirectTarget({ next: n, allowlist: allow })).toBe('/control/');
  });
  it('rebuilds from pathname+search+hash', () => {
    expect(redirectTarget({ next: '/control/?a=1#x', allowlist: allow })).toBe('/control/?a=1#x');
  });
});
