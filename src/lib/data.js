'use client';
// Data access from the browser. Row-level security limits every query to the
// signed-in user's rows.
import { getSupabase } from './supabase/client';
import { normalizeSettings } from './srs';

const WORD_FIELDS = [
  'term', 'source', 'context', 'meaning', 'uzbek', 'paraphrase', 'example',
  'part_of_speech', 'sense_key', 'sense', 'synonyms', 'audio', 'lookup_meta', 'status',
];

function pick(obj) {
  const out = {};
  for (const k of WORD_FIELDS) if (k in obj) out[k] = obj[k];
  return out;
}

export function friendlyError(error) {
  if (!error) return null;
  if (typeof navigator !== 'undefined' && !navigator.onLine) return 'You are offline. Check your connection and try again.';
  if (error.code === '23505') return 'You already saved this word with the same sense. Choose a different sense or edit the existing entry.';
  if (error.code === '42501') return 'Permission denied. Try signing out and in again.';
  if (/fetch|network/i.test(error.message ?? '')) return 'Could not reach the server. Check your connection and try again.';
  return error.message || 'Something went wrong.';
}

async function run(query) {
  const { data, error } = await query;
  if (error) throw Object.assign(new Error(friendlyError(error)), { code: error.code });
  return data;
}

export async function listWords() {
  return run(getSupabase().from('words').select('*').order('created_at', { ascending: false }));
}

export async function getWord(id) {
  return run(getSupabase().from('words').select('*').eq('id', id).maybeSingle());
}

export async function findByTerm(term, excludeId) {
  const key = term.replace(/\s+/g, ' ').trim().toLowerCase();
  if (!key) return [];
  let q = getSupabase().from('words').select('id, term, part_of_speech, sense, sense_key, meaning').eq('term_key', key);
  if (excludeId) q = q.neq('id', excludeId);
  return run(q);
}

export async function createWord(word) {
  return run(getSupabase().from('words').insert(pick(word)).select().single());
}

export async function updateWord(id, patch) {
  return run(getSupabase().from('words').update(pick(patch)).eq('id', id).select().single());
}

export async function deleteWord(id) {
  return run(getSupabase().from('words').delete().eq('id', id));
}

export async function listReviews(wordId) {
  return run(
    getSupabase().from('reviews').select('*').eq('word_id', wordId).order('reviewed_at', { ascending: false }).limit(100),
  );
}

export async function listAllReviews() {
  return run(getSupabase().from('reviews').select('*').order('reviewed_at', { ascending: true }));
}

export async function getSettings() {
  const row = await run(getSupabase().from('user_settings').select('srs').maybeSingle());
  return normalizeSettings(row?.srs);
}

export async function saveSettings(srs) {
  const { data: claims } = await getSupabase().auth.getClaims();
  return run(
    getSupabase()
      .from('user_settings')
      .upsert({ user_id: claims?.claims?.sub, srs: normalizeSettings(srs) })
      .select()
      .single(),
  );
}

// ---------------------------------------------------------------------------
// Reviews, with a small offline outbox so a dropped connection never loses
// a rating. Pending reviews are kept in localStorage and replayed in order.
// ---------------------------------------------------------------------------

const OUTBOX_KEY = 'ielts-vocab:outbox';

function readOutbox() {
  try {
    return JSON.parse(localStorage.getItem(OUTBOX_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function writeOutbox(items) {
  try {
    localStorage.setItem(OUTBOX_KEY, JSON.stringify(items));
  } catch {
    // Storage unavailable (private mode); nothing more we can do.
  }
}

export function pendingReviewCount() {
  return readOutbox().length;
}

function sendReview(r) {
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

/** @returns {Promise<{saved: boolean, word?: object}>} saved=false means queued offline. */
export async function recordReview(review) {
  const r = { ...review, dueAt: new Date(review.dueAt).toISOString(), reviewedAt: new Date(review.reviewedAt ?? Date.now()).toISOString() };
  if (readOutbox().length) {
    writeOutbox([...readOutbox(), r]);
    flushOutbox();
    return { saved: false };
  }
  try {
    const word = await sendReview(r);
    return { saved: true, word };
  } catch (err) {
    if (err.code) throw err; // A real database error: surface it, don't retry forever.
    writeOutbox([...readOutbox(), r]);
    return { saved: false };
  }
}

let flushing = null;

export function flushOutbox() {
  if (flushing) return flushing;
  flushing = (async () => {
    let items = readOutbox();
    while (items.length) {
      try {
        await sendReview(items[0]);
      } catch (err) {
        // Word deleted meanwhile (P0002): drop it. Network problem: stop and retry later.
        if (err.code !== 'P0002') break;
      }
      items = items.slice(1);
      writeOutbox(items);
    }
    flushing = null;
    return items.length;
  })();
  return flushing;
}
