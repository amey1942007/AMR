'use client';
import type { MouseEvent } from 'react';
import { Logo } from './Logo';
import { PillButton } from './PillButton';
import { MenuButton } from './MenuButton';
import { Mail } from '@/components/icons';
import { useUI, uiRefs } from '@/lib/ui-store';
import { useServices } from '@/components/providers/ServicesProvider';
import { usePathname } from 'next/navigation';
import { useScene } from '@/lib/store';

/** Fixed top bar. Home: theme from the scroll store (navDark at p ≥ .18, hysteresis). Sub-pages are dark. */
export function TopBar() {
  const { config } = useServices();
  const navDark = useScene((s) => s.navDark);
  const theme = usePathname() === '/' && !navDark ? 'light' : 'dark';
  const dialog = useUI((s) => s.dialog);
  const openDialog = useUI((s) => s.openDialog);
  const closeDialog = useUI((s) => s.closeDialog);
  const showToast = useUI((s) => s.showToast);
  const onContact = (e: MouseEvent<HTMLElement>) => openDialog('contact', e.currentTarget);
  const fg = theme === 'dark' ? 'var(--paper)' : 'var(--ink)';

  return (
    <header id="site-header" className="fixed inset-x-0 top-0" style={{ zIndex: 50, color: fg, transition: 'color var(--dur-theme) var(--ease-io)' }}>
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[calc(var(--nav-h)+40px)]" style={{ background: 'linear-gradient(var(--bg) 0, transparent)', opacity: theme === 'dark' ? 0.6 : 0, transition: 'opacity var(--dur-theme) var(--ease-io)' }} />
      <div className="relative flex h-[var(--nav-h)] items-center justify-between px-[var(--gutter)]">
        <Logo />
        <nav aria-label="Primary" className="flex items-center gap-3">
          <span className="hidden lg:contents">
          {config.controlPanelUrl ? (
            <PillButton kind="ghost" href={config.controlPanelUrl} icon="external">
              Control panel
            </PillButton>
          ) : (
            <PillButton kind="ghost" onClick={() => showToast('Live control panel: coming soon')}>
              Control panel
            </PillButton>
          )}
          </span>
          <span className="hidden sm:contents">
            <PillButton kind="filled" icon="arrow" onClick={onContact}>Contact us</PillButton>
          </span>
          <span className="contents sm:hidden">
            <PillButton kind="filled" onClick={onContact} ariaLabel="Contact us" className="w-11 !px-0">
              <Mail />
            </PillButton>
          </span>
          <MenuButton
            ref={(el) => { uiRefs.menuButton = el; }}
            open={dialog === 'menu'}
            onClick={() => (dialog === 'menu' ? closeDialog() : openDialog('menu', uiRefs.menuButton))}
          />
        </nav>
      </div>
    </header>
  );
}
