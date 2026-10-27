'use client';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { findCloze } from '@/lib/answer';
import { deleteWord, getWord, listReviews, updateWord } from '@/lib/data';
import { MODES } from '@/lib/session';
import { RATING_LABELS, formatDelay, isDueToday, wordStatus } from '@/lib/srs';
import AudioButton from './AudioButton';
import SynonymPanel from './SynonymPanel';
import WordForm from './WordForm';
import { Highlighted, Notice, Skeleton, SourceChip, formatDate } from './ui';
import type { Word, Review } from '@/lib/types';

const SENSE_FIELDS: (keyof Word)[] = ['sense', 'sense_key', 'part_of_speech', 'synonyms', 'audio', 'lookup_meta'];

export default function WordDetailView({ id }: { id: string }) {
  const router = useRouter();
  const [word, setWord] = useState<Word | null>(null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [error, setError] = useState('');
  const [notFound, setNotFound] = useState(false);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState<Partial<Word> | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [message, setMessage] = useState('');

  const load = useCallback(async () => {
    setError('');
    try {
      const [w, r] = await Promise.all([getWord(id), listReviews(id)]);
      if (!w) return setNotFound(true);
      setWord(w);
      setReviews(r);
      setDraft(null);
    } catch (err: unknown) {
      setError((err as Error).message);
    }
  }, [id]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- initial data load
    load();
  }, [load]);

  const save = async (patch: Partial<Word>, done: string) => {
    setBusy(true);
    setError('');
    try {
      setWord(await updateWord(id, patch));
      setDraft(null);
      setMessage(done);
    } catch (err: unknown) {
      setError((err as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await deleteWord(id);
      router.replace('/words');
    } catch (err: unknown) {
      setError((err as Error).message);
      setBusy(false);
    }
  };

  if (notFound) {
    return (
      <div className="card empty">
        <h2>Word not found</h2>
        <p className="muted">It may have been deleted.</p>
        <Link href="/words" className="btn">Back to words</Link>
      </div>
    );
  }
  if (!word) return error ? <Notice kind="error" onRetry={load}>{error}</Notice> : <Skeleton lines={4} />;

  if (editing) {
    return (
      <>
        <div className="hero">
          <span className="eyebrow">Edit</span>
          <h1>{word.term}</h1>
        </div>
        <WordForm
          initial={word}
          onSaved={(w) => {
            setWord(w);
            setEditing(false);
            setMessage('Changes saved.');
          }}
          onCancel={() => setEditing(false)}
        />
      </>
    );
  }

  const status = wordStatus(word);
  const cloze = findCloze(word.context, word.term);
  const senseValue = draft ?? word;

  return (
    <div className="stack">
      <div className="hero" style={{ marginBottom: 0 }}>
        <Link href="/words" className="small">← All words</Link>
        <div className="row">
          <h1 style={{ margin: 0 }}>{word.term}</h1>
          <AudioButton audio={word.audio} term={word.term} />
        </div>
        <div className="row">
          {word.part_of_speech && <span className="chip">{word.part_of_speech}</span>}
          <SourceChip source={word.source} />
          <span className="chip">{status}</span>
          {word.audio?.license && (
            <span className="hint">
              Audio: <a href={word.audio.sourceUrl || word.audio.license.url} target="_blank" rel="noreferrer">source</a>,{' '}
              <a href={word.audio.license.url} target="_blank" rel="noreferrer">{word.audio.license.name}</a>
            </span>
          )}
        </div>
      </div>

      {message && <Notice kind="success" onClose={() => setMessage('')}>{message}</Notice>}
      {error && <Notice kind="error" onClose={() => setError('')}>{error}</Notice>}

      <section className="card">
        <div className="section-title">
          <h2>Meaning</h2>
          <button type="button" className="btn btn-sm" onClick={() => setEditing(true)}>Edit</button>
        </div>
        <dl className="dl">
          <dt>My meaning</dt><dd>{word.meaning || <span className="muted">—</span>}</dd>
          <dt>Uzbek</dt><dd lang="uz">{word.uzbek || <span className="muted">—</span>}</dd>
          <dt>Paraphrase</dt><dd>{word.paraphrase || <span className="muted">— add one to practise paraphrasing</span>}</dd>
          <dt>Example</dt><dd>{word.example || <span className="muted">—</span>}</dd>
          {word.sense && (
            <>
              <dt>Selected sense</dt>
              <dd>
                {word.sense.partOfSpeech && <em>{word.sense.partOfSpeech}. </em>}
                {word.sense.definition}
                {word.sense.example && <span className="hint" style={{ display: 'block' }}>&ldquo;{word.sense.example}&rdquo;</span>}
                <span className="hint" style={{ display: 'block' }}>
                  <a href={word.sense.sourceUrl} target="_blank" rel="noreferrer">{word.sense.providerName}</a>
                  {word.sense.retrievedAt && ` · retrieved ${formatDate(word.sense.retrievedAt)}`}
                </span>
              </dd>
            </>
          )}
        </dl>
        {word.context && (
          <>
            <div className="eyebrow" style={{ margin: '1rem 0 0.4rem' }}>Where I found it</div>
            <p className="context">{cloze ? <Highlighted {...cloze} /> : word.context}</p>
          </>
        )}
      </section>

      <section className="card">
        <div className="section-title">
          <h2>Sense &amp; synonyms</h2>
        </div>
        <SynonymPanel
          term={word.term}
          context={word.context}
          meaning={word.meaning}
          value={senseValue}
          actionLabel="Refresh from dictionaries"
          onChange={(patch) => setDraft((d) => ({ ...(d ?? word), ...patch }))}
        />
        {draft && (
          <div className="row" style={{ marginTop: '1rem' }}>
            <button
              type="button"
              className="btn btn-primary"
              disabled={busy}
              onClick={() => save(Object.fromEntries(SENSE_FIELDS.map((f) => [f, draft[f]])), 'Sense and synonyms saved.')}
            >
              Save synonyms
            </button>
            <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>Discard</button>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Review</h2>
        <dl className="dl">
          <dt>Next review</dt>
          <dd>
            {status === 'archived'
              ? 'Archived — not scheduled'
              : isDueToday(word, new Date())
                ? 'Due today'
                : `${formatDate(word.due_at)} (in ${formatDelay(word.due_at)})`}
          </dd>
          <dt>Interval</dt><dd>{word.interval_days} day{word.interval_days === 1 ? '' : 's'}</dd>
          <dt>Ease</dt><dd>{Number(word.ease).toFixed(2)}</dd>
          <dt>Reviews</dt><dd>{reviews.length} · {word.lapses} lapse{word.lapses === 1 ? '' : 's'}</dd>
          <dt>Added</dt><dd>{formatDate(word.created_at)}</dd>
        </dl>
        {reviews.length > 0 && (
          <div className="table-wrap" style={{ marginTop: '1rem' }}>
            <table>
              <thead>
                <tr><th>When</th><th>Mode</th><th>Rating</th><th>Interval</th></tr>
              </thead>
              <tbody>
                {reviews.map((r) => (
                  <tr key={r.id}>
                    <td>{formatDate(r.reviewed_at, { time: true })}</td>
                    <td>{MODES[r.mode]?.short ?? r.mode}</td>
                    <td>
                      <span className={`rate-${r.rating}`} style={{ padding: '0.1rem 0.45rem', borderRadius: 6 }}>{RATING_LABELS[r.rating]}</span>
                      {r.early && <span className="hint"> (early)</span>}
                    </td>
                    <td>{r.prev_interval}d → {r.new_interval}d</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card">
        <h2>Manage</h2>
        <div className="row">
          <button
            type="button"
            className="btn"
            disabled={busy}
            onClick={() =>
              save(
                { status: word.status === 'archived' ? 'active' : 'archived' },
                word.status === 'archived' ? 'Restored to your reviews.' : "Archived. It won't appear in reviews.",
              )
            }
          >
            {word.status === 'archived' ? 'Unarchive' : 'Archive'}
          </button>
          {confirmDelete ? (
            <>
              <span className="small">Delete &ldquo;{word.term}&rdquo; and its review history?</span>
              <button type="button" className="btn btn-danger" onClick={remove} disabled={busy}>Yes, delete</button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmDelete(false)}>Cancel</button>
            </>
          ) : (
            <button type="button" className="btn btn-danger" onClick={() => setConfirmDelete(true)}>Delete…</button>
          )}
        </div>
      </section>
    </div>
  );
}
