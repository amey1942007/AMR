'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from '@/components/nav/AppLink';
import { useRouter } from 'next/navigation';
import { useServices } from '@/components/providers/ServicesProvider';
import { PillButton } from '@/components/nav/PillButton';
import { PasswordField } from './PasswordField';
import { ErrorSummary } from './ErrorSummary';
import { EMAIL_RE } from '@/lib/validate';
import { backoffRemaining, clearFailures, recordFailure, sessionKV } from '@/lib/login-backoff';

const inputCls = 'w-full rounded-[var(--radius-input)] border bg-white/[.04] px-[14px] text-white placeholder:text-muted outline-none transition-colors hover:border-white/40 focus:border-magenta h-12';

type Phase = 'idle' | 'loading' | 'invalid' | 'rate' | 'network' | 'success';

function validateEmail(v: string) {
  const t = v.trim();
  if (!t) return 'Enter your email address.';
  if (t.length > 254 || !EMAIL_RE.test(t)) return 'Enter a valid email address.';
}
function validatePassword(v: string) {
  if (!v) return 'Enter your password.';
  if (v.length > 128) return 'Enter your password.';
}

/** login-spec §1.3–1.4. Never logs credentials. Clears the password on success, failure and unmount. */
export function LoginForm({ redirectTarget }: { redirectTarget: string }) {
  const { auth } = useServices();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [eErr, setEErr] = useState<string>();
  const [pErr, setPErr] = useState<string>();
  const [summary, setSummary] = useState(false);
  const [phase, setPhase] = useState<Phase>('idle');
  const [msg, setMsg] = useState('');
  const [wait, setWait] = useState(0);
  const [desktop, setDesktop] = useState(false);
  const summaryRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const kv = useRef(sessionKV());

  useEffect(() => {
    const mq = matchMedia('(min-width: 768px)');
    const sync = () => setDesktop(mq.matches);
    sync(); mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);
  useEffect(() => { setWait(backoffRemaining(kv.current)); }, []);
  useEffect(() => {
    if (wait <= 0) return;
    const id = window.setInterval(() => setWait(backoffRemaining(kv.current)), 1000);
    return () => clearInterval(id);
  }, [wait]);
  useEffect(() => { if (summary) summaryRef.current?.focus(); }, [summary, eErr, pErr, msg]);
  // Review login #3: the network/unavailable alert takes focus like the other error states.
  const netRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (phase === 'network') netRef.current?.focus(); }, [phase, msg]);
  useEffect(() => () => { setPassword(''); }, []); // clear on unmount (login-spec §1.8)

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    if (phase === 'loading' || wait > 0) return;
    const ee = validateEmail(email), pe = validatePassword(password);
    setEErr(ee); setPErr(pe);
    if (ee || pe) {
      setSummary(true);
      setMsg('');
      return;
    }
    setSummary(false); setMsg(''); setRevealed(false); setPhase('loading');
    const res = await auth.signIn({ email, password });
    if (res.status === 'ok') {
      clearFailures(kv.current);
      setPassword('');
      setPhase('success');
      // Internal paths: client navigation (keeps the in-memory mock session); external allow-listed URLs: full load.
      const go = () => (redirectTarget.startsWith('/') ? router.replace(redirectTarget) : window.location.assign(redirectTarget));
      window.setTimeout(go, 300);
      return;
    }
    setPassword('');
    if (res.status === 'invalid') {
      setPhase('invalid');
      setMsg('Email or password is incorrect.');
      setPErr('Email or password is incorrect.');
      setSummary(true);
      setWait(recordFailure(kv.current));
      queueMicrotask(() => document.getElementById('login-password')?.focus());
    } else if (res.status === 'rate_limited') {
      const sec = res.retryAfterSec ?? 300;
      setPhase('rate');
      setMsg(`Too many attempts. Try again in ${Math.ceil(sec / 60)} minute${sec >= 120 ? 's' : ''}.`);
      setWait(Math.max(sec, recordFailure(kv.current)));
      setSummary(true);
    } else if (res.status === 'unavailable') {
      setPhase('network');
      setMsg("Sign-in isn't available yet.");
    } else {
      setPhase('network');
      setMsg("Couldn't reach the sign-in service. Check your connection and try again.");
    }
  }

  const busy = phase === 'loading';
  const errs = [
    eErr ? { field: 'email', id: 'login-email', msg: eErr } : null,
    pErr ? { field: 'password', id: 'login-password', msg: pErr } : null,
  ].filter(Boolean) as { field: string; id: string; msg: string }[];

  return (
    <form method="post" action="#" noValidate autoComplete="on" onSubmit={onSubmit} aria-busy={busy || undefined} aria-label="Sign in" className="flex flex-col gap-5">
      {(summary && (errs.length > 0 || msg)) && (
        <ErrorSummary ref={summaryRef} errors={errs} title={errs.length ? undefined : msg} />
      )}
      {phase === 'success' && <p role="status" className="text-[length:var(--text-small)] text-success">Signed in. Redirecting…</p>}
      <div className="flex flex-col gap-2">
        <label htmlFor="login-email" className="text-[length:var(--text-small)] text-white">Email<span aria-hidden> *</span></label>
        <input
          id="login-email" name="email" type="email" autoComplete="username" inputMode="email" autoCapitalize="off" spellCheck={false}
          autoFocus={desktop} value={email} readOnly={busy}
          onChange={(e) => { setEmail(e.target.value); if (eErr) setEErr(validateEmail(e.target.value)); }}
          onBlur={() => setEErr(validateEmail(email))}
          aria-required aria-invalid={eErr ? true : undefined} aria-describedby={eErr ? 'login-email-err' : undefined}
          className={`${inputCls} ${eErr ? 'border-danger' : 'border-[var(--line-dark)]'}`}
        />
        {eErr && <p id="login-email-err" className="text-[length:var(--text-small)] text-danger">{eErr}</p>}
      </div>
      <PasswordField value={password} onChange={(v) => { setPassword(v); if (pErr) setPErr(validatePassword(v)); }} error={pErr} readOnly={busy} revealed={revealed} onRevealChange={setRevealed} />
      {phase === 'network' && (
        <div role="alert" tabIndex={-1} ref={netRef} className="flex flex-col items-start gap-2 outline-none border-l-2 border-danger pl-3 text-[length:var(--text-small)] text-white">
          <p>{msg}</p>
          <button type="submit" className="underline">Try again</button>
        </div>
      )}
      <PillButton kind="filled" type="submit" icon="arrow" loading={busy} disabled={wait > 0 || phase === 'success'} className="w-full">
        {busy ? 'Signing in…' : 'Sign in'}
      </PillButton>
      {busy && <p role="status" className="sr-only">Signing in…</p>}
      {wait > 0 && phase !== 'success' && (
        <p className="text-[length:var(--text-small)] text-muted">Try again in {wait} s.</p>
      )}
      <div className="flex items-center justify-between text-[length:var(--text-small)]">
        <Link href="/login/reset/" className="text-white/70 underline hover:text-white">Forgot password?</Link>
        <Link href="/" className="text-white/70 underline hover:text-white">Back to site</Link>
      </div>
      <p className="font-mono text-[0.7rem] text-muted">Access is limited to authorised users.</p>
    </form>
  );
}

/** Shown when the adapter is `none` / misconfigured (login-spec §1.4 `unavailable`). */
export function LoginUnavailable() {
  return (
    <div className="flex flex-col items-center gap-6 text-center">
      <p className="text-white/80">Sign-in isn&apos;t available yet.</p>
      <PillButton kind="ghost" href="/">Back to site</PillButton>
    </div>
  );
}
