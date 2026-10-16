'use client';
import { asset } from '@/lib/asset';
import { useEffect, useState, type ReactNode } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import { SignalLoader } from '@/components/utility/SignalLoader';

/** login-spec §1.1: client-only guard for /control (UX, not security). Redirects to /login/?next=… without a session. */
export function AuthGuard({ children }: { children: ReactNode }) {
  const { auth } = useServices();
  const [ready, setReady] = useState(false);
  const [ok, setOk] = useState(false);
  useEffect(() => {
    let live = true;
    auth.getSession().then((s) => {
      if (!live) return;
      if (!s) {
        // next is router-relative (no basePath): the login page navigates with router.replace, which adds it back.
        const base = process.env.NEXT_PUBLIC_BASE_PATH ?? '';
        const path = base && window.location.pathname.startsWith(base) ? window.location.pathname.slice(base.length) || '/' : window.location.pathname;
        const next = encodeURIComponent(path + window.location.search);
        (document as unknown as { activeViewTransition?: { skipTransition(): void } }).activeViewTransition?.skipTransition();
        window.location.replace(asset(`/sign-in/?next=${next}`));
        return;
      }
      setOk(true); setReady(true);
    });
    return () => { live = false; };
  }, [auth]);
  if (!ready) return <div className="grid min-h-[40vh] place-items-center"><SignalLoader /></div>;
  if (!ok) return null;
  return <>{children}</>;
}
