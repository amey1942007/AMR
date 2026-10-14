'use client';
import { useEffect, useRef } from 'react';
/**
 * Root-layout failures (review login #7): fully self-contained. No providers, no UtilityLayout, no app CSS: the
 * root layout has failed, so nothing from the shell can be assumed. Renders its own <html>, noindex.
 */
export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); }, []);
  const chunk = /ChunkLoadError|Loading chunk|dynamically imported module/i.test(`${error.name} ${error.message}`);
  const btn = { padding: '12px 22px', borderRadius: 999, border: '1px solid #fff', background: '#fff', color: '#050507', font: 'inherit', cursor: 'pointer' } as const;
  return (
    <html lang="en">
      <head><meta name="robots" content="noindex, nofollow" /><title>Error | AMR</title></head>
      <body style={{ margin: 0, minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#050507', color: '#fff', fontFamily: 'system-ui, sans-serif', textAlign: 'center' }}>
        <main id="main" style={{ padding: 24 }}>
          <p style={{ letterSpacing: '.12em', fontSize: 12, color: '#9a97a6' }}>ERROR · SIGNAL LOST</p>
          <h1 ref={h1} tabIndex={-1} style={{ fontSize: 'clamp(36px, 6vw, 72px)', margin: '16px 0', outline: 'none' }}>Something went wrong.</h1>
          <p role="alert" style={{ maxWidth: '48ch', margin: '0 auto 32px', opacity: 0.8 }}>The page hit an error. Try again, and if it keeps happening, let us know.</p>
          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button type="button" style={btn} onClick={() => (chunk ? window.location.reload() : reset())}>Try again</button>
            {/* a full reload is intended: the app shell (and the router) failed */}
            <a href={`${process.env.NEXT_PUBLIC_BASE_PATH ?? ''}/`} style={{ ...btn, background: 'transparent', color: '#fff', textDecoration: 'none' }}>Back to home</a>
          </div>
          {error.digest && <p style={{ marginTop: 24, fontSize: 12, color: '#9a97a6', fontFamily: 'monospace' }}>Error ID: {error.digest}</p>}
        </main>
      </body>
    </html>
  );
}
