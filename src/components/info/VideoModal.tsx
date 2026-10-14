'use client';
import { Dialog } from '@/components/ui/Dialog';
import { Close } from '@/components/icons';
export function VideoModal({ open, onClose, opener, src, poster }: { open: boolean; onClose: () => void; opener: HTMLElement | null; src: string; poster?: string }) {
  return (
    <Dialog open={open} onClose={onClose} labelledBy="video-title" returnFocus={() => opener} className="grid place-items-center bg-[rgba(5,5,7,.9)] p-[var(--gutter)]">
      <div className="w-full max-w-[1100px]">
        <div className="mb-4 flex items-center justify-between text-white">
          <h2 id="video-title" className="text-[length:var(--text-h3)] font-semibold">Demo video</h2>
          <button type="button" onClick={onClose} aria-label="Close video" className="grid size-11 place-items-center rounded-full border border-white/40"><Close /></button>
        </div>
        {open && <video className="aspect-video w-full rounded-[12px] bg-black" src={src} poster={poster} controls preload="none" />}
      </div>
    </Dialog>
  );
}
