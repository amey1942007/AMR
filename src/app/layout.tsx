import type { Metadata, Viewport } from 'next';
import './globals.css';
import { unbounded, interTight, jetbrains } from './fonts';
import { AppShell } from '@/components/AppShell';
import { asset } from '@/lib/asset';
import { copy, COMPANY_NAME, EMAIL, FOUNDER, REPO_URL } from '@/lib/content';

const site = (process.env.NEXT_PUBLIC_SITE_URL || 'https://amrslam.tech') + (process.env.NEXT_PUBLIC_BASE_PATH || '');

export const metadata: Metadata = {
  metadataBase: new URL(site),
  title: copy.metaTitle,
  description: copy.metaDescription,
  alternates: { canonical: '/' },
  icons: { icon: asset('/favicon.svg') },
  openGraph: { title: copy.metaTitle, description: copy.metaDescription, url: '/', siteName: 'amrslam.tech', type: 'website' },
  twitter: { card: 'summary_large_image', title: copy.metaTitle, description: copy.metaDescription },
};
export const viewport: Viewport = { themeColor: '#050507', width: 'device-width', initialScale: 1 };

const jsonLd = {
  '@context': 'https://schema.org',
  '@type': 'Organization',
  name: COMPANY_NAME,
  url: site,
  email: EMAIL,
  founder: { '@type': 'Person', name: FOUNDER },
  sameAs: [REPO_URL],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${unbounded.variable} ${interTight.variable} ${jetbrains.variable}`}>
      <body>
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
