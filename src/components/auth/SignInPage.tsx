'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import { redirectTarget } from '@/lib/redirect';
import { SignInForm } from './SignInForm';

const noop = () => () => {};

export function SignInPage() {
  const { config } = useServices();
  const search = useSyncExternalStore(noop, () => window.location.search, () => '');
  const params = useMemo(() => new URLSearchParams(search), [search]);
  const target = useMemo(
    () => redirectTarget({ next: params.get('next'), controlPanelUrl: config.controlPanelUrl, allowlist: config.authRedirectAllowlist }),
    [params, config],
  );
  return <SignInForm redirectTarget={target} startForgot={params.get('forgot') === '1'} />;
}
