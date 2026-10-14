'use client';
import { usePathname } from 'next/navigation';
import { getLenis } from '@/lib/lenis-ref';

/**
 * First focusable element. Jumps past the 3D journey to #info and MOVES FOCUS there (review #7): Lenis would
 * otherwise swallow the native hash jump, and focus must follow the visual jump for keyboard/AT users.
 */
export function SkipLink() {
  const home = usePathname() === '/';
  return (
    <a
      href="#info"
      onClick={(e) => {
        const t = document.getElementById('info');
        if (!t) return;
        e.preventDefault();
        const l = getLenis();
        if (l) l.scrollTo(t, { immediate: true, force: true }); else t.scrollIntoView();
        t.focus({ preventScroll: true });
        history.replaceState(null, '', '#info');
      }}
      className="sr-only-focusable fixed top-3 left-3 rounded-full bg-white px-4 py-3 text-ink"
      style={{ zIndex: 100 }}
    >
      {home ? 'Skip to robot info' : 'Skip to content'}
    </a>
  );
}
