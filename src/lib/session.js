// Review session: queue building, mode selection and progress.
import { findCloze } from './answer.js';
import { isDueToday, startOfLocalDay, endOfLocalDay } from './srs.js';
import { verifiedReplacements, rejectedCandidates } from './senses.js';

export const MODES = {
  recall: { label: 'Recall the meaning', short: 'Recall' },
  reverse: { label: 'Meaning → word', short: 'Reverse' },
  paraphrase: { label: 'Paraphrase it', short: 'Paraphrase' },
  cloze: { label: 'Fill the gap', short: 'Cloze' },
  type: { label: 'Type the word', short: 'Type' },
  choice: { label: 'Multiple choice', short: 'Choice' },
  synonym: { label: 'Synonym in context', short: 'Synonym' },
  listen: { label: 'Listen and type', short: 'Listen' },
};

// Roughly 30 seconds per card.
export const CARDS_PER_MINUTE = 2;

// Weights favour recognition for new/difficult words and production for mature ones.
const WEIGHTS = {
  fresh: { recall: 3, choice: 3, reverse: 2, cloze: 1, type: 1, synonym: 1, paraphrase: 1, listen: 1 },
  mature: { recall: 1, choice: 1, reverse: 2, cloze: 3, type: 3, synonym: 2, paraphrase: 2, listen: 1 },
};

export function promptMeaning(word) {
  return word.meaning || word.sense?.definition || '';
}

export function isDifficult(word) {
  return (word.lapses ?? 0) >= 2 || (word.ease ?? 2.5) < 2.0;
}

/** Other words usable as multiple-choice distractors, preferring the same part of speech. */
export function distractorPool(word, allWords) {
  const others = allWords.filter(
    (w) => w.id !== word.id && w.term.toLowerCase() !== word.term.toLowerCase() && (promptMeaning(w) || w.uzbek),
  );
  const pos = word.part_of_speech;
  return [...others].sort((a, b) => Number(b.part_of_speech === pos) - Number(a.part_of_speech === pos));
}

function synonymDistractors(word, allWords) {
  const rejected = rejectedCandidates(word.synonyms).map((s) => ({ word: s.word, note: s.note, from: 'rejected' }));
  const fits = new Set(verifiedReplacements(word.synonyms).map((s) => s.word.toLowerCase()));
  const others = distractorPool(word, allWords)
    .filter((w) => !fits.has(w.term.toLowerCase()))
    .map((w) => ({ word: w.term, note: promptMeaning(w) || w.uzbek, from: 'other' }));
  return [...rejected, ...others];
}

export function availableModes(word, allWords, { audio = false } = {}) {
  const modes = ['recall'];
  const hasMeaning = Boolean(promptMeaning(word) || word.uzbek);
  if (hasMeaning) modes.push('reverse', 'type');
  if (promptMeaning(word) || word.paraphrase) modes.push('paraphrase');
  if (findCloze(word.context, word.term)) modes.push('cloze');
  if (hasMeaning && distractorPool(word, allWords).length >= 3) modes.push('choice');
  if (
    verifiedReplacements(word.synonyms).length > 0 &&
    findCloze(word.context, word.term) &&
    synonymDistractors(word, allWords).length >= 2
  ) {
    modes.push('synonym');
  }
  if (word.audio?.url || audio) modes.push('listen');
  return modes;
}

export function pickMode(word, modes, rng = Math.random, previousMode = null) {
  const mature = (word.repetitions ?? 0) >= 2 && !isDifficult(word);
  const weights = mature ? WEIGHTS.mature : WEIGHTS.fresh;
  let options = modes.length > 1 ? modes.filter((m) => m !== previousMode) : modes;
  if (!options.length) options = ['recall'];
  const total = options.reduce((sum, m) => sum + (weights[m] ?? 1), 0);
  let r = rng() * total;
  for (const m of options) {
    r -= weights[m] ?? 1;
    if (r < 0) return m;
  }
  return options[options.length - 1];
}

/** Hardest and most overdue first. */
function byPriority(a, b) {
  const due = new Date(a.due_at) - new Date(b.due_at);
  const dayA = startOfLocalDay(a.due_at).getTime();
  const dayB = startOfLocalDay(b.due_at).getTime();
  if (dayA !== dayB) return due;
  return (a.ease ?? 2.5) - (b.ease ?? 2.5) || (b.lapses ?? 0) - (a.lapses ?? 0) || due;
}

/**
 * Build the queue for a session.
 * Due cards come first. If the learner has time left (or nothing is due),
 * the queue is topped up with not-yet-due cards, difficult ones first;
 * those reviews are marked "early" and won't stretch intervals.
 */
