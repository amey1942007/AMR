'use client';
import { useEffect, useRef, useState, type FormEvent } from 'react';
import Link from '@/components/nav/AppLink';
import { useRouter } from 'next/navigation';
import { useServices } from '@/components/providers/ServicesProvider';
import { PillButton } from '@/components/nav/PillButton';
import { PasswordField } from './PasswordField';
import { ErrorSummary } from './ErrorSummary';
import { backoffRemaining, clearFailures, recordFailure, sessionKV } from '@/lib/login-backoff';
import { readConfig } from '@/lib/config';

const operatorAuth = () => import('@/lib/operator-auth');

const inputCls = 'w-full rounded-[var(--radius-input)] border bg-white/[.04] px-[14px] text-white placeholder:text-muted outline-none transition-colors hover:border-white/40 focus:border-magenta h-12';

type Phase = 'idle' | 'loading' | 'invalid' | 'rate' | 'network' | 'success';
type Step = 'username' | 'password' | 'create';

function validateUsername(v: string) {
  const t = v.trim().toLowerCase();
  if (!t) return 'Enter your username.';
  if (!/^[a-z][a-z0-9_]{1,31}$/.test(t)) return 'Enter a valid username.';
}
function validatePassword(v: string) {
  if (!v) return 'Enter your password.';
  if (v.length < 8) return 'Use at least 8 characters.';
  if (v.length > 128) return 'Enter your password.';
}

