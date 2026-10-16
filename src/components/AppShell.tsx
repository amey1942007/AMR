'use client';
import dynamic from 'next/dynamic';
import { useEffect, useState, type ReactNode } from 'react';
import { usePathname } from 'next/navigation';
import { ServicesProvider } from '@/components/providers/ServicesProvider';
import { SkipLink } from '@/components/nav/SkipLink';
import { TopBar } from '@/components/nav/TopBar';
import { Toast } from '@/components/feedback/Toast';
import { useUI } from '@/lib/ui-store';

// Dialogs are code-split and mounted on first use (then kept for exit transitions).
const MenuOverlay = dynamic(() => import('@/components/nav/MenuOverlay').then((m) => m.MenuOverlay), { ssr: false });
const ContactDrawer = dynamic(() => import('@/components/contact/ContactDrawer').then((m) => m.ContactDrawer), { ssr: false });

function LazyDialogs() {
  const dialog = useUI((s) => s.dialog);
  const [menu, setMenu] = useState(false);
  const [contact, setContact] = useState(false);
  useEffect(() => {
    // Mount on first open; prefetch both on idle so the first open is instant.
    if (dialog === 'menu' && !menu) queueMicrotask(() => setMenu(true));
    if (dialog === 'contact' && !contact) queueMicrotask(() => setContact(true));
  }, [dialog, menu, contact]);
  useEffect(() => {
    const go = () => { import('@/components/nav/MenuOverlay'); import('@/components/contact/ContactDrawer'); };
    const id = window.setTimeout(() => (typeof requestIdleCallback === 'function' ? requestIdleCallback(go, { timeout: 4000 }) : go()), 2500);
    return () => clearTimeout(id);
  }, []);
  return (
    <>
      {menu && <MenuOverlay />}
      {contact && <ContactDrawer />}
    </>
  );
}

function operatorRoute(path: string) {
  return /^\/(control|sign-in|set-password|login)(\/|$)/.test(path);
}

export function AppShell({ children }: { children: ReactNode }) {
  const operator = operatorRoute(usePathname() || '');
  return (
    <ServicesProvider>
      <SkipLink />
      {!operator && <TopBar />}
      <main id="main">{children}</main>
      {!operator && <Toast />}
      {!operator && <LazyDialogs />}
    </ServicesProvider>
  );
}
