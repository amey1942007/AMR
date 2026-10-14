'use client';
import { useUI } from '@/lib/ui-store';
import { EMAIL } from '@/lib/content';

export function CopyEmail() {
  const showToast = useUI((s) => s.showToast);
  return (
    <span className="flex flex-wrap items-center gap-3">
      <a className="inline-flex min-h-11 items-center text-white underline-offset-4 hover:underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>
      <button type="button" className="eyebrow inline-flex min-h-11 items-center rounded-full border border-white/30 px-4 text-white hover:border-white"
        onClick={() => navigator.clipboard?.writeText(EMAIL).then(() => showToast('Copied'), () => showToast(EMAIL))}>Copy</button>
    </span>
  );
}
