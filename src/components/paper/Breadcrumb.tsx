import Link from '@/components/nav/AppLink';

export interface Crumb { label: string; href?: string }
const SITE = (process.env.NEXT_PUBLIC_SITE_URL || 'https://amrslam.tech') + (process.env.NEXT_PUBLIC_BASE_PATH || '');

/** `Home / Robots / AMR4`: last item is the current page (not a link). Emits BreadcrumbList JSON-LD. */
export function Breadcrumb({ items }: { items: Crumb[] }) {
  const ld = {
    '@context': 'https://schema.org',
    '@type': 'BreadcrumbList',
    itemListElement: items.map((c, i) => ({ '@type': 'ListItem', position: i + 1, name: c.label, ...(c.href ? { item: SITE + c.href } : {}) })),
  };
  return (
    <nav aria-label="Breadcrumb" className="eyebrow text-muted">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(ld) }} />
      <ol className="flex flex-wrap items-center gap-2">
        {items.map((c, i) => {
          const last = i === items.length - 1;
          return (
            <li key={c.label} className="flex items-center gap-2">
              {last || !c.href ? (
                <span aria-current={last ? 'page' : undefined} className="text-white">{c.label}</span>
              ) : (
                <Link href={c.href} className="crumb-link inline-flex min-h-6 items-center hover:text-white">{c.label}</Link>
              )}
              {!last && <span aria-hidden>/</span>}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
