'use client';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { getSupabase } from '@/lib/supabase/client';
import { Notice } from './ui';

export default function ResetPasswordForm() {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }
    setBusy(true);
    setError('');
    try {
      // The recovery link already signed the user in, so this updates their own account.
      const { error: err } = await getSupabase().auth.updateUser({ password });
      if (err) throw err;
      router.replace('/');
      router.refresh();
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
        <h1>Set a new password</h1>
        <p className="muted">Choose a password you haven’t used here before.</p>
      </div>
      <form className="card" onSubmit={submit}>
        <div className="field">
          <label className="label" htmlFor="new-password">New password</label>
          <input
            id="new-password"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={8}
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <span className="hint">At least 8 characters.</span>
        </div>
        <div className="field">
          <label className="label" htmlFor="confirm-password">Confirm new password</label>
          <input
            id="confirm-password"
            type="password"
            className="input"
            autoComplete="new-password"
            minLength={8}
            required
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
        </div>
        <div className="stack" style={{ marginTop: '1.25rem' }}>
          {error && <Notice kind="error">{error}</Notice>}
          <button type="submit" className="btn btn-primary btn-lg btn-block" disabled={busy}>
            {busy && <span className="spinner" aria-hidden="true" />}
            Update password
          </button>
        </div>
      </form>
    </div>
  );
}
