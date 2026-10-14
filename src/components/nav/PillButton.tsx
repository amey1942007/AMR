'use client';
import { asset } from '@/lib/asset';
import type { MouseEvent, ReactNode } from 'react';
import { ArrowRight, ExternalLink } from '@/components/icons';
import { Spinner } from '@/components/feedback/Spinner';

interface Props {
  kind: 'filled' | 'ghost';
  href?: string;
  onClick?: (e: MouseEvent<HTMLElement>) => void;
  icon?: 'arrow' | 'external';
  loading?: boolean;
  disabled?: boolean;
  type?: 'button' | 'submit';
  className?: string;
  ariaLabel?: string;
  children: ReactNode;
}

// Internal hrefs go through asset(): a raw <a> doesn't get Next's basePath (GitHub Pages /AMR).
export function PillButton({ kind, href, onClick, icon, loading, disabled, type = 'button', className = '', ariaLabel, children }: Props) {
  const cls = `pill pill-${kind} relative inline-flex h-11 min-w-11 items-center justify-center gap-2 rounded-full px-5 text-[length:var(--text-button)] font-medium tracking-[0.02em] whitespace-nowrap disabled:cursor-not-allowed disabled:opacity-40 ${
    kind === 'filled' ? 'text-white' : 'border border-current/40'
  } ${className}`;
  const inner = (
    <>
      <span className={`inline-flex items-center gap-2 ${loading ? 'invisible' : ''}`}>
        {children}
        {icon === 'arrow' && <ArrowRight className="pill-arrow" />}
        {icon === 'external' && (
          <>
            <ExternalLink />
            <span className="sr-only">(opens in new tab)</span>
          </>
        )}
      </span>
      {loading && (
        <span className="absolute inset-0 grid place-items-center">
          <Spinner />
          <span className="sr-only">Sending…</span>
        </span>
      )}
    </>
  );
  if (href) {
    const ext = icon === 'external';
    return (
      <a href={!ext && href.startsWith('/') && !href.startsWith('//') ? asset(href) : href} onClick={onClick} className={cls} aria-label={ariaLabel} {...(ext ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
        {inner}
      </a>
    );
  }
  return (
    <button type={type} onClick={onClick} className={cls} disabled={disabled || loading} aria-busy={loading || undefined} aria-label={ariaLabel}>
      {inner}
    </button>
  );
}
