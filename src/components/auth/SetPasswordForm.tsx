'use client';

import { useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { readConfig } from '@/lib/config';
import { COPY, isExpiredLinkMessage, isWeakPasswordMessage, passwordRules, strengthSegments } from '@/lib/control/access';
import '@/components/control/dashboard.css';

type Step = 'continue' | 'choose' | 'done' | 'expired';

export function SetPasswordForm({ tokenHash, type }: { tokenHash: string | null; type: string | null }) {
  const cfg = readConfig();
  const router = useRouter();
  const otp = type === 'invite' || type === 'recovery' ? type : null;
  const [step, setStep] = useState<Step>(tokenHash && otp ? 'continue' : 'expired');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const rules = passwordRules(password, confirm);
  const strength = strengthSegments(password);
  const valid = rules.length && rules.match;

  const title = useMemo(() => (otp === 'recovery' ? 'Reset your password' : 'Welcome to AMR'), [otp]);

  async function onContinue(e: FormEvent) {
    e.preventDefault();
    if (!tokenHash || !otp || !cfg.supabaseUrl || !cfg.supabaseKey) { setStep('expired'); return; }
    setBusy(true); setError('');
    const { verifySetPasswordLink } = await import('@/lib/control/password-flow');
    const err = await verifySetPasswordLink(cfg.supabaseUrl, cfg.supabaseKey, tokenHash, otp);
    setBusy(false);
    if (err) { setStep('expired'); setError(isExpiredLinkMessage(err.message) ? COPY.expiredLink : COPY.network); return; }
    setStep('choose');
  }

  async function onSet(e: FormEvent) {
    e.preventDefault();
    if (!valid || !cfg.supabaseUrl || !cfg.supabaseKey) return;
    setBusy(true); setError('');
    const { saveNewPassword } = await import('@/lib/control/password-flow');
    const { error: err } = await saveNewPassword(cfg.supabaseUrl, cfg.supabaseKey, password);
    setBusy(false);
    if (err) {
      setError(isWeakPasswordMessage(err.message) ? COPY.weak : COPY.network);
      return;
    }
    setStep('done');
    window.setTimeout(() => router.replace('/control/'), 1200);
  }

  return (
    <div className="op op-auth-page">
      <div className="op-auth">
        <div>🤖 AMR</div>
        {step === 'expired' && (
          <>
            <h1>Reset your password</h1>
            <p className="err" role="alert">⚠ {error || COPY.expiredLink}</p>
            <p style={{ marginTop: 16 }}><a className="btn full" href="/sign-in/?forgot=1" style={{ display: 'grid', placeItems: 'center', textDecoration: 'none' }}>Send a new link</a></p>
          </>
        )}
        {step === 'continue' && (
          <form onSubmit={onContinue}>
            <h1>{title}</h1>
            <p className="sub">Confirm to continue.</p>
            <button className="btn full" type="submit" disabled={busy}>{busy ? 'Please wait…' : 'Continue'}</button>
          </form>
        )}
        {step === 'choose' && (
          <form onSubmit={onSet}>
            <h1>{title}</h1>
            <label htmlFor="new-password">New password</label>
            <div className="field">
              <input id="new-password" name="new-password" type={show ? 'text' : 'password'} autoComplete="new-password" value={password} onChange={(e) => setPassword(e.target.value)} />
              <button type="button" aria-label={show ? 'Hide password' : 'Show password'} onClick={() => setShow((v) => !v)}>{show ? 'Hide' : 'Show'}</button>
            </div>
            <div className="segs" aria-hidden>{[0, 1, 2, 3].map((i) => <i key={i} className={i < strength ? 'on' : ''} />)}</div>
            <label htmlFor="confirm-password">Confirm password</label>
            <input id="confirm-password" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password" value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-invalid={!rules.match && confirm ? true : undefined} />
            {!rules.match && confirm && <p className="err" aria-live="polite">⚠ {COPY.mismatch}</p>}
            <ul className="rules">
              <li className={rules.length ? 'ok' : ''}>{rules.length ? '✓' : '○'} At least 10 characters</li>
              <li className={rules.match ? 'ok' : ''}>{rules.match ? '✓' : '○'} Passwords match</li>
            </ul>
            {error && <p className="err" role="alert">⚠ {error}</p>}
            <button className="btn full" type="submit" disabled={!valid || busy}>{busy ? 'Please wait…' : 'Set password'}</button>
          </form>
        )}
        {step === 'done' && (
          <>
            <h1>Password set</h1>
            <p className="sub" role="status" style={{ color: 'var(--ok)' }}>✓ Password set. Taking you to the control panel…</p>
          </>
        )}
      </div>
    </div>
  );
}
