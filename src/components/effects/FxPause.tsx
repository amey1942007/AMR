'use client';
import { useEffect, useRef } from 'react';

/**
 * login-spec §0 pause rules, as one tiny island: `data-hidden` on <html> while the tab is hidden, and `fx-off` on the
 * nearest [data-fx-host] (or the parent) while it is off-screen. The effects themselves are CSS only.
 */
export function FxPause() {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const sync = () => document.documentElement.toggleAttribute('data-hidden', document.hidden);
    sync();
    document.addEventListener('visibilitychange', sync);
    const host = ref.current?.closest<HTMLElement>('[data-fx-host]') ?? ref.current?.parentElement;
    let io: IntersectionObserver | undefined;
    if (host && typeof IntersectionObserver !== 'undefined') {
      io = new IntersectionObserver(([e]) => host.classList.toggle('fx-off', !e.isIntersecting));
      io.observe(host);
    }
    return () => { document.removeEventListener('visibilitychange', sync); io?.disconnect(); };
  }, []);
  return <span ref={ref} hidden />;
}
