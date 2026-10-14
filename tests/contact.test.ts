import { describe, expect, it } from 'vitest';
import { resolveContactAdapter, type AppConfig } from '@/lib/config';
import { createContactService } from '@/services';
import { createMockContact } from '@/services/adapters/contact.mock';
import { THROTTLE_KEY, type KV } from '@/services/adapters/contact.shared';
import { validateAll } from '@/lib/validate';

const kv = (): KV => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => void m.set(k, v) }; };
const p = { name: 'A', email: 'a@b.co', message: 'hi' };

describe('adapter selection', () => {
  it('defaults to mock outside production', () => expect(resolveContactAdapter({ nodeEnv: 'development' })).toBe('mock'));
  it('production without env → mailto', () => expect(resolveContactAdapter({ nodeEnv: 'production' })).toBe('mailto'));
  it('production with url+key → supabase', () =>
    expect(resolveContactAdapter({ nodeEnv: 'production', supabaseUrl: 'u', supabaseKey: 'k' })).toBe('supabase'));
  it('explicit env wins', () => expect(resolveContactAdapter({ adapter: 'mock', nodeEnv: 'production' })).toBe('mock'));
  it('explicit supabase without creds degrades to mailto', () => expect(resolveContactAdapter({ adapter: 'supabase' })).toBe('mailto'));
  it('mailto service is unavailable', () => {
    const cfg = { contactAdapter: 'mailto', siteUrl: '', basePath: '', email: '' } as AppConfig;
    expect(createContactService(cfg).isAvailable()).toBe(false);
  });
});

describe('mock contact adapter', () => {
  it('ok, then throttled for 30 s', async () => {
    const s = createMockContact({ delayMs: 1, kv: kv() });
    expect((await s.submit(p)).status).toBe('ok');
    const r = await s.submit(p);
    expect(r.status).toBe('throttled');
    expect(r.retryInSec).toBeGreaterThan(25);
  });
  it('error mode', async () => expect((await createMockContact({ mode: 'error', delayMs: 1, kv: kv() }).submit(p)).status).toBe('error'));
  it('honeypot silently ok without throttling', async () => {
    const store = kv();
    expect((await createMockContact({ delayMs: 1, kv: store }).submit({ ...p, website: 'spam' })).status).toBe('ok');
    expect(store.getItem(THROTTLE_KEY)).toBeNull();
  });
});

describe('validation', () => {
  it('flags required + format', () => {
    expect(validateAll({ name: ' ', email: 'x', company: '', message: '' })).toEqual({
      name: 'Please enter your name.', email: 'Enter a valid email address.', message: 'Please write a message.',
    });
  });
  it('limits', () => {
    const e = validateAll({ name: 'a'.repeat(121), email: 'a@b.co', company: 'c'.repeat(161), message: 'm'.repeat(5001) });
    expect(Object.keys(e).sort()).toEqual(['company', 'message', 'name']);
  });
});
