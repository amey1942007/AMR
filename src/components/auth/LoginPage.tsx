'use client';
import { useMemo, useSyncExternalStore } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import { UtilityLayout } from '@/components/utility/UtilityLayout';
import { redirectTarget, DEFAULT_TARGET } from '@/lib/redirect';
import { LoginCard } from './LoginCard';

const noop = () => () => {};

export function LoginPage() {
  const { config } = useServices();
  const next = useSyncExternalStore(noop, () => new URLSearchParams(window.location.search).get('next'), () => null);
  const target = useMemo(
    () => (next === null && !config.controlPanelUrl ? DEFAULT_TARGET : redirectTarget({ next, controlPanelUrl: config.controlPanelUrl, allowlist: config.authRedirectAllowlist })),
    [next, config],
  );
  return (
    <UtilityLayout effects={['rings', 'waves']}>
      <div className="flex justify-center"><LoginCard redirectTarget={target} /></div>
    </UtilityLayout>
  );
}
