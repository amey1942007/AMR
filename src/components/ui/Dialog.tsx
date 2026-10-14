'use client';
import { useEffect, useRef, type ReactNode } from 'react';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Background regions made inert while any dialog is open (ui-spec §6.4). */
const BACKGROUND_IDS = ['site-header', 'main'];

interface DialogProps {
  open: boolean;
  onClose: () => void;
  labelledBy: string;
  id?: string;
  className?: string;
  /** Element to focus on open; defaults to the first focusable. */
  initialFocus?: () => HTMLElement | null;
  /** Element to focus after close (the opener). */
  returnFocus?: () => HTMLElement | null;
  children: ReactNode;
}

/**
 * Shared modal primitive: role=dialog, aria-modal, focus trap (wraps), Esc closes, background inert,
 * scroll lock, focus return. Stays mounted so CSS exit transitions can run; inert + hidden when closed.
 */
export function Dialog({ open, onClose, labelledBy, id, className, initialFocus, returnFocus, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!open) return;
    const root = ref.current!;
    const bg = BACKGROUND_IDS.map((i) => document.getElementById(i)).filter(Boolean) as HTMLElement[];
    bg.forEach((el) => el.setAttribute('inert', ''));
    const prevOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden'; // lenis.stop() joins this in M1
    const t = window.setTimeout(() => {
      const target = initialFocus?.() ?? root.querySelector<HTMLElement>(FOCUSABLE);
      target?.focus();
    }, 30);

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onCloseRef.current();
        return;
      }
      if (e.key !== 'Tab') return;
      const items = Array.from(root.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement,
      );
      if (!items.length) return;
      const first = items[0], last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    };
    document.addEventListener('keydown', onKey);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', onKey);
      bg.forEach((el) => el.removeAttribute('inert'));
      document.documentElement.style.overflow = prevOverflow;
      // Defer so a dialog opened by this close (Menu → Contact) can claim focus first.
      window.setTimeout(() => {
        if (!document.querySelector('[role="dialog"][data-open="true"]')) returnFocus?.()?.focus();
      }, 0);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  return (
    <div
      ref={ref}
      id={id}
      role="dialog"
      aria-modal="true"
      aria-labelledby={labelledBy}
      data-open={open}
      inert={!open}
      aria-hidden={!open}
      className={`dlg-root ${className ?? ''}`}
      style={{ zIndex: 'var(--z-dialog)' as unknown as number }}
    >
      {children}
    </div>
  );
}
