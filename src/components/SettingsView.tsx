'use client';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { getSettings, saveSettings } from '@/lib/data';
import { DEFAULT_SRS, SRS_LIMITS } from '@/lib/srs';
import { getSupabase } from '@/lib/supabase/client';
import { Notice, Skeleton } from './ui';
import type { SrsSettings } from '@/lib/types';

type SrsKey = keyof SrsSettings;

const FIELDS: [SrsKey, string, number, string][] = [
  ['againMinutes', 'Again: show again after (minutes)', 1, 'A missed word returns after this many minutes.'],
  ['firstIntervalDays', 'First successful review (days)', 1, 'Interval after the first Good.'],
  ['secondIntervalDays', 'Second successful review (days)', 1, 'Interval after the second Good.'],
  ['easyFirstIntervalDays', 'Easy on a new word (days)', 1, 'Interval when a new word is rated Easy.'],
  ['hardMultiplier', 'Hard multiplier', 0.05, 'Hard grows the interval by this factor (and at least one day).'],
  ['easyBonus', 'Easy bonus', 0.05, 'Easy multiplies the Good interval by this.'],
  ['startingEase', 'Starting ease', 0.1, 'SM-2 ease factor for new words. Later intervals ≈ previous × ease.'],
  ['maxIntervalDays', 'Maximum interval (days)', 1, 'No word waits longer than this.'],
];

export default function SettingsView() {
  const router = useRouter();
  const [values, setValues] = useState<SrsSettings | null>(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');

  useEffect(() => {
    getSettings().then(setValues).catch((err: Error) => setError(err.message));
    getSupabase().auth.getUser().then(({ data }) => setEmail(data.user?.email ?? ''));
  }, []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setMessage('');
    try {
      const saved = await saveSettings(values!);
      setValues(saved.srs);
      setMessage('Saved. New intervals apply from your next rating.');
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  };

  const signOut = async () => {
    await getSupabase().auth.signOut();
    router.replace('/login');
    router.refresh();
  };

  return (
    <>
      <div className="hero">
        <span className="eyebrow">Preferences</span>
        <h1>Settings</h1>
      </div>
      <div className="stack">
        <form className="card" onSubmit={submit}>
          <h2>Review intervals (SM-2)</h2>
          <p className="muted small">
            Each rating updates the word&apos;s ease and next interval. Again resets it; Hard, Good and Easy
            space it out progressively. Changes affect future ratings only.
          </p>
          {!values && !error && <Skeleton lines={2} />}
          {values &&
            FIELDS.map(([key, label, step, hint]) => (
              <div className="field" key={key}>
                <label className="label" htmlFor={key}>{label}</label>
                <input
                  id={key}
                  type="number"
                  className="input"
                  min={SRS_LIMITS[key][0]}
                  max={SRS_LIMITS[key][1]}
                  step={step}
                  value={values[key]}
                  onChange={(e) => setValues((v) => v ? { ...v, [key]: e.target.value } : v)}
                />
                <span className="hint">{hint} Default {DEFAULT_SRS[key]}.</span>
              </div>
            ))}
          <div className="stack" style={{ marginTop: '1rem' }}>
            {error && <Notice kind="error">{error}</Notice>}
            {message && <Notice kind="success">{message}</Notice>}
            <div className="row">
              <button type="submit" className="btn btn-primary" disabled={!values}>Save intervals</button>
              <button type="button" className="btn btn-ghost" onClick={() => setValues({ ...DEFAULT_SRS })}>Reset to defaults</button>
            </div>
          </div>
        </form>

        <section className="card">
          <h2>Account</h2>
          <p className="muted small">{email ? `Signed in as ${email}.` : 'Signed in.'} Your words sync across devices.</p>
          <button type="button" className="btn" onClick={signOut}>Sign out</button>
        </section>

        <section className="card">
          <h2>About the data</h2>
          <p className="muted small" style={{ margin: 0 }}>
            Definitions and audio come from the Free Dictionary API (Wiktionary content, CC BY-SA; audio licences shown
            with each file). Synonym candidates come from Datamuse and, if configured, the Merriam-Webster Thesaurus.
            Candidates are suggestions; only words you mark as &quot;Fits&quot; are treated as replacements. Export or back up
            your words from the Words page.
          </p>
        </section>
      </div>
    </>
  );
}
