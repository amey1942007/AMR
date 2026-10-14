'use client';
import { forwardRef } from 'react';
export const MenuButton = forwardRef<HTMLButtonElement, { open: boolean; onClick: () => void }>(function MenuButton({ open, onClick }, ref) {
  return (
    <button
      ref={ref}
      type="button"
      onClick={onClick}
      aria-expanded={open}
      aria-controls="menu-overlay"
      aria-label={open ? 'Close menu' : 'Open menu'}
      className="relative grid size-11 place-items-center rounded-full border border-current/40"
    >
      <span aria-hidden className="relative block h-[6px] w-4">
        <span className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ease-[var(--ease-io)] ${open ? 'top-[3px] rotate-45' : 'top-0'}`} />
        <span className={`absolute left-0 h-px w-4 bg-current transition-transform duration-300 ease-[var(--ease-io)] ${open ? 'top-[3px] -rotate-45' : 'top-[6px]'}`} />
      </span>
    </button>
  );
});
