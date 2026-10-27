'use client';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { recordReview } from '@/lib/data';
import { availableModes, currentItem, isFinished, rateCurrent, summarize } from '@/lib/session';
import { applyReview, formatDelay, previewIntervals } from '@/lib/srs';
import { canSpeak } from './AudioButton';
import ReviewCard from './ReviewCard';
import { Notice } from './ui';
import type { Word, Rating, SessionState, SessionSummary, SrsSettings } from '@/lib/types';

export const SESSION_KEY = 'ielts-vocab:session';

export function saveSession(state: SessionState | null): void {
  try {
    if (state) localStorage.setItem(SESSION_KEY, JSON.stringify(state));
    else localStorage.removeItem(SESSION_KEY);
  } catch {
    // Storage unavailable: the session just won't survive a reload.
  }
}

export function loadSession(): SessionState | null {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY) ?? 'null') as SessionState | null;
  } catch {
    return null;
  }
}

function useClock(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

interface ReviewSessionProps {
  initialState: SessionState;
  words: Word[];
  settings: SrsSettings | null;
  onExit: (state: SessionState | null) => void;
}

export default function ReviewSession({ initialState, words: initialWords, settings, onExit }: ReviewSessionProps) {
  const [state, setState] = useState<SessionState>(() => {
    const ids = new Set(initialWords.map((w) => w.id));
    const upcoming = initialState.queue.slice(initialState.index).filter((q) => ids.has(q.wordId));
    return { ...initialState, queue: [...initialState.queue.slice(0, initialState.index), ...upcoming] };
  });
  const [words, setWords] = useState(() => new Map(initialWords.map((w) => [w.id, w])));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<{ message: string; retry: () => void } | null>(null);
  const [queued, setQueued] = useState(0);
  const now = useClock();

  const finished = state.done || state.index >= state.queue.length;

  useEffect(() => {
    saveSession(finished ? null : state);
  }, [state, finished]);

  const item = currentItem(state);

  if (finished) {
    return <Summary summary={summarize(state, new Date(now))} words={words} queued={queued} onExit={onExit} />;
  }

  const word = item && words.get(item.wordId);
  if (!word) return null;

  const all = [...words.values()];
  const modes = availableModes(word, all, { audio: canSpeak() });
  const mode = modes.includes(item.mode) ? item.mode : 'recall';
  const previews = previewIntervals(word, new Date(now), settings ?? undefined);

  const rate = async (rating: Rating, { correct, answer }: { correct: boolean | null; answer: string | null }) => {
    setBusy(true);
    setError(null);
    const at = new Date();
    const next = applyReview(word, rating, at, settings ?? undefined);
    try {
      const res = await recordReview({
        wordId: word.id,
        mode,
        rating,
        correct,
        answer,
        early: next.early,
        ease: next.ease,
        intervalDays: next.intervalDays,
        repetitions: next.repetitions,
        lapses: next.lapses,
        dueAt: next.dueAt,
        confidence: next.confidence,
        reviewedAt: at,
      });
      if (!res.saved) setQueued((q) => q + 1);
      setWords((m) =>
        new Map(m).set(word.id, res.word ?? {
          ...word,
          ease: next.ease,
          interval_days: next.intervalDays,
          repetitions: next.repetitions,
          lapses: next.lapses,
          due_at: next.dueAt.toISOString(),
          confidence: next.confidence,
          last_reviewed_at: at.toISOString(),
        }),
      );
      setState((s) => {
        const n = rateCurrent(s, { rating, newDueAt: next.dueAt });
        return isFinished(n, new Date()) ? { ...n, done: true } : n;
      });
    } catch (err: unknown) {
      const e = err as Error;
      setError({ message: e.message, retry: () => rate(rating, { correct, answer }) });
    } finally {
      setBusy(false);
    }
  };

  const remainingMs = Math.max(0, state.minutes * 60_000 - (now - new Date(state.startedAt).getTime()));
  const mm = Math.floor(remainingMs / 60_000);
  const ss = String(Math.floor((remainingMs % 60_000) / 1000)).padStart(2, '0');
  const progress = Math.min(100, (state.index / state.queue.length) * 100);

  return (
    <div className="review stack">
      <div className="row spread">
        <button type="button" className="btn btn-sm btn-ghost" onClick={() => onExit(state)}>
          ← Pause
        </button>
        <span className="small muted" aria-label="Progress">
          {state.index + 1} / {state.queue.length} · {remainingMs > 0 ? `${mm}:${ss} left` : 'time up — finishing missed cards'}
        </span>
      </div>
      <div className="progress" role="progressbar" aria-valuenow={Math.round(progress)} aria-valuemin={0} aria-valuemax={100}>
        <span style={{ width: `${progress}%` }} />
      </div>
      {item.early && <p className="hint">Extra practice: this word isn&apos;t due yet, so only &ldquo;Again&rdquo; changes its schedule.</p>}
      {error && <Notice kind="error" onRetry={error.retry}>{error.message}</Notice>}
      {queued > 0 && <Notice kind="warn">{queued} rating(s) saved on this device; they will sync when you&apos;re back online.</Notice>}
      <ReviewCard
        key={item.key}
        word={word}
        allWords={all}
        mode={mode}
        previews={previews}
        onRate={rate}
        busy={busy}
      />
    </div>
  );
}

interface SummaryProps {
  summary: SessionSummary;
  words: Map<string, Word>;
  queued: number;
  onExit: (state: SessionState | null) => void;
}

function Summary({ summary, words, queued, onExit }: SummaryProps) {
  const missed = summary.missedIds.map((id) => words.get(id)).filter((w): w is Word => Boolean(w));
  const nextDue = [...words.values()]
    .filter((w) => w.status !== 'archived')
    .map((w) => new Date(w.due_at))
    .filter((d) => d > new Date())
    .sort((a, b) => a.getTime() - b.getTime())[0];

  return (
    <div className="review stack">
      <div className="card">
        <p className="eyebrow">Session complete</p>
        <h1>Nice work.</h1>
        <div className="grid-stats" style={{ marginTop: '1rem' }}>
          <Stat value={summary.words} label="words reviewed" />
          <Stat value={summary.learned} label="remembered" />
          <Stat value={summary.missed} label="missed" />
          <Stat value={summary.dueAgainToday} label="due again today" />
        </div>
        <p className="muted small" style={{ marginTop: '1rem' }}>
          {summary.reviewed} answers in about {summary.minutes} min.
          {nextDue && ` Next review: ${formatDelay(nextDue)} from now.`}
        </p>
        {queued > 0 && <Notice kind="warn">{queued} rating(s) are waiting to sync. Keep this device online for a moment.</Notice>}
      </div>
      {missed.length > 0 && (
        <div className="card">
          <h2>Worth another look</h2>
          <ul className="word-list" style={{ marginTop: '0.5rem' }}>
            {missed.map((w) => (
              <li key={w.id} className="word-item">
                <Link href={`/words/${w.id}`}>
                  <span className="word-term">{w.term}</span>
                  <span className="muted small truncate" style={{ display: 'block' }}>{w.meaning || w.uzbek}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      )}
      <button type="button" className="btn btn-primary btn-lg btn-block" onClick={() => onExit(null)}>
        Back to Today
      </button>
    </div>
  );
}

function Stat({ value, label }: { value: number; label: string }) {
  return (
    <div className="stat">
      <div className="stat-value">{value}</div>
      <div className="stat-label">{label}</div>
    </div>
  );
}
