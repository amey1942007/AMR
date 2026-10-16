'use client';

import { useMemo, useSyncExternalStore } from 'react';
import { SetPasswordForm } from './SetPasswordForm';

const noop = () => () => {};

export function SetPasswordPage() {
  const search = useSyncExternalStore(noop, () => window.location.search, () => '');
  const params = useMemo(() => new URLSearchParams(search), [search]);
  return <SetPasswordForm tokenHash={params.get('token_hash')} type={params.get('type')} />;
}