/** Invite-only username login: first visit creates a password; later visits sign in. No signup. */
export function LoginForm({ redirectTarget }: { redirectTarget: string }) {
  const { auth } = useServices();
  const cfg = readConfig();
  const [step, setStep] = useState<Step>('username');
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [revealed, setRevealed] = useState(false);
  const [uErr, setUErr] = useState<string>();
  const [pErr, setPErr] = useState<string>();
  const [cErr, setCErr] = useState<string>();
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
  useEffect(() => { if (summary) summaryRef.current?.focus(); }, [summary, uErr, pErr, cErr, msg]);
  const netRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (phase === 'network') netRef.current?.focus(); }, [phase, msg]);
  useEffect(() => () => { setPassword(''); setConfirm(''); }, []);

  function failAuth(kind: 'invalid' | 'rate' | 'network' | 'unavailable', extra?: { retryAfterSec?: number; text?: string }) {
    setPassword('');
    setConfirm('');
    if (kind === 'invalid') {
      setPhase('invalid');
      setMsg(extra?.text ?? 'Username or password is incorrect.');
      setPErr(extra?.text ?? 'Username or password is incorrect.');
      setSummary(true);
      setWait(recordFailure(kv.current));
      queueMicrotask(() => document.getElementById(step === 'create' ? 'login-password' : 'login-password')?.focus());
      return;
    }
    if (kind === 'rate') {
      const sec = extra?.retryAfterSec ?? 300;
      setPhase('rate');
      setMsg(`Too many attempts. Try again in ${Math.ceil(sec / 60)} minute${sec >= 120 ? 's' : ''}.`);
      setWait(Math.max(sec, recordFailure(kv.current)));
      setSummary(true);
      return;
    }
    setPhase('network');
    setMsg(kind === 'unavailable' ? "Sign-in isn't available yet." : "Couldn't reach the sign-in service. Check your connection and try again.");
  }

  async function continueUsername(e: FormEvent) {
    e.preventDefault();
    if (phase === 'loading' || wait > 0) return;
    const ue = validateUsername(username);
    setUErr(ue);
    if (ue) { setSummary(true); return; }
    setSummary(false); setMsg(''); setPhase('loading');

    // Dev mock adapter: no Edge Function — only the demo username is authorised.
    if (auth.name === 'mock') {
      const { MOCK_USERNAME } = await import('@/services/adapters/auth.mock');
      const u = username.trim().toLowerCase();
      await new Promise<void>((r) => setTimeout(r, 200));
      if (u !== MOCK_USERNAME) {
        setPhase('invalid');
        setMsg('This username is not authorised.');
        setUErr('This username is not authorised.');
        setSummary(true);
        setWait(recordFailure(kv.current));
        return;
      }
      setUsername(MOCK_USERNAME);
      setPhase('idle');
      setStep('password');
      return;
    }

    if (!cfg.supabaseUrl || !cfg.supabaseKey) {
      failAuth('unavailable');
      return;
    }
    const { operatorStatus } = await operatorAuth();
    const st = await operatorStatus(cfg.supabaseUrl, cfg.supabaseKey, username.trim().toLowerCase());
    if (st.status !== 'ok') {
      if (st.status === 'network' || st.status === 'unavailable') {
        failAuth(st.status);
        return;
      }
      setPhase('invalid');
      setMsg('This username is not authorised.');
      setUErr('This username is not authorised.');
      setSummary(true);
      setWait(recordFailure(kv.current));
      return;
    }
    setUsername(st.username);
    setPhase('idle');
    setStep(st.needsPassword ? 'create' : 'password');
  }

  async function submitPassword(e: FormEvent) {
    e.preventDefault();
    if (phase === 'loading' || wait > 0) return;
    const isMock = auth.name === 'mock';
    if (!isMock && (!cfg.supabaseUrl || !cfg.supabaseKey)) {
      failAuth('unavailable');
      return;
    }

    if (step === 'create') {
      if (isMock) {
        failAuth('unavailable');
        return;
      }
      const pe = validatePassword(password);
      const ce = !confirm ? 'Confirm your password.' : confirm !== password ? 'Passwords do not match.' : undefined;
      setPErr(pe); setCErr(ce);
      if (pe || ce) { setSummary(true); return; }
      setSummary(false); setMsg(''); setRevealed(false); setPhase('loading');
      const { operatorClaim } = await operatorAuth();
      const claimed = await operatorClaim(cfg.supabaseUrl, cfg.supabaseKey, username, password);
      if (claimed.status !== 'ok') {
        failAuth(claimed.status === 'network' || claimed.status === 'unavailable' ? claimed.status : 'invalid', {
          text: claimed.reason === 'password' ? 'Use at least 8 characters.' : 'Could not set password. Ask an admin.',
        });
        return;
      }
      const res = await auth.signIn({ email: claimed.email, password });
      if (res.status === 'ok') {
        clearFailures(kv.current);
        setPassword(''); setConfirm('');
        setPhase('success');
        const go = () => (redirectTarget.startsWith('/') ? router.replace(redirectTarget) : window.location.assign(redirectTarget));
        window.setTimeout(go, 300);
        return;
      }
      failAuth(res.status === 'rate_limited' ? 'rate' : res.status === 'unavailable' ? 'unavailable' : res.status === 'network' ? 'network' : 'invalid',
        res.status === 'rate_limited' ? { retryAfterSec: res.retryAfterSec } : undefined);
      return;
    }

    const pe = validatePassword(password);
    setPErr(pe);
    if (pe) { setSummary(true); return; }
    setSummary(false); setMsg(''); setRevealed(false); setPhase('loading');

    let email = '';
    if (auth.name === 'mock') {
      const { MOCK_USER } = await import('@/services/adapters/auth.mock');
      email = MOCK_USER;
    } else {
      const { operatorEmail } = await operatorAuth();
      const em = await operatorEmail(cfg.supabaseUrl, cfg.supabaseKey, username);
      if (em.status !== 'ok') {
        failAuth(em.status === 'network' ? 'network' : 'invalid');
        return;
      }
      email = em.email;
    }
    const res = await auth.signIn({ email, password });
    if (res.status === 'ok') {
      clearFailures(kv.current);
      setPassword('');
      setPhase('success');
      const go = () => (redirectTarget.startsWith('/') ? router.replace(redirectTarget) : window.location.assign(redirectTarget));
      window.setTimeout(go, 300);
      return;
    }
    failAuth(res.status === 'rate_limited' ? 'rate' : res.status === 'unavailable' ? 'unavailable' : res.status === 'network' ? 'network' : 'invalid',
      res.status === 'rate_limited' ? { retryAfterSec: res.retryAfterSec } : undefined);
  }

  const busy = phase === 'loading';
  const errs = [
    uErr ? { field: 'username', id: 'login-username', msg: uErr } : null,
    pErr ? { field: 'password', id: 'login-password', msg: pErr } : null,
    cErr ? { field: 'confirm', id: 'login-confirm', msg: cErr } : null,
  ].filter(Boolean) as { field: string; id: string; msg: string }[];

  if (step === 'username') {
    return (
      <form method="post" action="#" noValidate autoComplete="on" onSubmit={continueUsername} aria-busy={busy || undefined} aria-label="Sign in" className="flex flex-col gap-5">
        {(summary && (errs.length > 0 || msg)) && (
          <ErrorSummary ref={summaryRef} errors={errs} title={errs.length ? undefined : msg} />
        )}
        {phase === 'success' && <p role="status" className="text-[length:var(--text-small)] text-success">Signed in. Redirecting…</p>}
        <div className="flex flex-col gap-2">
          <label htmlFor="login-username" className="text-[length:var(--text-small)] text-white">Username<span aria-hidden> *</span></label>
          <input
            id="login-username" name="username" type="text" autoComplete="username" autoCapitalize="off" spellCheck={false}
            autoFocus={desktop} value={username} readOnly={busy}
            onChange={(e) => { setUsername(e.target.value); if (uErr) setUErr(validateUsername(e.target.value)); }}
            onBlur={() => setUErr(validateUsername(username))}
            aria-required aria-invalid={uErr ? true : undefined} aria-describedby={uErr ? 'login-username-err' : undefined}
            className={`${inputCls} ${uErr ? 'border-danger' : 'border-[var(--line-dark)]'}`}
          />
          {uErr && <p id="login-username-err" className="text-[length:var(--text-small)] text-danger">{uErr}</p>}
        </div>
        {phase === 'network' && (
          <div role="alert" tabIndex={-1} ref={netRef} className="flex flex-col items-start gap-2 outline-none border-l-2 border-danger pl-3 text-[length:var(--text-small)] text-white">
            <p>{msg}</p>
            <button type="submit" className="underline">Try again</button>
          </div>
        )}
        <PillButton kind="filled" type="submit" icon="arrow" loading={busy} disabled={wait > 0 || phase === 'success'} className="w-full">
          {busy ? 'Checking…' : 'Continue'}
        </PillButton>
        {wait > 0 && phase !== 'success' && (
          <p className="text-[length:var(--text-small)] text-muted">Try again in {wait} s.</p>
        )}
        <div className="flex items-center justify-end text-[length:var(--text-small)]">
          <Link href="/" className="text-white/70 underline hover:text-white">Back to site</Link>
        </div>
        <p className="font-mono text-[0.7rem] text-muted">Invite-only. No signup — authorised usernames only.</p>
      </form>
    );
  }

  return (
    <form method="post" action="#" noValidate autoComplete="on" onSubmit={submitPassword} aria-busy={busy || undefined} aria-label={step === 'create' ? 'Create password' : 'Sign in'} className="flex flex-col gap-5">
      {(summary && (errs.length > 0 || msg)) && (
        <ErrorSummary ref={summaryRef} errors={errs} title={errs.length ? undefined : msg} />
      )}
      {phase === 'success' && <p role="status" className="text-[length:var(--text-small)] text-success">Signed in. Redirecting…</p>}
      <div className="flex flex-col gap-1">
        <p className="eyebrow text-muted">{step === 'create' ? 'Create password' : 'Password'}</p>
        <p className="text-[length:var(--text-small)] text-white">
          Signed in as <span className="font-mono text-magenta">{username}</span>
          {' · '}
          <button type="button" className="underline text-white/70 hover:text-white" onClick={() => { setStep('username'); setPassword(''); setConfirm(''); setPErr(undefined); setCErr(undefined); setPhase('idle'); setMsg(''); }}>
            Change
          </button>
        </p>
        {step === 'create' && (
          <p className="text-[length:var(--text-small)] text-muted">First login — choose a password (min 8 characters). You&apos;ll use it next time.</p>
        )}
      </div>
      <PasswordField value={password} onChange={(v) => { setPassword(v); if (pErr) setPErr(validatePassword(v)); }} error={pErr} readOnly={busy} revealed={revealed} onRevealChange={setRevealed} />
      {step === 'create' && (
        <div className="flex flex-col gap-2">
          <label htmlFor="login-confirm" className="text-[length:var(--text-small)] text-white">Confirm password<span aria-hidden> *</span></label>
          <input
            id="login-confirm" name="confirm" type={revealed ? 'text' : 'password'} autoComplete="new-password"
            value={confirm} readOnly={busy}
            onChange={(e) => { setConfirm(e.target.value); if (cErr) setCErr(e.target.value !== password ? 'Passwords do not match.' : undefined); }}
            aria-required aria-invalid={cErr ? true : undefined}
            className={`${inputCls} ${cErr ? 'border-danger' : 'border-[var(--line-dark)]'}`}
          />
          {cErr && <p className="text-[length:var(--text-small)] text-danger">{cErr}</p>}
        </div>
      )}
      {phase === 'network' && (
        <div role="alert" tabIndex={-1} ref={netRef} className="flex flex-col items-start gap-2 outline-none border-l-2 border-danger pl-3 text-[length:var(--text-small)] text-white">
          <p>{msg}</p>
          <button type="submit" className="underline">Try again</button>
        </div>
      )}
      <PillButton kind="filled" type="submit" icon="arrow" loading={busy} disabled={wait > 0 || phase === 'success'} className="w-full">
        {busy ? (step === 'create' ? 'Saving…' : 'Signing in…') : step === 'create' ? 'Save password & continue' : 'Sign in'}
      </PillButton>
      {busy && <p role="status" className="sr-only">{step === 'create' ? 'Saving…' : 'Signing in…'}</p>}
      {wait > 0 && phase !== 'success' && (
        <p className="text-[length:var(--text-small)] text-muted">Try again in {wait} s.</p>
      )}
      <div className="flex items-center justify-end text-[length:var(--text-small)]">
        <Link href="/" className="text-white/70 underline hover:text-white">Back to site</Link>
      </div>
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
