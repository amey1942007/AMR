/** Client for the `operator-auth` edge function (username allowlist login). */

export type OperatorStatus =
  | { status: 'ok'; username: string; displayName?: string; needsPassword: boolean; email?: string }
  | { status: 'invalid' | 'network' | 'unavailable' | 'forbidden' | 'disabled'; reason?: string };

export type OperatorEmail =
  | { status: 'ok'; email: string; needsPassword: boolean }
  | { status: 'invalid' | 'network' | 'unavailable' };

export type OperatorClaim =
  | { status: 'ok'; email: string }
  | { status: 'invalid' | 'network' | 'unavailable'; reason?: string };

type CachedOp = { email: string; needsPassword: boolean; displayName?: string; at: number };

const CACHE_TTL_MS = 10 * 60_000;
const memCache = new Map<string, CachedOp>();

function cacheKey(supabaseUrl: string, username: string) {
  return `${supabaseUrl.replace(/\/$/, '')}|${username}`;
}

function readCache(supabaseUrl: string, username: string): CachedOp | null {
  const key = cacheKey(supabaseUrl, username);
  const hit = memCache.get(key);
  if (hit && Date.now() - hit.at < CACHE_TTL_MS) return hit;
  if (typeof sessionStorage === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(`amr-op:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as CachedOp;
    if (!parsed?.email || Date.now() - parsed.at >= CACHE_TTL_MS) return null;
    memCache.set(key, parsed);
    return parsed;
  } catch {
    return null;
  }
}

function writeCache(supabaseUrl: string, username: string, value: Omit<CachedOp, 'at'>) {
  const entry: CachedOp = { ...value, at: Date.now() };
  const key = cacheKey(supabaseUrl, username);
  memCache.set(key, entry);
  if (typeof sessionStorage === 'undefined') return;
  try { sessionStorage.setItem(`amr-op:${key}`, JSON.stringify(entry)); } catch { /* quota */ }
}

function fnUrl(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/operator-auth`;
}

async function post(
  supabaseUrl: string,
  key: string,
  body: Record<string, unknown>,
): Promise<{ ok: boolean; data: Record<string, unknown>; http: number }> {
  const res = await fetch(fnUrl(supabaseUrl), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      apikey: key,
      Authorization: `Bearer ${key}`,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(12_000),
  });
  let data: Record<string, unknown> = {};
  try { data = await res.json() as Record<string, unknown>; } catch { /* empty */ }
  return { ok: res.ok, data, http: res.status };
}

export async function operatorStatus(supabaseUrl: string, key: string, username: string): Promise<OperatorStatus> {
  try {
    const { data, http } = await post(supabaseUrl, key, { action: 'status', username });
    if (http >= 500) return { status: 'network' };
    if (data.status === 'ok') {
      const email = typeof data.email === 'string' ? data.email : undefined;
      const needsPassword = Boolean(data.needsPassword);
      const displayName = typeof data.displayName === 'string' ? data.displayName : undefined;
      if (email) writeCache(supabaseUrl, String(data.username ?? username), { email, needsPassword, displayName });
      return {
        status: 'ok',
        username: String(data.username ?? username),
        displayName,
        needsPassword,
        email,
      };
    }
    if (data.status === 'unavailable') return { status: 'unavailable' };
    return { status: 'invalid' };
  } catch {
    return { status: 'network' };
  }
}

export async function operatorEmail(supabaseUrl: string, key: string, username: string): Promise<OperatorEmail> {
  const cached = readCache(supabaseUrl, username);
  if (cached) return { status: 'ok', email: cached.email, needsPassword: cached.needsPassword };
  try {
    const { data, http } = await post(supabaseUrl, key, { action: 'email', username });
    if (http >= 500) return { status: 'network' };
    if (data.status === 'ok' && typeof data.email === 'string') {
      const needsPassword = Boolean(data.needsPassword);
      writeCache(supabaseUrl, username, { email: data.email, needsPassword });
      return { status: 'ok', email: data.email, needsPassword };
    }
    return { status: 'invalid' };
  } catch {
    return { status: 'network' };
  }
}

/** First login / forced reset: set password for an allowlisted username, then sign in. */
export async function operatorClaim(
  supabaseUrl: string,
  key: string,
  username: string,
  password: string,
): Promise<OperatorClaim> {
  try {
    const { data, http } = await post(supabaseUrl, key, { action: 'claim', username, password });
    if (http >= 500) return { status: 'network' };
    if (data.status === 'ok' && typeof data.email === 'string') {
      writeCache(supabaseUrl, username, { email: data.email, needsPassword: false });
      return { status: 'ok', email: data.email };
    }
    if (data.status === 'unavailable') return { status: 'unavailable' };
    return { status: 'invalid', reason: typeof data.reason === 'string' ? data.reason : undefined };
  } catch {
    return { status: 'network' };
  }
}

export function normalizeUsername(raw: string): string {
  return raw.trim().toLowerCase();
}

export function isUsernameShape(u: string): boolean {
  return /^[a-z][a-z0-9_]{1,31}$/.test(u);
}
