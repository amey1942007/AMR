import type { ContactPayload } from '../types';
import { validateAll } from '@/lib/validate';

export const THROTTLE_KEY = 'amr_contact_last';
export const THROTTLE_SEC = 30;
export const TIMEOUT_MS = 10_000;

export interface KV { getItem(k: string): string | null; setItem(k: string, v: string): void }
const memory = new Map<string, string>();
const memKV: KV = { getItem: (k) => memory.get(k) ?? null, setItem: (k, v) => void memory.set(k, v) };
export function defaultKV(): KV {
  try {
    if (typeof localStorage !== 'undefined') return localStorage;
  } catch {}
  return memKV;
}

/** Seconds remaining before another submit is allowed (0 = allowed). */
export function throttleRemaining(kv: KV, now = Date.now()): number {
  const last = Number(kv.getItem(THROTTLE_KEY) || 0);
  const left = Math.ceil((last + THROTTLE_SEC * 1000 - now) / 1000);
  return left > 0 ? left : 0;
}
export function markSent(kv: KV, now = Date.now()) {
  kv.setItem(THROTTLE_KEY, String(now));
}

/** Server-side-equivalent validation inside every adapter (the UI may be bypassed). */
export function isValidPayload(p: ContactPayload) {
  return Object.keys(validateAll({ name: p.name ?? '', email: p.email ?? '', company: p.company ?? '', message: p.message ?? '' })).length === 0;
}

/** Trim + clamp to the DB check constraints (brief §15). */
export function normalise(p: ContactPayload) {
  return {
    name: p.name.trim(),
    email: p.email.trim(),
    company: p.company?.trim() || null,
    message: p.message.trim(),
    source: (p.source ?? 'home-drawer').slice(0, 100),
    page_url: p.page_url?.slice(0, 2048) ?? null,
    user_agent: p.user_agent?.slice(0, 512) ?? null,
  };
}

/** Rejects anything that isn't a browser-safe publishable key (sb_secret_*, service_role JWTs). */
export function isPublishableKey(key: string) {
  if (!key || /^sb_secret_/i.test(key)) return false;
  if (/^sb_publishable_/.test(key)) return true;
  const parts = key.split('.');
  if (parts.length === 3) {
    try {
      const json = JSON.parse(atob(parts[1].replace(/-/g, '+').replace(/_/g, '/')));
      return json.role === 'anon';
    } catch {
      return false;
    }
  }
  return false;
}

export function withTimeout<T>(p: Promise<T>, ms = TIMEOUT_MS): Promise<T> {
  return new Promise((res, rej) => {
    const t = setTimeout(() => rej(new Error('timeout')), ms);
    p.then((v) => { clearTimeout(t); res(v); }, (e) => { clearTimeout(t); rej(e); });
  });
}
