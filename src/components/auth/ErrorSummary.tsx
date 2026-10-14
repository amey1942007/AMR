'use client';
import { forwardRef } from 'react';

/** Shared error summary (login-spec §1.4 / contact form). Focused on failed submit. */
export const ErrorSummary = forwardRef<HTMLDivElement, { errors: { field: string; id: string; msg: string }[]; title?: string }>(
  function ErrorSummary({ errors, title }, ref) {
    if (!errors.length && !title) return null;
    return (
      <div ref={ref} tabIndex={-1} role="alert" aria-live="assertive" className="rounded-[var(--radius-input)] border border-danger/60 p-4 text-[length:var(--text-small)] outline-none focus-visible:outline-2">
        <p className="font-semibold text-white">{title ?? `Please fix ${errors.length === 1 ? 'this field' : `these ${errors.length} fields`}:`}</p>
        {errors.length > 0 && <ul className="mt-2 list-disc pl-5">{errors.map((e) => <li key={e.field}><a className="text-danger underline" href={`#${e.id}`}>{e.msg}</a></li>)}</ul>}
      </div>
    );
  },
);
