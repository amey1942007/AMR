'use client';
import type { ChangeEvent } from 'react';

export const TOPICS = ['General', 'Pilot / demo', 'Partnership', 'Investment', 'Press', 'Careers', 'Other'] as const;
export type Topic = (typeof TOPICS)[number];

/** Native <select> styled like the inputs (default / focus / error). */
export function TopicSelect({ value, onChange, error, disabled }: { value: string; onChange: (v: string) => void; error?: string; disabled?: boolean }) {
  return (
    <div className="flex flex-col gap-2">
      <label htmlFor="cf-topic" className="text-[length:var(--text-small)] text-white">Topic<span aria-hidden> *</span></label>
      <select id="cf-topic" name="topic" value={value} disabled={disabled} aria-required aria-invalid={error ? true : undefined} aria-describedby={error ? 'cf-topic-err' : undefined}
        onChange={(e: ChangeEvent<HTMLSelectElement>) => onChange(e.target.value)}
        className={`h-12 w-full appearance-none rounded-[var(--radius-input)] border bg-[#0d0d12] bg-[url('data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22white%22 stroke-width=%222%22><path d=%22m6 9 6 6 6-6%22/></svg>')] bg-[length:14px] bg-[right_14px_center] bg-no-repeat px-[14px] text-white outline-none hover:border-white/40 focus:border-magenta ${error ? 'border-danger' : 'border-[var(--line-dark)]'}`}>
        <option value="">Choose a topic</option>
        {TOPICS.map((t) => <option key={t} value={t}>{t}</option>)}
      </select>
      {error && <p id="cf-topic-err" className="text-[length:var(--text-small)] text-danger">{error}</p>}
    </div>
  );
}
