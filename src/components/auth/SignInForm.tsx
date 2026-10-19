'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/components/providers/ServicesProvider';
import { readConfig } from '@/lib/config';
import { COPY, passwordRules } from '@/lib/control/access';
import {
  isUsernameShape,
  normalizeUsername,
  operatorClaim,
  operatorEmail,
  operatorStatus,
} from '@/lib/control/operator-auth';
import { WaveLines } from '@/components/effects/WaveLines';
import '@/components/effects/effects.css';
import '@/components/control/dashboard.css';

type Step = 'name' | 'password' | 'set-password';

export function SignInForm({ redirectTarget }: { redirectTarget: string; startForgot?: boolean }) {
  const { auth } = useServices();
  const cfg = readConfig();
  const router = useRouter();
  const [step, setStep] = useState<Step>('name');
  const [name, setName] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [resolvedEmail, setResolvedEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [nameErr, setNameErr] = useState('');
  const [passErr, setPassErr] = useState('');

  if (!auth.isAvailable()) {
    return (
      <div className="op op-auth-page">
        <div className="op-bg" aria-hidden><WaveLines lines={5} /></div>
        <div className="op-auth">
          <div className="op-brand">AMR</div>
          <h1>Sign in</h1>
          <p className="sub">Sign-in isn&apos;t available yet.</p>
        </div>
      </div>
    );
  }

  function goAfterSignIn() {
    const go = () => (redirectTarget.startsWith('/') ? router.replace(redirectTarget) : window.location.assign(redirectTarget));
    go();
  }

  async function gateOperator() {
    if (auth.name !== 'supabase' || !cfg.supabaseUrl || !cfg.supabaseKey) return true;
    const session = await auth.getSession();
    if (!session?.userId) return true;
    const { userIsActiveOperator } = await import('@/lib/control/password-flow');
    const gate = await userIsActiveOperator(cfg.supabaseUrl, cfg.supabaseKey, session.userId);
    if (gate === 'no') {
      await auth.signOut();
      setPassErr(COPY.forbidden);
      return false;
    }
    return true;
  }

  async function onNameContinue(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setNameErr(''); setPassErr('');
    const u = normalizeUsername(name);
    if (!u) { setNameErr('Enter your name.'); return; }
    if (!isUsernameShape(u)) { setNameErr('Use your operator name (letters, numbers, _).'); return; }
    setBusy(true);
    if (auth.name === 'mock') {
      setBusy(false);
      if (u !== 'demo') { setNameErr('That name isn\'t on the allowlist.'); return; }
      setName('demo');
      setDisplayName('Demo');
      setPassword('');
      setConfirm('');
      setStep('password');
      return;
    }
    if (!cfg.supabaseUrl || !cfg.supabaseKey) { setBusy(false); setNameErr(COPY.network); return; }
    const st = await operatorStatus(cfg.supabaseUrl, cfg.supabaseKey, u);
    setBusy(false);
    if (st.status === 'network' || st.status === 'unavailable') { setNameErr(COPY.network); return; }
    if (st.status !== 'ok') { setNameErr('That name isn\'t on the allowlist.'); return; }
    setName(st.username);
    setDisplayName(st.displayName || st.username);
    setResolvedEmail(st.email ?? '');
    setPassword('');
    setConfirm('');
    setStep(st.needsPassword ? 'set-password' : 'password');
  }

  async function onPasswordSignIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setPassErr('');
    if (!password) { setPassErr('Enter your password.'); return; }
    setBusy(true);
    if (auth.name === 'mock') {
      const res = await auth.signIn({ email: 'demo@amrslam.tech', password });
      if (res.status === 'ok') { goAfterSignIn(); return; }
      setBusy(false);
      if (res.status === 'rate_limited') setPassErr(COPY.rate);
      else if (res.status === 'network') setPassErr(COPY.network);
      else setPassErr(COPY.invalid);
      return;
    }
    if (!cfg.supabaseUrl || !cfg.supabaseKey) { setBusy(false); setPassErr(COPY.network); return; }
    // Prefer email from the status step (one round-trip). Fall back to cache / email action.
    let email = resolvedEmail;
    let needsPassword = false;
    if (!email) {
      const resolved = await operatorEmail(cfg.supabaseUrl, cfg.supabaseKey, name);
      if (resolved.status !== 'ok') {
        setBusy(false);
        setPassErr(resolved.status === 'network' ? COPY.network : 'That name isn\'t on the allowlist.');
        return;
      }
      email = resolved.email;
      needsPassword = resolved.needsPassword;
      setResolvedEmail(email);
    }
    if (needsPassword) {
      setBusy(false);
      setStep('set-password');
      return;
    }
    const res = await auth.signIn({ email, password });
    if (res.status === 'ok') {
      if (!(await gateOperator())) { setBusy(false); return; }
      goAfterSignIn();
      return;
    }
    setBusy(false);
    if (res.status === 'forbidden') setPassErr(COPY.forbidden);
    else if (res.status === 'rate_limited') setPassErr(COPY.rate);
    else if (res.status === 'network') setPassErr(COPY.network);
    else setPassErr(COPY.invalid);
  }

  async function onSetPassword(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setPassErr('');
    const rules = passwordRules(password, confirm);
    if (!rules.length) { setPassErr('Enter a password.'); return; }
    if (!rules.match) { setPassErr(COPY.mismatch); return; }
    if (!cfg.supabaseUrl || !cfg.supabaseKey) { setPassErr(COPY.network); return; }
    setBusy(true);
    const claimed = await operatorClaim(cfg.supabaseUrl, cfg.supabaseKey, name, password);
    if (claimed.status !== 'ok') {
      setBusy(false);
      if (claimed.reason === 'password') setPassErr('Enter a password.');
      else if (claimed.status === 'network' || claimed.status === 'unavailable') setPassErr(COPY.network);
      else setPassErr('Couldn\'t set password. Email amey@amrslam.tech or admin@amrslam.tech.');
      return;
    }
    const res = await auth.signIn({ email: claimed.email, password });
    if (res.status === 'ok') {
      if (!(await gateOperator())) { setBusy(false); return; }
      goAfterSignIn();
      return;
    }
    setBusy(false);
    setPassErr(res.status === 'network' ? COPY.network : 'Password saved, but sign-in failed. Try again.');
  }

  return (
    <div className="op op-auth-page">
      <div className="op-bg" aria-hidden><WaveLines lines={5} /></div>
      <div className="op-auth">
        <div className="op-brand">AMR</div>
        <h1>
          {step === 'name' && 'Sign in'}
          {step === 'password' && `Hi, ${displayName || name}`}
          {step === 'set-password' && 'Set your password'}
        </h1>
        <p className="sub">
          {step === 'name' && 'Enter your operator name.'}
          {step === 'password' && 'Enter your password to open the control panel.'}
          {step === 'set-password' && 'Choose a new password for this account. You\'ll use it next time.'}
        </p>

        {step === 'name' && (
          <form onSubmit={onNameContinue} noValidate>
            <label htmlFor="signin-name">Name</label>
            <input
              id="signin-name"
              name="username"
              autoComplete="username"
              autoCapitalize="none"
              spellCheck={false}
              value={name}
              onChange={(e) => setName(e.target.value)}
              aria-invalid={nameErr ? true : undefined}
              aria-describedby={nameErr ? 'signin-name-err' : undefined}
            />
            {nameErr && <p id="signin-name-err" className="err" role="alert">⚠ {nameErr}</p>}
            <div style={{ marginTop: 16 }}>
              <button className="btn full" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Continue'}</button>
            </div>
          </form>
        )}

        {step === 'password' && (
          <form onSubmit={onPasswordSignIn} noValidate>
            <label htmlFor="signin-password">Password</label>
            <div className="field">
              <input
                id="signin-password"
                name="password"
                type={show ? 'text' : 'password'}
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={passErr ? true : undefined}
                aria-describedby={passErr ? 'signin-pass-err' : undefined}
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </div>
            {passErr && <p id="signin-pass-err" className="err" aria-live="polite">⚠ {passErr}</p>}
            <div style={{ marginTop: 16 }}>
              <button className="btn full" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Sign in'}</button>
            </div>
            <p style={{ marginTop: 12 }}>
              <button type="button" className="link" onClick={() => { setStep('name'); setPassErr(''); setPassword(''); setResolvedEmail(''); }}>Change name</button>
            </p>
          </form>
        )}

        {step === 'set-password' && (
          <form onSubmit={onSetPassword} noValidate>
            <label htmlFor="new-password">New password</label>
            <div className="field">
              <input
                id="new-password"
                name="new-password"
                type={show ? 'text' : 'password'}
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
              <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
            </div>
            <label htmlFor="confirm-password">Confirm password</label>
            <input
              id="confirm-password"
              name="confirm"
              type={show ? 'text' : 'password'}
              autoComplete="new-password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
            />
            {passErr && <p className="err" role="alert">⚠ {passErr}</p>}
            <div style={{ marginTop: 16 }}>
              <button className="btn full" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Save password & continue'}</button>
            </div>
            <p style={{ marginTop: 12 }}>
              <button type="button" className="link" onClick={() => { setStep('name'); setPassErr(''); setPassword(''); setConfirm(''); setResolvedEmail(''); }}>Change name</button>
            </p>
          </form>
        )}

        <p className="foot">
          Need a reset or access? Email{' '}
          <a href="mailto:amey@amrslam.tech">amey@amrslam.tech</a>
          {' '}or{' '}
          <a href="mailto:admin@amrslam.tech">admin@amrslam.tech</a>.
        </p>
      </div>
    </div>
  );
}
