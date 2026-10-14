'use client';
import { useRef, useState, type ChangeEvent } from 'react';

const Eye = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" />
  </svg>
);
const EyeOff = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M17.94 17.94A10.07 10.07 0 0 1 12 19c-6.5 0-10-7-10-7a18.45 18.45 0 0 1 5.06-5.94" />
    <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c6.5 0 10 7 10 7a18.5 18.5 0 0 1-2.16 3.19" />
    <path d="M14.12 14.12a3 3 0 1 1-4.24-4.24" /><path d="m1 1 22 22" />
  </svg>
);
const Warn = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" /><path d="M12 9v4" /><path d="M12 17h.01" />
  </svg>
);

const inputCls = 'w-full rounded-[var(--radius-input)] border bg-white/[.04] px-[14px] pr-12 text-white placeholder:text-muted outline-none transition-colors hover:border-white/40 focus:border-magenta h-12';

/** login-spec §1.3: show/hide toggle + Caps Lock hint. Reverts to hidden on submit via `revealed` reset from the parent. */
export function PasswordField({ id = 'login-password', value, onChange, error, readOnly, revealed, onRevealChange }: {
  id?: string; value: string; onChange: (v: string) => void; error?: string; readOnly?: boolean; revealed: boolean; onRevealChange: (v: boolean) => void;
}) {
  const [caps, setCaps] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const errId = `${id}-err`, capsId = `${id}-caps`;
  const described = [error ? errId : '', caps ? capsId : ''].filter(Boolean).join(' ') || undefined;

  function toggle() {
    const el = inputRef.current;
    const start = el?.selectionStart ?? null, end = el?.selectionEnd ?? null;
    onRevealChange(!revealed);
    // Restore cursor + focus after the type flip (login-spec §1.3).
    queueMicrotask(() => { el?.focus(); if (el && start != null && end != null) el.setSelectionRange(start, end); });
  }
  function onKey(e: React.KeyboardEvent<HTMLInputElement>) {
    try { setCaps(e.getModifierState('CapsLock')); } catch { /* jsdom */ }
  }

  return (
    <div className="flex flex-col gap-2">
      <label htmlFor={id} className="text-[length:var(--text-small)] text-white">Password<span aria-hidden> *</span></label>
      <div className="relative">
        <input
          ref={inputRef} id={id} name="password" type={revealed ? 'text' : 'password'} autoComplete="current-password"
          value={value} readOnly={readOnly} onChange={(e: ChangeEvent<HTMLInputElement>) => onChange(e.target.value)}
          onKeyDown={onKey} onKeyUp={onKey} onBlur={() => setCaps(false)}
          aria-required aria-invalid={error ? true : undefined} aria-describedby={described}
          className={`${inputCls} ${error ? 'border-danger' : 'border-[var(--line-dark)]'}`}
        />
        <button
          type="button" onClick={toggle} aria-pressed={revealed} aria-controls={id}
          aria-label={revealed ? 'Hide password' : 'Show password'}
          className="absolute right-1 top-1 grid size-10 place-items-center rounded-full text-white/70 hover:text-white"
        >
          {revealed ? <EyeOff /> : <Eye />}
        </button>
      </div>
      {caps && (
        <p id={capsId} aria-live="polite" className="flex items-center gap-1.5 text-[length:var(--text-small)] text-white">
          <Warn /> Caps Lock is on.
        </p>
      )}
      {error && <p id={errId} className="text-[length:var(--text-small)] text-danger">{error}</p>}
    </div>
  );
}
