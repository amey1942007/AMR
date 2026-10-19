'use client';

import { useEffect } from 'react';
import { asset } from '@/lib/asset';

/** Old reset stub. Password help is now “email amey / admin” on sign-in. */
export function ResetRedirect() {
  useEffect(() => { window.location.replace(asset('/sign-in/')); }, []);
  return <p><a href={asset('/sign-in/')}>Continue to sign in</a></p>;
}
