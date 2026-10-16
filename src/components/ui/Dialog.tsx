'use client';
import { useEffect, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { getLenis } from '@/lib/lenis-ref';

const FOCUSABLE =
  'a[href],button:not([disabled]),input:not([disabled]):not([tabindex="-1"]),textarea:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';

/** Refcount so a close that opens another dialog (Menu → Contact) does not restore overflow early. */
let scrollLocks = 0;
let savedOverflow = '';
function lockPageScroll() {
  if (scrollLocks === 0) {
    savedOverflow = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    getLenis()?.stop();
  }
  scrollLocks += 1;
}
function unlockPageScroll() {
  if (scrollLocks === 0) return;
  scrollLocks -= 1;
  if (scrollLocks === 0) {
    document.documentElement.style.overflow = savedOverflow;
    getLenis()?.start();
  }
}

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
  /** Exit transition in progress. Keeps the root paintable; `open` is already false (inert, focus returned). */
  closing?: boolean;
  style?: CSSProperties;
  children: ReactNode;
}

/**
 * Shared modal primitive: role=dialog, aria-modal, focus trap (wraps), Esc closes, background inert,
 * scroll lock, focus return. Stays mounted so CSS exit transitions can run; inert + hidden when closed.
 */
export function Dialog({ open, onClose, labelledBy, id, className, initialFocus, returnFocus, closing = false, style, children }: DialogProps) {
  const ref = useRef<HTMLDivElement>(null);
  // `shown` flips one frame after `open` so CSS enter transitions run even when mounted already open (lazy dialogs).
  const [shown, setShown] = useState(false);
  useEffect(() => {
    const r = requestAnimationFrame(() => setShown(open));
    return () => cancelAnimationFrame(r);
  }, [open]);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  // Layout effect: the Escape/Tab handlers and inert background must exist in the same commit that makes the dialog
  // interactive. As a passive effect it could lag a slow (WebGL-heavy) frame, so an early Escape was lost.
  useLayoutEffect(() => {
    // Release the lock as soon as close starts (cleanup below). scrollbar-gutter: stable absorbs the scrollbar.
    if (!open) return;
    lockPageScroll();
    const root = ref.current!;
    const bg = BACKGROUND_IDS.map((i) => document.getElementById(i)).filter(Boolean) as HTMLElement[];
    bg.forEach((el) => el.setAttribute('inert', ''));
    // initialFocus may target lazily loaded content (the form): retry briefly before falling back.
    let tries = 0;
    const focusIn = () => {
      const target = initialFocus?.();
      if (target) return target.focus();
      if (initialFocus && ++tries < 20) { t = window.setTimeout(focusIn, 50); return; }
      root.querySelector<HTMLElement>(FOCUSABLE)?.focus();
    };
    let t = window.setTimeout(focusIn, 30);

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
      unlockPageScroll();
      // Defer so a dialog opened by this close (Menu → Contact) can claim focus first.
      window.setTimeout(() => {
        // Ignore this dialog itself: on a slow frame its inert attribute may not be committed yet, which used to skip
        // the focus return (smoke.spec.ts:32, 'Open menu' not focused after Escape).
        const other = Array.from(document.querySelectorAll<HTMLElement>('[role="dialog"]')).some((d) => d !== root && !d.hasAttribute('inert'));
        if (!other) returnFocus?.()?.focus();
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
      data-open={open && shown}
      data-closing={closing ? 'true' : undefined}
      inert={!open}
      aria-hidden={!open}
      className={`dlg-root ${className ?? ''}`}
      style={{ ...style, zIndex: 'var(--z-dialog)' as unknown as number }}
    >
      {children}
    </div>
  );
}
