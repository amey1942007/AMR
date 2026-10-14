'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import { PillButton } from '@/components/nav/PillButton';
import { Check } from '@/components/icons';
import { validateAll, validateField, MESSAGE_MAX, type ContactFields, type FieldErrors } from '@/lib/validate';
import { defaultKV, throttleRemaining } from '@/services/adapters/contact.shared';
import { EMAIL } from '@/lib/content';

const EMPTY: ContactFields = { name: '', email: '', company: '', message: '' };
type Phase = 'idle' | 'sending' | 'success' | 'error';

const inputCls =
  'w-full rounded-[var(--radius-input)] border bg-white/[.04] px-[14px] text-white placeholder:text-muted outline-none transition-colors hover:border-white/40 focus:border-magenta';

export function ContactForm({ source = 'home-drawer' }: { source?: string }) {
  const { contact } = useServices();
  const [f, setF] = useState<ContactFields>(EMPTY);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [phase, setPhase] = useState<Phase>('idle');
  const [wait, setWait] = useState(0);
  const honeypot = useRef<HTMLInputElement>(null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    const tick = () => setWait(throttleRemaining(defaultKV()));
    const first = window.setTimeout(tick, 0);
    const id = window.setInterval(tick, 1000);
    return () => { window.clearTimeout(first); window.clearInterval(id); };
  }, [phase]);

  const set = (k: keyof ContactFields) => (e: { target: { value: string } }) => {
    const v = e.target.value;
    dirty.current.add(k);
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: validateField(k, v) }));
  };
  // Blur-validate only fields the user has typed in: validating an untouched empty field on blur shifts the
  // layout under the pointer (error text pushes the submit button) and swallows the submit click.
  const dirty = useRef(new Set<keyof ContactFields>());
  const blur = (k: keyof ContactFields) => () => {
    if (dirty.current.has(k)) setErrors((p) => ({ ...p, [k]: validateField(k, f[k]) }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase === 'sending') return;
    const errs = validateAll(f);
    setErrors(errs);
    const firstBad = (Object.keys(errs) as (keyof ContactFields)[])[0];
    if (firstBad) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstBad}"]`)?.focus();
      return;
    }
    setPhase('sending');
    const res = await contact.submit({
      ...f,
      website: honeypot.current?.value,
      source,
      page_url: window.location.href,
      user_agent: navigator.userAgent,
    });
    if (res.status === 'ok') setPhase('success');
    else if (res.status === 'throttled') { setWait(res.retryInSec ?? 30); setPhase('idle'); }
    else setPhase('error');
  }

  if (phase === 'success') {
    return (
      <div role="status" className="flex min-h-[420px] flex-col items-start justify-center gap-6">
        <p className="flex items-center gap-3 text-white">
          <Check size={24} style={{ color: 'var(--success)' }} />
          Thanks. We&apos;ll reply from {EMAIL}.
        </p>
        <PillButton kind="ghost" onClick={() => { setF(EMPTY); setErrors({}); dirty.current.clear(); setPhase('idle'); }}>Send another</PillButton>
      </div>
    );
  }

  const busy = phase === 'sending';
  const field = (k: keyof ContactFields, label: string, required: boolean, extra: Record<string, unknown> = {}, area = false) => {
    const id = `cf-${k}`, errId = `${id}-err`, err = errors[k];
    const common = {
      id, name: k, value: f[k], onChange: set(k), onBlur: blur(k), readOnly: busy,
      'aria-required': required || undefined, 'aria-invalid': err ? true : undefined,
      'aria-describedby': err ? errId : undefined,
      className: `${inputCls} ${err ? 'border-danger' : 'border-[var(--line-dark)]'} ${area ? 'min-h-[140px] resize-y py-3' : 'h-12'}`,
      ...extra,
    };
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-[length:var(--text-small)] text-white">
          {label}{required && <span aria-hidden> *</span>}
        </label>
        {area ? <textarea {...common} /> : <input {...common} />}
        {k === 'message' && f.message.length >= 4500 && (
          <span className="eyebrow self-end text-muted">{f.message.length} / {MESSAGE_MAX}</span>
        )}
        {err && <p id={errId} className="text-[length:var(--text-small)] text-danger">{err}</p>}
      </div>
    );
  };

  return (
    <form ref={formRef} noValidate onSubmit={onSubmit} aria-busy={busy || undefined} className="relative flex flex-col gap-4">
      {field('name', 'Name', true, { autoComplete: 'name', maxLength: 200 })}
      {field('email', 'Email', true, { autoComplete: 'email', type: 'email', inputMode: 'email' })}
      {field('company', 'Company', false, { autoComplete: 'organization' })}
      {field('message', 'Message', true, {}, true)}
      <div aria-hidden style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="cf-website">Website</label>
        <input ref={honeypot} id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {phase === 'error' && (
        <p role="alert" className="border-l-2 border-danger pl-3 text-[length:var(--text-small)] text-white">
          Couldn&apos;t send. Email <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>
        </p>
      )}
      <PillButton kind="filled" type="submit" icon="arrow" loading={busy} disabled={wait > 0} className="w-full">
        Send message
      </PillButton>
      {wait > 0 && <p className="text-[length:var(--text-small)] text-muted">You can send another message in {wait} s.</p>}
    </form>
  );
}
