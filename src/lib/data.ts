'use client';
// Data access from the browser. Row-level security limits every query to the
// signed-in user's rows.
import { getSupabase } from './supabase/client';
import { normalizeSettings } from './srs';
import type { Word, Review, SrsSettings, ReviewRecord, RecordReviewResult } from './types';

const WORD_FIELDS: (keyof Word)[] = [
  'term', 'source', 'context', 'meaning', 'uzbek', 'paraphrase', 'example',
  'part_of_speech', 'sense_key', 'sense', 'synonyms', 'audio', 'lookup_meta', 'status',
];

function pick(obj: Partial<Word>): Partial<Word> {
  const out: Partial<Word> = {};
  for (const k of WORD_FIELDS) {
    if (k in obj) (out as Record<string, unknown>)[k] = (obj as Record<string, unknown>)[k];
  }
  return out;
}

export function friendlyError(error: unknown): string | null {
  if (!error) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You are offline. Check your connection and try again.';
  const err = error as { code?: string; message?: string };
  if (err.code === '23505') return 'You already saved this word with the same sense. Choose a different sense or edit the existing entry.';
  if (err.code === '42501') return 'Permission denied. Try signing out and in again.';
  if (/fetch|network/i.test(err.message ?? '')) return 'Could not reach the server. Check your connection and try again.';
  return err.message || 'Something went wrong.';
}

async function run<T>(query: PromiseLike<{ data: T | null; error: unknown }>): Promise<T> {
  const { data, error } = await query;
  if (error) {
    const err = error as { code?: string };
    throw Object.assign(new Error(friendlyError(error) ?? 'Unknown error'), { code: err.code });
  }
  return data as T;
}

export async function listWords(): Promise<Word[]> {
  return run(getSupabase().from('words').select('*').order('created_at', { ascending: false }));
}

export async function getWord(id: string): Promise<Word | null> {
  return run(getSupabase().from('words').select('*').eq('id', id).maybeSingle());
}

export async function findByTerm(term: string, excludeId?: string): Promise<Pick<Word, 'id' | 'term' | 'part_of_speech' | 'sense' | 'sense_key' | 'meaning'>[]> {
  const key = term.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!key) return [];
  let q = getSupabase().from('words').select('id, term, part_of_speech, sense, sense_key, meaning').eq('term_key', key);
  if (excludeId) q = q.neq('id', excludeId);
  return run(q);
}

export async function createWord(word: Partial<Word>): Promise<Word> {
  return run(getSupabase().from('words').insert(pick(word)).select().single());
}

export async function updateWord(id: string, patch: Partial<Word>): Promise<Word> {
  return run(getSupabase().from('words').update(pick(patch)).eq('id', id).select().single());
}

export async function deleteWord(id: string): Promise<null> {
  return run(getSupabase().from('words').delete().eq('id', id));
}

export async function listReviews(wordId: string): Promise<Review[]> {
  return run(
    getSupabase().from('reviews').select('*').eq('word_id', wordId).order('reviewed_at', { ascending: false }).limit(100),
  );
}

export async function listAllReviews(): Promise<Review[]> {
  return run(getSupabase().from('reviews').select('*').order('reviewed_at', { ascending: true }));
}

export async function getSettings(): Promise<SrsSettings> {
  const row = await run(getSupabase().from('user_settings').select('srs').maybeSingle()) as { srs?: Partial<SrsSettings> } | null;
  return normalizeSettings(row?.srs);
}

export async function saveSettings(srs: Partial<SrsSettings>): Promise<{ srs: SrsSettings }> {
  const { data: claims } = await getSupabase().auth.getClaims();
  return run(
    getSupabase()
      .from('user_settings')
      .upsert({ user_id: (claims as { claims?: { sub?: string } })?.claims?.sub, srs: normalizeSettings(srs) })
      .select()
      .single(),
  );
}

// ---------------------------------------------------------------------------
// Reviews, with a small offline outbox so a dropped connection never loses
// a rating. Pending reviews are kept in localStorage and replayed in order.
// ---------------------------------------------------------------------------

const OUTBOX_KEY = 'ielts-vocab:outbox';

interface OutboxEntry extends Omit<ReviewRecord, 'dueAt' | 'reviewedAt'> {
  dueAt: string;
  reviewedAt: string;
}

function readOutbox(): OutboxEntry[] {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]') as OutboxEntry[];
  } catch {
    return [];
  }
}

function writeOutbox(items: OutboxEntry[]): void {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode); nothing more we can do.
  }
}

export function pendingReviewCount(): number {
  return readOutbox().length;
}

function sendReview(r: OutboxEntry): Promise<Word> {
  return run(
    getSupabase().rpc('record_review', {
      p_word_id: r.wordId,
      p_mode: r.mode,
      p_rating: r.rating,
      p_correct: r.correct ?? null,
      p_answer: r.answer ?? null,
      p_early: r.early,
      p_ease: r.ease,
      p_interval: r.intervalDays,
      p_repetitions: r.repetitions,
      p_lapses: r.lapses,
      p_due_at: r.dueAt,
      p_confidence: r.confidence,
      p_reviewed_at: r.reviewedAt,
    }),
  );
}

export async function recordReview(review: ReviewRecord): Promise<RecordReviewResult> {
  const r: OutboxEntry = {
    ...review,
    dueAt: new Date(review.dueAt as string | Date).toISOString(),
    reviewedAt: new Date((review.reviewedAt as string | Date | undefined) ?? Date.now()).toISOString(),
  };
  if (readOutbox().length) {
    writeOutbox([...readOutbox(), r]);
    flushOutbox();
    return { saved: false };
  }
  try {
    const word = await sendReview(r);
    return { saved: true, word };
  } catch (err: unknown) {
    const e = err as { code?: string };
    if (e.code) throw err;
    writeOutbox([...readOutbox(), r]);
    return { saved: false };
  }
}

let flushing: Promise<number> | null = null;

export function flushOutbox(): Promise<number> {
  if (flushing) return flushing;
  flushing = (async () => {
    let items = readOutbox();
    while (items.length) {
      try {
        await sendReview(items[0]);
      } catch (err: unknown) {
        const e = err as { code?: string };
        if (e.code !== 'P0002') break;
      }
      items = items.slice(1);
      writeOutbox(items);
    }
    flushing = null;
    return items.length;
  })();
  return flushing;
}
