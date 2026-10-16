'use client';
import Link from '@/components/nav/AppLink';
import { usePathname } from 'next/navigation';
import { useLayoutEffect, useState } from 'react';
import { Dialog } from '@/components/ui/Dialog';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';
import { ControlPanelLink } from './ControlPanelLink';
import { navItems, EMAIL, REPO_URL } from '@/lib/content';
import { useUI, uiRefs } from '@/lib/ui-store';
import {
  menuExitDurationMs,
  menuPhaseForOpen,
  MENU_EXIT_FALLBACK_PAD_MS,
  shouldSettleMenuExit,
  transitionEndMs,
} from './menu-motion';

const linkCls =
  'menu-link inline-flex items-center gap-3 font-display font-bold tracking-[-0.03em] leading-none text-[length:var(--text-menu)] min-h-11';

function prefersReducedMotion() {
  return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

export function MenuOverlay() {
  const open = useUI((s) => s.dialog === 'menu');
  const closeDialog = useUI((s) => s.closeDialog);
  const openDialog = useUI((s) => s.openDialog);
  const pathname = usePathname();
  // True from open until the exit has settled, so a close can animate and a later close can too.
  const [hold, setHold] = useState(false);
  const reduced = prefersReducedMotion();
  if (open && !hold) setHold(true);
  if (!open && reduced && hold) setHold(false);
  const phase = menuPhaseForOpen(hold ? 'closing' : 'closed', open, reduced);

  useLayoutEffect(() => {
    if (phase !== 'closing') return;
    const root = document.getElementById('menu-overlay');
    let settled = false;
    const settle = () => {
      if (settled) return;
      settled = true;
      setHold(false);
    };
    if (!root) {
      const t = window.setTimeout(settle, 0);
      return () => window.clearTimeout(t);
    }
    const lineEnds = Array.from(root.querySelectorAll<HTMLElement>('.menu-line')).map((el) =>
      transitionEndMs(getComputedStyle(el), 'transform'),
    );
    const measured = Math.max(transitionEndMs(getComputedStyle(root), 'opacity'), ...lineEnds, 0);
    // Never settle before the designed exit. A short computed read (styles not flushed) must not clip it.
    const expected = Math.max(measured, menuExitDurationMs(navItems.length));
    const started = performance.now();
    const onEnd = (event: Event) => {
      const el = event.target;
      if (!(el instanceof Element)) return;
      const onPanel = el === root;
      const onLine = el.classList.contains('menu-line');
      if (!onPanel && !onLine) return;
      if (event.type === 'transitionend') {
        const name = (event as TransitionEvent).propertyName;
        if (onPanel && name !== 'opacity') return;
        if (onLine && name !== 'transform') return;
      }
      if (!shouldSettleMenuExit(performance.now() - started, expected)) return;
      settle();
    };
    root.addEventListener('transitionend', onEnd);
    root.addEventListener('animationend', onEnd);
    const timer = window.setTimeout(settle, expected + MENU_EXIT_FALLBACK_PAD_MS);
    return () => {
      root.removeEventListener('transitionend', onEnd);
      root.removeEventListener('animationend', onEnd);
      window.clearTimeout(timer);
    };
  }, [phase]);

  if (phase === 'closed') return null;

  return (
    <Dialog id="menu-overlay" open={open} closing={phase === 'closing'} onClose={closeDialog} labelledBy="menu-title" returnFocus={() => uiRefs.menuButton} initialFocus={() => document.querySelector<HTMLElement>('#menu-overlay nav a, #menu-overlay nav button')} className="menu-panel text-white" style={{ ['--menu-count' as string]: String(navItems.length) }}>
      <div className="absolute inset-0" style={{ background: 'var(--overlay)', backdropFilter: 'blur(16px)' }} />
      <div className="relative flex h-full flex-col">
        {/* Mirror of the top bar so the close control sits at the identical position (ui-spec §3.1). */}
        <div className="flex h-[var(--nav-h)] items-center justify-between px-[var(--gutter)]">
          <Logo />
          <MenuButton open onClick={closeDialog} />
        </div>
        <h2 id="menu-title" className="sr-only">Site menu</h2>
        <nav aria-label="Site" className="mx-auto flex w-full max-w-[var(--content-max)] flex-1 flex-col justify-center px-[var(--gutter)]">
          <ul className="flex flex-col gap-2">
            {navItems.map((item, i) => (
              <li key={item.label} className="overflow-hidden">
                <span className="menu-line" style={{ ['--i' as string]: i }}>
                  {'href' in item ? (
                    <Link href={item.href} className={linkCls} aria-current={pathname === item.href || pathname === item.href.replace(/\/$/, '') ? 'page' : undefined} onClick={closeDialog}>
                      <span aria-hidden className="menu-bar bg-grad inline-block h-1" />
                      {item.label}
                    </Link>
                  ) : (
                    <button type="button" className={linkCls} onClick={() => openDialog('contact', uiRefs.menuButton)}>
                      <span aria-hidden className="menu-bar bg-grad inline-block h-1" />
                      {item.label}
                    </button>
                  )}
                </span>
              </li>
            ))}
          </ul>
          <div className="mt-10 lg:hidden">
            <ControlPanelLink />
          </div>
        </nav>
        <div className="flex gap-6 px-[var(--gutter)] pb-8 text-[length:var(--text-small)] text-muted">
          <a href={`mailto:${EMAIL}`} className="inline-flex min-h-11 items-center hover:text-white">{EMAIL}</a>
          <a href={REPO_URL} target="_blank" rel="noopener noreferrer" className="inline-flex min-h-11 items-center hover:text-white">
            GitHub<span className="sr-only"> (opens in new tab)</span>
          </a>
        </div>
      </div>
    </Dialog>
  );
}
