import Link from 'next/link';
import { COMPANY_NAME } from '@/lib/content';
/** Placeholder logo (brief §16 / D5). Swap for inline public/brand/logo.svg (currentColor) once picked. */
export function Logo({ height = 28 }: { height?: number }) {
  return (
    <Link href="/" aria-label={`${COMPANY_NAME} home`} className="logo-link inline-flex min-h-11 items-center gap-1 text-current">
      <span aria-hidden className="font-display font-extrabold tracking-[-0.04em] leading-none" style={{ fontSize: height * 1.1 }}>
        {COMPANY_NAME}
      </span>
      <span aria-hidden className="logo-dot bg-grad inline-block size-2 rounded-full" />
    </Link>
  );
}
