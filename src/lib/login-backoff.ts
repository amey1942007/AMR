/**
 * login-spec §1.4 client backoff (UX courtesy only; Supabase Auth enforces the real limits). Only failure timestamps
 * are stored (sessionStorage `amr-login-fails`): never an email or password.
 */
export interface KV { get(k: string): string | null; set(k: string, v: string): void }
const KEY = 'amr-login-fails';
const WINDOW = 10 * 60_000;
const STEPS = [30, 60, 120];

export function sessionKV(): KV {
  try {
    const s = window.sessionStorage;
    return { get: (k) => s.getItem(k), set: (k, v) => s.setItem(k, v) };
  } catch {
    const m = new Map<string, string>();
    return { get: (k) => m.get(k) ?? null, set: (k, v) => void m.set(k, v) };
  }
}

const read = (kv: KV, now: number): number[] => {
  try { return (JSON.parse(kv.get(KEY) ?? '[]') as number[]).filter((t) => typeof t === 'number' && now - t < WINDOW); } catch { return []; }
};

/** Records a failure; returns the wait in seconds now in force (0 below 5 failures). */
export function recordFailure(kv: KV, now = Date.now()): number {
  const fails = [...read(kv, now), now];
  kv.set(KEY, JSON.stringify(fails));
  return backoffRemaining(kv, now);
}

/** 5 failures in 10 min → 30 s, the 6th → 60 s, the 7th and later → 120 s, counted from the latest failure. */
export function backoffRemaining(kv: KV, now = Date.now()): number {
  const fails = read(kv, now);
  if (fails.length < 5) return 0;
  const step = STEPS[Math.min(fails.length - 5, STEPS.length - 1)];
  const left = Math.ceil((fails[fails.length - 1] + step * 1000 - now) / 1000);
  return Math.max(0, left);
}

export function clearFailures(kv: KV) { kv.set(KEY, '[]'); }
