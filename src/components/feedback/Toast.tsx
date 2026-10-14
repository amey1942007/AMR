'use client';
import { useEffect, useState } from 'react';
import { useUI } from '@/lib/ui-store';

/** Single polite live region, always mounted. Re-trigger resets the timer (no stacking). */
export function Toast({ duration = 3000 }: { duration?: number }) {
  const toast = useUI((s) => s.toast);
  const [shownKey, setShownKey] = useState<number | null>(null);
  useEffect(() => {
    if (!toast) return;
    const show = window.setTimeout(() => setShownKey(toast.key), 0);
    const hide = window.setTimeout(() => setShownKey(null), duration);
    return () => { window.clearTimeout(show); window.clearTimeout(hide); };
  }, [toast, duration]);
  const visible = toast !== null && shownKey === toast.key;
  return (
    <div role="status" aria-live="polite" className="pointer-events-none fixed inset-x-0 bottom-6" style={{ zIndex: 60 }}>
      <div data-show={visible} className="toast glass absolute left-1/2 rounded-full px-5 py-3 text-[length:var(--text-small)] text-white">
        {visible ? toast?.message : ''}
      </div>
    </div>
  );
}
