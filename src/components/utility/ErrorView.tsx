'use client';
import { useEffect, useRef } from 'react';
import { UtilityLayout } from './UtilityLayout';
import { PillButton } from '@/components/nav/PillButton';

const isChunkError = (e: Error) => /ChunkLoadError|Loading chunk|Failed to fetch dynamically imported module|importing a module script failed/i.test(`${e.name} ${e.message}`);

/** login-spec §3 "Signal lost": runtime render errors / failed chunk loads. Shows only the digest, never the stack. */
export function ErrorView({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  const h1 = useRef<HTMLHeadingElement>(null);
  useEffect(() => { h1.current?.focus(); document.title = 'Error | AMR'; }, []);
  const retry = () => (isChunkError(error) ? window.location.reload() : reset());
  return (
    <UtilityLayout effects={['flatline']} showFooter shortHide={false}>
      <div className="flex flex-col items-center text-center">
        <p className="eyebrow text-muted">ERROR · SIGNAL LOST</p>
        <h1 ref={h1} tabIndex={-1} className="mt-4 font-display text-[length:var(--text-display)] font-bold leading-[0.9] tracking-[-0.04em] outline-none">Something went wrong.</h1>
        <p role="alert" className="mt-6 max-w-[48ch] text-white/80">The page hit an error. Try again, and if it keeps happening, let us know.</p>
        <div className="mt-8 flex flex-wrap justify-center gap-3 max-md:w-full max-md:flex-col">
          <PillButton kind="filled" onClick={retry}>Try again</PillButton>
          <PillButton kind="ghost" href="/">Back to home</PillButton>
        </div>
        {error.digest && (
          <details className="mt-6 text-[length:var(--text-small)] text-muted">
            <summary className="cursor-pointer">Technical details</summary>
            <p className="mt-2 font-mono">Error ID: {error.digest}</p>
          </details>
        )}
      </div>
    </UtilityLayout>
  );
}
