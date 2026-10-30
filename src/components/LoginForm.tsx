'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Notice } from './ui';

type Mode = 'signin' | 'signup' | 'forgot';

const SUBMIT_LABEL: Record<Mode, string> = {
  signin: 'Sign in',
  signup: 'Create account',
  forgot: 'Send reset link',
};

function Form() {
  const router = useRouter();
  const params = useSearchParams();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(params.get('error') === 'confirm' ? 'That link is invalid or expired.' : '');
  const [info, setInfo] = useState('');

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setInfo('');
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError('');
    setInfo('');
    const supabase = getSupabase();
    try {
      if (mode === 'signin') {
        const { error: err } = await supabase.auth.signInWithPassword({ email, password });
        if (err) throw err;
        router.replace('/');
        router.refresh();
      } else if (mode === 'signup') {
        const { data, error: err } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
        });
        if (err) throw err;
        if (data.session) {
          router.replace('/');
          router.refresh();
        } else {
          setInfo('Check your email to confirm your account, then sign in.');
          setMode('signin');
        }
      } else {
        const { error: err } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
        });
        if (err) throw err;
        // Same message whether or not the account exists, so emails can't be probed.
        setInfo('If an account exists for that email, a reset link is on its way.');
        setMode('signin');
      }
    } catch (err: unknown) {
      const e = err as { message?: string };
      setError(navigator.onLine ? (e.message ?? 'Unknown error') : 'You are offline.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="auth stack">
      <div style={{ textAlign: 'center' }}>
        <div className="brand-mark" style={{ margin: '0 auto 0.75rem', width: 48, height: 48, fontSize: '1.3rem' }} aria-hidden="true">F</div>
        <h1>Fara</h1>
        <p className="muted">
          {mode === 'forgot'
            ? 'Enter your email and we’ll send you a link to set a new password.'
            : 'Your IELTS vocabulary, reviewed at the right time.'}
        </p>
      </div>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="email">Email</label>
          <input id="email" type="email" className="input" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} />
        </div>
        {mode !== 'forgot' && (
          <div className="field">
            <label className="label" htmlFor="password">Password</label>
            <input
              id="password"
              type="password"
              className="input"
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={8}
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {mode === 'signup' && <span className="hint">At least 8 characters.</span>}
            {mode === 'signin' && (
              <button type="button" className="btn btn-sm btn-ghost" style={{ alignSelf: 'flex-end' }} onClick={() => switchMode('forgot')}>
                Forgot password?
              </button>
            )}
          </div>
        )}
        <div className="stack" style={{ marginTop: '1.25rem' }}>
          {error && <Notice kind="error">{error}</Notice>}
          {info && <Notice kind="success">{info}</Notice>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            {SUBMIT_LABEL[mode]}
          </button>
          <button type="button" className="btn btn-ghost btn-block" onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}>
            {mode === 'signin' ? 'First time here? Create an account' : 'Have an account? Sign in'}
          </button>
        </div>
      </form>
    </div>
  );
}

export default function LoginForm() {
  return (
    <Suspense>
      <Form />
    </Suspense>
  );
}
