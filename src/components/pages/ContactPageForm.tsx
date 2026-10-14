'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import { useServices } from '@/components/providers/ServicesProvider';
import { PillButton } from '@/components/nav/PillButton';
import { TopicSelect } from '@/components/paper/TopicSelect';
import { MESSAGE_MAX } from '@/lib/validate';
import { buildMailto, validatePage, type PageErrors, type PageFields } from '@/lib/contact-page';
import { defaultKV, throttleRemaining } from '@/services/adapters/contact.shared';
import { EMAIL } from '@/lib/content';
import Link from '@/components/nav/AppLink';

const EMPTY: PageFields = { name: '', email: '', company: '', topic: '', message: '' };
const LABEL: Record<keyof PageFields, string> = { name: 'Name', email: 'Email', company: 'Company', topic: 'Topic', message: 'Message' };
const ORDER: (keyof PageFields)[] = ['name', 'email', 'company', 'topic', 'message'];
type Phase = 'idle' | 'sending' | 'success' | 'mailto' | 'error' | 'unavailable';
const inputCls = 'w-full rounded-[var(--radius-input)] border bg-white/[.04] px-[14px] text-white placeholder:text-muted outline-none transition-colors hover:border-white/40 focus:border-magenta';

/** ContactForm variant='page' (pages-spec §7): topic → `subject`, source 'contact-page'; mailto when no backend. */
export function ContactPageForm() {
  const { contact } = useServices();
  const mailtoMode = !contact.isAvailable();
  const [f, setF] = useState<PageFields>(EMPTY);
  const [errors, setErrors] = useState<PageErrors>({});
  const [summary, setSummary] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [wait, setWait] = useState(0);
  const [sentName, setSentName] = useState('');
  const honeypot = useRef<HTMLInputElement>(null);
  const doneRef = useRef<HTMLHeadingElement>(null);
  const summaryRef = useRef<HTMLDivElement>(null);
  const errRef = useRef<HTMLParagraphElement>(null);
  // Restore an active throttle from localStorage on load (a reload doesn't reset the 30 s wait).
  useEffect(() => { const id = window.setTimeout(() => setWait(throttleRemaining(defaultKV())), 0); return () => window.clearTimeout(id); }, []);
  const [attempt, setAttempt] = useState(0);
  useEffect(() => { if (attempt) summaryRef.current?.focus(); }, [attempt]);
  useEffect(() => { if (phase === 'error' || phase === 'unavailable') errRef.current?.focus(); }, [phase]);
  useEffect(() => { if (phase === 'success' || phase === 'mailto') doneRef.current?.focus(); }, [phase]);
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait(throttleRemaining(defaultKV())), 1000);
    return () => window.clearInterval(id);
  }, [wait]);

  const set = (k: keyof PageFields) => (v: string) => {
    setF((p) => ({ ...p, [k]: v }));
    if (errors[k]) setErrors((p) => ({ ...p, [k]: validatePage({ ...f, [k]: v })[k] }));
  };

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase === 'sending') return;
    const errs = validatePage(f);
    setErrors(errs);
    if (Object.keys(errs).length) { setSummary(true); setAttempt((n) => n + 1); return; }
    setSummary(false);
    if (honeypot.current?.value) { setSentName(f.name.trim()); setPhase('success'); return; } // silent fake success
    if (mailtoMode) { window.location.href = buildMailto(f); setSentName(f.name.trim()); setPhase('mailto'); return; }
    setPhase('sending');
    const res = await contact.submit({ name: f.name, email: f.email, company: f.company, message: f.message, subject: f.topic, source: 'contact-page', website: honeypot.current?.value, page_url: window.location.href, user_agent: navigator.userAgent });
    if (res.status === 'ok') { setSentName(f.name.trim()); setPhase('success'); }
    else if (res.status === 'throttled') { setWait(res.retryInSec ?? 30); setPhase('idle'); }
    else if (res.status === 'unavailable') setPhase('unavailable');
    else setPhase('error');
  }

  if (phase === 'success' || phase === 'mailto') {
    return (
      <div role="status" className="flex min-h-[360px] flex-col items-start justify-center gap-6">
        <h2 ref={doneRef} tabIndex={-1} className="text-[length:var(--text-h3)] font-semibold text-white outline-none">
          {phase === 'success' ? `Thanks, ${sentName}. We'll reply from ${EMAIL}.` : `Your email app should open with the message ready. If it didn't, email ${EMAIL}.`}
        </h2>
        <PillButton kind="ghost" onClick={() => { setF(EMPTY); setErrors({}); setPhase('idle'); }}>Send another</PillButton>
      </div>
    );
  }

  const busy = phase === 'sending';
  const bad = ORDER.filter((k) => errors[k]);
  const field = (k: 'name' | 'email' | 'company' | 'message', required: boolean, extra: Record<string, unknown> = {}) => {
    const id = `cf-${k}`, errId = `${id}-err`, err = errors[k], area = k === 'message';
    const common = {
      id, name: k, value: f[k], readOnly: busy, onChange: (e: { target: { value: string } }) => set(k)(e.target.value),
      'aria-required': required || undefined, 'aria-invalid': err ? true : undefined, 'aria-describedby': err ? errId : undefined,
      className: `${inputCls} ${err ? 'border-danger' : 'border-[var(--line-dark)]'} ${area ? 'min-h-[180px] resize-y py-3' : 'h-12'}`, ...extra,
    };
    return (
      <div className="flex flex-col gap-2">
        <label htmlFor={id} className="text-[length:var(--text-small)] text-white">{LABEL[k]}{required && <span aria-hidden> *</span>}</label>
        {area ? <textarea {...common} /> : <input {...common} />}
        {area && f.message.length >= 4500 && <span className="eyebrow self-end text-muted">{f.message.length} / {MESSAGE_MAX}</span>}
        {err && <p id={errId} className="text-[length:var(--text-small)] text-danger">{err}</p>}
      </div>
    );
  };
  return (
    <form noValidate onSubmit={onSubmit} aria-busy={busy || undefined} aria-label="Contact form" className="relative flex flex-col gap-5">
      {summary && bad.length > 0 && (
        <div ref={summaryRef} tabIndex={-1} role="alert" className="rounded-[var(--radius-input)] border border-danger/60 p-4 text-[length:var(--text-small)] outline-none focus-visible:outline-2">
          <p className="font-semibold text-white">Please fix {bad.length === 1 ? 'this field' : `these ${bad.length} fields`}:</p>
          <ul className="mt-2 list-disc pl-5">{bad.map((k) => <li key={k}><a className="text-danger underline" href={`#cf-${k}`}>{LABEL[k]}: {errors[k]}</a></li>)}</ul>
        </div>
      )}
      {field('name', true, { autoComplete: 'name', maxLength: 120 })}
      {field('email', true, { autoComplete: 'email', type: 'email', inputMode: 'email' })}
      {field('company', false, { autoComplete: 'organization' })}
      <TopicSelect value={f.topic} onChange={set('topic')} error={errors.topic} disabled={busy} />
      {field('message', true)}
      <div aria-hidden style={{ position: 'absolute', left: -10000, top: 'auto', width: 1, height: 1, overflow: 'hidden' }}>
        <label htmlFor="cf-website">Website</label>
        <input ref={honeypot} id="cf-website" name="website" type="text" tabIndex={-1} autoComplete="off" defaultValue="" />
      </div>
      {(phase === 'error' || phase === 'unavailable') && (
        <p ref={errRef} tabIndex={-1} role="alert" className="border-l-2 border-danger pl-3 text-[length:var(--text-small)] text-white outline-none">
          {phase === 'unavailable' ? 'The message service is unavailable right now.' : 'Couldn’t send: the connection failed or took too long. Try again, or'} email <a className="underline" href={`mailto:${EMAIL}`}>{EMAIL}</a>.
        </p>
      )}
      <PillButton kind="filled" type="submit" icon="arrow" loading={busy} disabled={wait > 0} className="w-full">{mailtoMode ? 'Open email app' : 'Send message'}</PillButton>
      {busy && <p role="status" className="sr-only">Sending…</p>}
      {wait > 0 && <p className="text-[length:var(--text-small)] text-muted">You can send another message in {wait} s.</p>}
      <p className="text-[length:var(--text-small)] text-muted">
        We use your details only to reply to your message.{' '}
        {mailtoMode ? 'Your message is sent by your own email app.' : 'They’re stored securely with our database provider (Supabase, Mumbai ap-south-1 region) and deleted after 12 months.'}{' '}
        See our <Link className="underline hover:text-white" href="/privacy/">Privacy policy</Link>.
      </p>
    </form>
  );
}
