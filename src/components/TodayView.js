'use client';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { flushOutbox, getSettings, listWords } from '@/lib/data';
import { buildQueue, startSession } from '@/lib/session';
import { isDueToday, startOfLocalDay, wordStatus } from '@/lib/srs';
import { canSpeak } from './AudioButton';
import ReviewSession, { loadSession, saveSession } from './ReviewSession';
import { Notice, Segmented, Skeleton } from './ui';

const EXAM_DATE = new Date(2026, 11, 20); // 20 December 2026, local time
const LENGTHS = [5, 10, 15].map((m) => ({ value: m, label: `${m} min` }));

function daysUntilExam(now = new Date()) {
  return Math.round((EXAM_DATE - startOfLocalDay(now)) / 86_400_000);
}

export default function TodayView() {
  const [words, setWords] = useState(null);
  const [settings, setSettings] = useState(null);
  const [error, setError] = useState('');
  const [minutes, setMinutes] = useState(10);
  const [session, setSession] = useState(null);
  const [saved, setSaved] = useState(null);

  const load = useCallback(async () => {
    setError('');
    try {
      await flushOutbox();
      const [w, s] = await Promise.all([listWords(), getSettings()]);
      setWords(w);
      setSettings(s);
      const stored = loadSession();
      // Resume only today's unfinished session.
      if (stored && stored.day === startOfLocalDay(new Date()).toISOString() && stored.index < stored.queue.length) {
        setSaved(stored);
      } else if (stored) {
        saveSession(null);
      }
    } catch (err) {
      setError(err.message);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  const start = () => {
    const queue = buildQueue(words, { minutes, audio: canSpeak() });
    if (!queue.length) return;
    const state = startSession(queue, { minutes });
    saveSession(state);
    setSaved(null);
    setSession(state);
  };

  const exit = (pausedState) => {
    setSession(null);
    setSaved(pausedState);
    setWords(null);
    load();
  };

  if (session) {
    return <ReviewSession initialState={session} words={words} settings={settings} onExit={exit} />;
  }

  const days = daysUntilExam();

  return (
    <>
      <div className="hero">
        {days >= 0 && (
          <span className="countdown">
            {days === 0 ? 'IELTS Academic is today. Good luck!' : `${days} days to IELTS Academic · target Band 7`}
          </span>
        )}
        <h1>Today</h1>
      </div>

      {error && <Notice kind="error" onRetry={load}>{error}</Notice>}
      {!words && !error && <Skeleton lines={3} />}
      {words && <Dashboard words={words} minutes={minutes} setMinutes={setMinutes} start={start} saved={saved} resume={() => setSession(saved)} />}
    </>
  );
}

function Dashboard({ words, minutes, setMinutes, start, saved, resume }) {
  const active = words.filter((w) => w.status !== 'archived');
  if (!active.length) {
    return (
      <div className="card empty">
        <div className="empty-icon" aria-hidden="true">📚</div>
        <h2>Your word bank is empty</h2>
        <p className="muted">Add a word from your Reading, Listening or everyday English to start reviewing.</p>
        <Link href="/add" className="btn btn-primary btn-lg">Add your first word</Link>
      </div>
    );
  }

  const now = new Date();
  const due = active.filter((w) => isDueToday(w, now));
  const counts = { new: 0, learning: 0, mastered: 0 };
  for (const w of active) counts[wordStatus(w)] += 1;
  const addedToday = active.filter((w) => new Date(w.created_at) >= startOfLocalDay(now)).length;

  return (
    <div className="stack">
      <div className="grid-stats">
        <Stat value={due.length} label="due today" highlight />
        <Stat value={counts.new} label="new" />
        <Stat value={counts.learning} label="learning" />
        <Stat value={counts.mastered} label="mastered (21d+)" />
      </div>

      {saved && (
        <Notice kind="info" onClose={undefined}>
          You have an unfinished session ({saved.index} of {saved.queue.length} done).{' '}
          <button type="button" className="btn btn-sm" onClick={resume}>Resume</button>
        </Notice>
      )}

      <section className="card start-card">
        <div>
          <h2>{due.length ? 'Start your review' : 'Nothing due — practise anyway?'}</h2>
          <p className="muted small" style={{ margin: 0 }}>
            {due.length
              ? 'Difficult words come first. Missed words return later in the same session.'
              : 'Extra practice is logged, but only “Again” changes a word’s schedule before it’s due.'}
          </p>
        </div>
        <Segmented label="Session length" value={minutes} options={LENGTHS} onChange={setMinutes} />
        <button type="button" className="btn btn-primary btn-lg btn-block" onClick={start}>
          {due.length ? `Start · ${Math.min(due.length, minutes * 2)} cards` : 'Start practice'}
        </button>
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Today so far</h2>
          <Link href="/add" className="btn btn-sm">+ Add word</Link>
        </div>
        <p className="muted small" style={{ margin: 0 }}>
          {addedToday ? `${addedToday} new word${addedToday > 1 ? 's' : ''} added today.` : 'No words added today yet.'}{' '}
          {active.length} active words in total.
        </p>
      </section>
    </div>
  );
}

function Stat({ value, label, highlight }) {
  return (
    <div className="stat" style={highlight ? { borderColor: 'var(--accent)' } : undefined}>
      <div className="stat-value" style={highlight ? { color: 'var(--accent)' } : undefined}>{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
