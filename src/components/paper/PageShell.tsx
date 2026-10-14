import type { ReactNode } from 'react';
import Link from '@/components/nav/AppLink';
import { Footer } from '@/components/info/Footer';
import { PageMotion } from './PageMotion';

/** Subpage frame: content column + footer + light motion. AppShell (TopBar dark on subpages, <main>) wraps it. */
export function PageShell({ header, children }: { header: ReactNode; children: ReactNode }) {
  return (
    <>
      <PageMotion />
      {header}
      <div id="info" tabIndex={-1} className="mx-auto max-w-[var(--content-max)] px-[var(--gutter)] pb-[var(--section-gap)] text-white outline-none">{children}</div>
      <Footer />
    </>
  );
}

export function Cta({ text = 'Want a demo or a pilot?' }: { text?: string }) {
  return (
    <section aria-labelledby="cta-h" className="reveal-in mt-16 flex flex-col items-center gap-6 rounded-[var(--radius-card)] border border-[var(--line-dark)] px-6 py-16 text-center">
      <h2 id="cta-h" className="text-[length:var(--text-h3)] font-semibold">{text}</h2>
      <Link href="/contact/" className="pill pill-filled inline-flex h-11 items-center rounded-full px-6 text-[length:var(--text-button)] font-medium text-white">Contact us</Link>
    </section>
  );
}

export const meta = (path: string, title: string, description: string) => ({
  title, description,
  alternates: { canonical: path },
  openGraph: { title, description, url: path, siteName: 'amrslam.tech', type: 'website' as const, images: [{ url: '/og.png', width: 1200, height: 630 }] },
  twitter: { card: 'summary_large_image' as const, title, description, images: ['/og.png'] },
});
