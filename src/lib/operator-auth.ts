/** Client helpers for invite-only username login via the operator-auth Edge Function. */

export type OperatorStatus =
  | { status: 'ok'; username: string; needsPassword: boolean }
  | { status: 'invalid' | 'network' | 'unavailable' };

export type OperatorClaim =
  | { status: 'ok'; email: string }
  | { status: 'invalid' | 'network' | 'unavailable'; reason?: string };

const FN = 'operator-auth';

function fnUrl(supabaseUrl: string) {
  return `${supabaseUrl.replace(/\/$/, '')}/functions/v1/${FN}`;
}

export async function operatorStatus(
  supabaseUrl: string,
  anonKey: string,
  username: string,
): Promise<OperatorStatus> {
  try {
    const r = await fetch(fnUrl(supabaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ action: 'status', username }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as OperatorStatus & { username?: string; needsPassword?: boolean };
    if (j.status === 'ok' && j.username != null) {
      return { status: 'ok', username: j.username, needsPassword: !!j.needsPassword };
    }
    if (j.status === 'unavailable' || j.status === 'network') return { status: j.status };
    return { status: 'invalid' };
  } catch {
    return { status: 'network' };
  }
}

export async function operatorClaim(
  supabaseUrl: string,
  anonKey: string,
  username: string,
  password: string,
): Promise<OperatorClaim> {
  try {
    const r = await fetch(fnUrl(supabaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ action: 'claim', username, password }),
      signal: AbortSignal.timeout(15_000),
    });
    const j = (await r.json()) as OperatorClaim & { email?: string; reason?: string };
    if (j.status === 'ok' && j.email) return { status: 'ok', email: j.email };
    if (j.status === 'unavailable' || j.status === 'network') return { status: j.status };
    return { status: 'invalid', reason: j.reason };
  } catch {
    return { status: 'network' };
  }
}

export async function operatorEmail(
  supabaseUrl: string,
  anonKey: string,
  username: string,
): Promise<{ status: 'ok'; email: string } | { status: 'invalid' | 'network' }> {
  try {
    const r = await fetch(fnUrl(supabaseUrl), {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${anonKey}`,
        apikey: anonKey,
      },
      body: JSON.stringify({ action: 'email', username }),
      signal: AbortSignal.timeout(10_000),
    });
    const j = (await r.json()) as { status?: string; email?: string };
    if (j.status === 'ok' && j.email) return { status: 'ok', email: j.email };
    return { status: 'invalid' };
  } catch {
    return { status: 'network' };
  }
}