export function buildQueue(words, { minutes = 10, now = new Date(), rng = Math.random, audio = false, practiceExtra = true } = {}) {
  const active = words.filter((w) => w.status !== 'archived');
  const target = Math.max(1, minutes * CARDS_PER_MINUTE);
  const due = active.filter((w) => isDueToday(w, now)).sort(byPriority);
  let chosen = due.slice(0, target);
  if (practiceExtra && chosen.length < target) {
    const extra = active
      .filter((w) => !isDueToday(w, now))
      .sort((a, b) => Number(isDifficult(b)) - Number(isDifficult(a)) || byPriority(a, b))
      .slice(0, target - chosen.length);
    chosen = chosen.concat(extra);
  }
  let previous = null;
  return chosen.map((w) => {
    const mode = pickMode(w, availableModes(w, active, { audio }), rng, previous);
    previous = mode;
    return { wordId: w.id, mode, early: !isDueToday(w, now), key: `${w.id}:0` };
  });
}

/** Simple Fisher–Yates using the provided rng (tests pass a seeded one). */
export function shuffle(list, rng = Math.random) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildChoices(word, allWords, rng = Math.random) {
  const pool = distractorPool(word, allWords);
  const samePos = pool.filter((w) => w.part_of_speech && w.part_of_speech === word.part_of_speech);
  const picked = shuffle(samePos.length >= 3 ? samePos : pool, rng).slice(0, 3);
  return shuffle(
    [
      { term: word.term, explanation: promptMeaning(word) || word.uzbek, correct: true },
      ...picked.map((w) => ({ term: w.term, explanation: promptMeaning(w) || w.uzbek, correct: false })),
    ],
    rng,
  );
}

export function buildSynonymChoices(word, allWords, rng = Math.random) {
  const fits = verifiedReplacements(word.synonyms);
  const answer = fits[Math.floor(rng() * fits.length)];
  const distractors = synonymDistractors(word, allWords).slice(0, 6);
  // Prefer the learner's own rejected candidates: they are the instructive near-misses.
  const picked = [
    ...distractors.filter((d) => d.from === 'rejected').slice(0, 3),
    ...shuffle(distractors.filter((d) => d.from === 'other'), rng),
  ].slice(0, 3);
  return shuffle(
    [
      { term: answer.word, explanation: answer.note || 'You marked this as fitting your sentence.', correct: true },
      ...picked.map((d) => ({
        term: d.word,
        explanation: d.from === 'rejected' ? d.note || "You marked this as not fitting this sentence." : `A different word in your list: ${d.note}`,
        correct: false,
      })),
    ],
    rng,
  );
}

// ---------------------------------------------------------------------------
// Session progress (pure; persisted to localStorage by the UI).
// ---------------------------------------------------------------------------

const MAX_REQUEUES = 2;
const REQUEUE_GAP = 3;

export function startSession(queue, { minutes, now = new Date() }) {
  return {
    queue,
    index: 0,
    results: [],
    minutes,
    startedAt: now.toISOString(),
    day: startOfLocalDay(now).toISOString(),
  };
}

export function currentItem(state) {
  return state.queue[state.index] ?? null;
}

/**
 * Record a rating and advance. A card rated Again comes back a few cards later
 * in the same session (up to twice), in recall mode so it can be relearned.
 */
export function rateCurrent(state, { rating, newDueAt }) {
  const item = currentItem(state);
  if (!item) return state;
  const results = [...state.results, { wordId: item.wordId, mode: item.mode, rating, newDueAt: new Date(newDueAt).toISOString() }];
  let queue = state.queue;
  const times = state.queue.filter((q) => q.wordId === item.wordId).length;
  if (rating === 'again' && times <= MAX_REQUEUES) {
    const insertAt = Math.min(queue.length, state.index + 1 + REQUEUE_GAP);
    const retry = { wordId: item.wordId, mode: 'recall', early: false, key: `${item.wordId}:${times}` };
    queue = [...queue.slice(0, insertAt), retry, ...queue.slice(insertAt)];
  }
  return { ...state, queue, results, index: state.index + 1 };
}

export function isFinished(state, now = new Date()) {
  if (state.index >= state.queue.length) return true;
  // Out of time: finish once the current card would start past the budget,
  // but always let pending in-session retries of missed cards finish first.
  const elapsed = now - new Date(state.startedAt);
  if (elapsed < state.minutes * 60_000) return false;
  const remaining = state.queue.slice(state.index);
  const missed = new Set(state.results.filter((r) => r.rating === 'again').map((r) => r.wordId));
  return remaining.every((q) => !missed.has(q.wordId));
}

export function summarize(state, now = new Date()) {
  const lastByWord = new Map();
  const missed = new Set();
  for (const r of state.results) {
    lastByWord.set(r.wordId, r);
    if (r.rating === 'again') missed.add(r.wordId);
  }
  const endToday = endOfLocalDay(now);
  let learned = 0;
  let dueAgainToday = 0;
  for (const r of lastByWord.values()) {
    if (r.rating === 'good' || r.rating === 'easy') learned += 1;
    if (new Date(r.newDueAt) < endToday) dueAgainToday += 1;
  }
  return {
    reviewed: state.results.length,
    words: lastByWord.size,
    learned,
    missed: missed.size,
    missedIds: [...missed],
    dueAgainToday,
    minutes: Math.max(1, Math.round((now - new Date(state.startedAt)) / 60_000)),
  };
}
