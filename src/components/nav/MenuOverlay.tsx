'use client';
import Link from '@/components/nav/AppLink';
import { usePathname } from 'next/navigation';
import { Dialog } from '@/components/ui/Dialog';
import { Logo } from './Logo';
import { MenuButton } from './MenuButton';
import { ControlPanelLink } from './ControlPanelLink';
import { navItems, EMAIL, REPO_URL } from '@/lib/content';
import { useUI, uiRefs } from '@/lib/ui-store';

const linkCls =
  'menu-link inline-flex items-center gap-3 font-display font-bold tracking-[-0.03em] leading-none text-[length:var(--text-menu)] min-h-11';

export function MenuOverlay() {
  const open = useUI((s) => s.dialog === 'menu');
  const closeDialog = useUI((s) => s.closeDialog);
  const openDialog = useUI((s) => s.openDialog);
  const pathname = usePathname();

  return (
    <Dialog id="menu-overlay" open={open} onClose={closeDialog} labelledBy="menu-title" returnFocus={() => uiRefs.menuButton} initialFocus={() => document.querySelector<HTMLElement>('#menu-overlay nav a, #menu-overlay nav button')} className="menu-panel text-white">
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
