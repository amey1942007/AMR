'use client';
import type { ReactNode } from 'react';
import { ServicesProvider } from '@/components/providers/ServicesProvider';
import { SkipLink } from '@/components/nav/SkipLink';
import { TopBar } from '@/components/nav/TopBar';
import { MenuOverlay } from '@/components/nav/MenuOverlay';
import { ContactDrawer } from '@/components/contact/ContactDrawer';
import { Toast } from '@/components/feedback/Toast';

export function AppShell({ children }: { children: ReactNode }) {
  return (
    <ServicesProvider>
      <SkipLink />
      <TopBar />
      <main id="main">{children}</main>
      <Toast />
      <MenuOverlay />
      <ContactDrawer />
    </ServicesProvider>
  );
}
