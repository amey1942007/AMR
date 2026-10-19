/** Client for the `operator-auth` edge function (username allowlist login). */

export type OperatorStatus =
  | { status: 'ok'; username: string; displayName?: string; needsPassword: boolean }
  | { status: 'invalid' | 'network' | 'unavailable' | 'forbidden' | 'disabled'; reason?: string };

export type OperatorEmail =
  | { status: 'ok'; email: string; needsPassword: boolean }
  | { status: 'invalid' | 'network' | 'unavailable' };

export type OperatorClaim =
  | { status: 'ok'; email: string }
  | { status: 'invalid' | 'network' | 'unavailable'; reason?: string };

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
      return {
        status: 'ok',
        username: String(data.username ?? username),
        displayName: typeof data.displayName === 'string' ? data.displayName : undefined,
        needsPassword: Boolean(data.needsPassword),
      };
    }
    if (data.status === 'unavailable') return { status: 'unavailable' };
    return { status: 'invalid' };
  } catch {
    return { status: 'network' };
  }
}

export async function operatorEmail(supabaseUrl: string, key: string, username: string): Promise<OperatorEmail> {
  try {
    const { data, http } = await post(supabaseUrl, key, { action: 'email', username });
    if (http >= 500) return { status: 'network' };
    if (data.status === 'ok' && typeof data.email === 'string') {
      return { status: 'ok', email: data.email, needsPassword: Boolean(data.needsPassword) };
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
