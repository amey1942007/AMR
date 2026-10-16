'use client';

import { useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { useServices } from '@/components/providers/ServicesProvider';
import { readConfig } from '@/lib/config';
import { COPY } from '@/lib/control/access';
import '@/components/control/dashboard.css';

export function SignInForm({ redirectTarget, startForgot = false }: { redirectTarget: string; startForgot?: boolean }) {
  const { auth } = useServices();
  const cfg = readConfig();
  const router = useRouter();
  const [forgot, setForgot] = useState(startForgot);
  const [forgotFrom, setForgotFrom] = useState(startForgot);
  if (startForgot !== forgotFrom) {
    setForgotFrom(startForgot);
    setForgot(startForgot);
  }
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [emailErr, setEmailErr] = useState('');
  const [passErr, setPassErr] = useState('');
  const [info, setInfo] = useState('');

  if (!auth.isAvailable()) {
    return (
      <div className="op op-auth-page">
        <div className="op-auth">
          <div className="word">🤖 AMR</div>
          <h1>Sign in</h1>
          <p className="sub">Sign-in isn&apos;t available yet.</p>
        </div>
      </div>
    );
  }

  async function onSignIn(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setEmailErr(''); setPassErr(''); setInfo('');
    if (!email.trim()) { setEmailErr('Enter your email.'); return; }
    if (!password) { setPassErr('Enter your password.'); return; }
    setBusy(true);
    const res = await auth.signIn({ email: email.trim(), password });
    if (res.status === 'ok') {
      if (auth.name === 'supabase' && cfg.supabaseUrl && cfg.supabaseKey) {
        const session = await auth.getSession();
        if (session?.userId) {
          const { userIsActiveOperator } = await import('@/lib/control/password-flow');
          const gate = await userIsActiveOperator(cfg.supabaseUrl, cfg.supabaseKey, session.userId);
          if (gate === 'no') {
            await auth.signOut();
            setPassErr(COPY.forbidden);
            setBusy(false);
            return;
          }
        }
      }
      const go = () => (redirectTarget.startsWith('/') ? router.replace(redirectTarget) : window.location.assign(redirectTarget));
      go();
      return;
    }
    setBusy(false);
    if (res.status === 'forbidden') setPassErr(COPY.forbidden);
    else if (res.status === 'rate_limited') setPassErr(COPY.rate);
    else if (res.status === 'network') setPassErr(COPY.network);
    else if (res.status === 'unavailable') setPassErr("Sign-in isn't available yet.");
    else setPassErr(COPY.invalid);
  }

  async function onReset(e: FormEvent) {
    e.preventDefault();
    if (busy) return;
    setEmailErr(''); setInfo('');
    if (!email.trim()) { setEmailErr('Enter your email.'); return; }
    if (!cfg.supabaseUrl || !cfg.supabaseKey) { setEmailErr(COPY.network); return; }
    setBusy(true);
    try {
      const { sendPasswordReset } = await import('@/lib/control/password-flow');
      await sendPasswordReset(cfg.supabaseUrl, cfg.supabaseKey, email);
    } catch { /* same copy either way, so the allowlist stays private */ }
    setBusy(false);
    setInfo(COPY.resetSent);
  }

  return (
    <div className="op op-auth-page">
      <div className="op-auth">
        <div>🤖 AMR</div>
        <h1>{forgot ? 'Send reset link' : 'Sign in'}</h1>
        {!forgot && <p className="sub">Operator access only.</p>}
        <form onSubmit={forgot ? onReset : onSignIn} noValidate>
          <label htmlFor="signin-email">Email</label>
          <input id="signin-email" name="email" type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} aria-invalid={emailErr ? true : undefined} aria-describedby={emailErr ? 'signin-email-err' : undefined} />
          {emailErr && <p id="signin-email-err" className="err" role="alert">⚠ {emailErr}</p>}
          {!forgot && (
            <>
              <label htmlFor="signin-password">Password</label>
              <div className="field">
                <input id="signin-password" name="password" type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} aria-invalid={passErr ? true : undefined} aria-describedby={passErr ? 'signin-pass-err' : undefined} />
                <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? 'Hide password' : 'Show password'}>{show ? 'Hide' : 'Show'}</button>
              </div>
              {passErr && <p id="signin-pass-err" className="err" aria-live="polite">⚠ {passErr}</p>}
            </>
          )}
          {info && <p role="status" className="sub">{info}</p>}
          <div style={{ marginTop: 16 }}>
            <button className="btn full" type="submit" disabled={busy}>{busy ? 'Please wait…' : forgot ? 'Send reset link' : 'Sign in'}</button>
          </div>
        </form>
        <p style={{ marginTop: 12 }}>
          <button type="button" className="link" onClick={() => { setForgot((v) => !v); setInfo(''); setPassErr(''); }}>{forgot ? 'Back to sign in' : 'Forgot password?'}</button>
        </p>
        <p className="foot">Access is by invitation. Need access? Email admin@amrslam.tech.</p>
      </div>
    </div>
  );
}
