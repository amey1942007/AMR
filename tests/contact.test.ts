import { readFileSync } from 'node:fs';
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
  it('mock is impossible in production (→ mailto / supabase)', () => {
    expect(resolveContactAdapter({ adapter: 'mock', nodeEnv: 'production' })).toBe('mailto');
    expect(resolveContactAdapter({ adapter: 'mock', nodeEnv: 'production', supabaseUrl: 'u', supabaseKey: 'k' })).toBe('supabase');
  });
  it('explicit env wins in dev', () => expect(resolveContactAdapter({ adapter: 'mock', nodeEnv: 'development' })).toBe('mock'));
  it('.env.example never selects mock', () => {
    const env = readFileSync('.env.example', 'utf8');
    expect(env).not.toMatch(/^NEXT_PUBLIC_CONTACT_ADAPTER=\s*mock/m);
  });
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

import { createSupabaseContact } from '@/services/adapters/contact.supabase';
import { createHttpContact } from '@/services/adapters/contact.http';
import { isPublishableKey } from '@/services/adapters/contact.shared';

const jwt = (role: string) => `x.${btoa(JSON.stringify({ role })).replace(/=+$/, '')}.y`;
describe('supabase adapter hardening', () => {
  const url = 'https://abc.supabase.co';
  it('accepts publishable/anon keys only', () => {
    expect(isPublishableKey('sb_publishable_abc')).toBe(true);
    expect(isPublishableKey(jwt('anon'))).toBe(true);
    expect(isPublishableKey('sb_secret_abc')).toBe(false);
    expect(isPublishableKey(jwt('service_role'))).toBe(false);
    expect(createSupabaseContact({ url, key: 'sb_secret_x' }).isAvailable()).toBe(false);
  });
  it('validates inside submit (no insert on invalid)', async () => {
    let calls = 0;
    const s = createSupabaseContact({ url, key: 'sb_publishable_x', kv: kv(), insert: async () => { calls++; return { error: null }; } });
    expect((await s.submit({ name: '', email: 'bad', message: '' })).status).toBe('error');
    expect(calls).toBe(0);
  });
  it('inserts normalised row, then throttles', async () => {
    const rows: unknown[] = [];
    const s = createSupabaseContact({ url, key: 'sb_publishable_x', kv: kv(), insert: async (r) => { rows.push(r); return { error: null }; } });
    expect((await s.submit({ name: ' A ', email: 'a@b.co', message: ' hi ' })).status).toBe('ok');
    expect(rows[0]).toMatchObject({ name: 'A', message: 'hi', company: null, source: 'home-drawer' });
    expect((await s.submit(p)).status).toBe('throttled');
  });
  it('times out after the limit', async () => {
    const s = createSupabaseContact({ url, key: 'sb_publishable_x', kv: kv(), timeoutMs: 20, insert: () => new Promise(() => {}) });
    expect((await s.submit(p)).status).toBe('error');
  });
  it('inserts the row and does not select it back', () => {
    const src = readFileSync('src/services/adapters/contact.supabase.ts', 'utf8');
    const code = src
      .replace(/\/\*[\s\S]*?\*\//g, '')
      .split('\n')
      .filter((line) => !line.trim().startsWith('//'))
      .join('\n');
    expect(code).toMatch(/\.insert\(row\)/);
    expect(code).not.toMatch(/\.select\s*\(/);
  });
  it('db error → error', async () => {
    const s = createSupabaseContact({ url, key: 'sb_publishable_x', kv: kv(), insert: async () => ({ error: { message: 'x' } }) });
    expect((await s.submit(p)).status).toBe('error');
  });
});

describe('http adapter', () => {
  const res = (status: number, h: Record<string, string> = {}) => new Response(null, { status, headers: h });
  it('unavailable without endpoint', () => expect(createHttpContact().isAvailable()).toBe(false));
  it('2xx ok, 429 throttled, 500 error', async () => {
    expect((await createHttpContact({ endpoint: '/api', kv: kv(), fetchImpl: async () => res(200) }).submit(p)).status).toBe('ok');
    expect(await createHttpContact({ endpoint: '/api', kv: kv(), fetchImpl: async () => res(429, { 'retry-after': '12' }) }).submit(p)).toEqual({ status: 'throttled', retryInSec: 12 });
    expect((await createHttpContact({ endpoint: '/api', kv: kv(), fetchImpl: async () => res(500) }).submit(p)).status).toBe('error');
  });
});

import { mockMapData } from '@/services/adapters/mapdata.mock';
import { mockContent } from '@/services/adapters/content.mock';
import { staticContent } from '@/services/adapters/content.static';
describe('service mocks', () => {
  it('map mock is 100×70 × 3 layers', async () => expect((await mockMapData.loadReveal()).length).toBe(100 * 70 * 3));
  it('content getLinks', async () => {
    expect((await mockContent.getLinks()).length).toBeGreaterThan(0);
    expect((staticContent.getLinks() as readonly { id: string }[]).map((l) => l.id)).toEqual(['github', 'demo', 'control', 'contact', 'email']);
  });
});
