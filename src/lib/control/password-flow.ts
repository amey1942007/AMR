import { getAuthClient } from '@/services/supabase-client';
import { SET_PASSWORD_REDIRECT } from './access';

export type OtpType = 'invite' | 'recovery';

export async function sendPasswordReset(url: string, key: string, email: string) {
  const client = await getAuthClient(url, key);
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), { redirectTo: SET_PASSWORD_REDIRECT });
  return error;
}

export async function verifySetPasswordLink(url: string, key: string, tokenHash: string, type: OtpType) {
  const client = await getAuthClient(url, key);
  const { error } = await client.auth.verifyOtp({ token_hash: tokenHash, type });
  return error;
}

export async function saveNewPassword(url: string, key: string, password: string) {
  const client = await getAuthClient(url, key);
  const { error } = await client.auth.updateUser({ password });
  if (error) return { error, marked: false };
  const { error: markError } = await client.rpc('mark_password_set');
  return { error: markError, marked: !markError };
}

/** Active operators include themselves in `operator_names()`. */
export async function userIsActiveOperator(url: string, key: string, userId: string): Promise<'yes' | 'no' | 'unknown'> {
  try {
    const client = await getAuthClient(url, key);
    const { data, error } = await client.rpc('operator_names');
    if (error) return 'unknown';
    const rows = Array.isArray(data) ? data : [];
    return rows.some((r) => r && typeof r === 'object' && (r as { user_id?: string }).user_id === userId) ? 'yes' : 'no';
  } catch {
    return 'unknown';
  }
}
