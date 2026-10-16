'use client';

import { useEffect } from 'react';
import { asset } from '@/lib/asset';

/** Old reset stub. Forgot-password now lives on the sign-in card. */
export function ResetRedirect() {
  useEffect(() => { window.location.replace(asset('/sign-in/?forgot=1')); }, []);
  return <p><a href={asset('/sign-in/?forgot=1')}>Continue to password reset</a></p>;
}
