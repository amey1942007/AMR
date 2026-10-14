'use client';
import { useEffect, useState } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import type { Session } from '@/services/types';

/** login-spec §1.6: {session, status} for /control. */
export function useAuth() {
  const { auth } = useServices();
  const [session, setSession] = useState<Session | null>(null);
  const [status, setStatus] = useState<'loading' | 'signed_in' | 'signed_out'>('loading');
  useEffect(() => {
    let live = true;
    auth.getSession().then((s) => { if (!live) return; setSession(s); setStatus(s ? 'signed_in' : 'signed_out'); });
    const un = auth.onChange((s) => { setSession(s); setStatus(s ? 'signed_in' : 'signed_out'); });
    return () => { live = false; un(); };
  }, [auth]);
  return { session, status, signOut: () => auth.signOut() };
}
