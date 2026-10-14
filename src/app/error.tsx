'use client';
import dynamic from 'next/dynamic';

// Code-split: the "Signal lost" view loads only when an error actually happens (keeps it out of every page's shell).
// If even that chunk fails to load (offline / failed deploy), the plain fallback still offers a reload.
const ErrorView = dynamic(() => import('@/components/utility/ErrorView').then((m) => m.ErrorView), {
  ssr: false,
  loading: () => (
    <div className="grid min-h-[60vh] place-items-center px-[var(--gutter)] text-center text-white">
      <div>
        <h1 className="text-[length:var(--text-h3)] font-semibold">Something went wrong.</h1>
        <button type="button" className="mt-6 underline" onClick={() => window.location.reload()}>Try again</button>
      </div>
    </div>
  ),
});

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return <ErrorView error={error} reset={reset} />;
}
