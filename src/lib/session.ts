// Review session: queue building, mode selection and progress.
import { findCloze } from './answer';
import { isDueToday, startOfLocalDay, endOfLocalDay } from './srs';
import { verifiedReplacements, rejectedCandidates } from './senses';
import type {
  Word, ReviewMode, Rating, QueueItem, SessionState, SessionResultEntry,
  SessionSummary, Choice, SrsSettings,
} from './types';

export interface ModeInfo {
  label: string;
  short: string;
}

export const MODES: Record<ReviewMode, ModeInfo> = {
  recall: { label: 'Recall the meaning', short: 'Recall' },
  reverse: { label: 'Meaning → word', short: 'Reverse' },
  paraphrase: { label: 'Paraphrase it', short: 'Paraphrase' },
  cloze: { label: 'Fill the gap', short: 'Cloze' },
  type: { label: 'Type the word', short: 'Type' },
  choice: { label: 'Multiple choice', short: 'Choice' },
  synonym: { label: 'Synonym in context', short: 'Synonym' },
  listen: { label: 'Listen and type', short: 'Listen' },
};

export const CARDS_PER_MINUTE = 2;

const WEIGHTS: Record<'fresh' | 'mature', Partial<Record<ReviewMode, number>>> = {
  fresh: { recall: 3, choice: 3, reverse: 2, cloze: 1, type: 1, synonym: 1, paraphrase: 1, listen: 1 },
  mature: { recall: 1, choice: 1, reverse: 2, cloze: 3, type: 3, synonym: 2, paraphrase: 2, listen: 1 },
};

export function promptMeaning(word: Word): string {
  return word.meaning || word.sense?.definition || '';
}

export function isDifficult(word: Word): boolean {
  return (word.lapses ?? 0) >= 2 || (word.ease ?? 2.5) < 2.0;
}

export function distractorPool(word: Word, allWords: Word[]): Word[] {
  const others = allWords.filter(
    (w) => w.id !== word.id && w.term.toLowerCase() !== word.term.toLowerCase() && (promptMeaning(w) || w.uzbek),
  );
  const pos = word.part_of_speech;
  return [...others].sort((a, b) => Number(b.part_of_speech === pos) - Number(a.part_of_speech === pos));
}

function synonymDistractors(word: Word, allWords: Word[]): { word: string; note: string; from: string }[] {
  const rejected = rejectedCandidates(word.synonyms).map((s) => ({ word: s.word, note: s.note, from: 'rejected' }));
  const fits = new Set(verifiedReplacements(word.synonyms).map((s) => s.word.toLowerCase()));
  const others = distractorPool(word, allWords)
    .filter((w) => !fits.has(w.term.toLowerCase()))
    .map((w) => ({ word: w.term, note: promptMeaning(w) || w.uzbek, from: 'other' }));
  return [...rejected, ...others];
}

export function availableModes(word: Word, allWords: Word[], { audio = false } = {}): ReviewMode[] {
  const modes: ReviewMode[] = ['recall'];
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

export function pickMode(word: Word, modes: ReviewMode[], rng: () => number = Math.random, previousMode: ReviewMode | null = null): ReviewMode {
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

function byPriority(a: Word, b: Word): number {
  const due = new Date(a.due_at).getTime() - new Date(b.due_at).getTime();
  const dayA = startOfLocalDay(a.due_at).getTime();
  const dayB = startOfLocalDay(b.due_at).getTime();
  if (dayA !== dayB) return due;
  return (a.ease ?? 2.5) - (b.ease ?? 2.5) || (b.lapses ?? 0) - (a.lapses ?? 0) || due;
}

interface BuildQueueOptions {
  minutes?: number;
  now?: Date;
  rng?: () => number;
  audio?: boolean;
  practiceExtra?: boolean;
}

export function buildQueue(words: Word[], { minutes = 10, now = new Date(), rng = Math.random, audio = false, practiceExtra = true }: BuildQueueOptions = {}): QueueItem[] {
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
  let previous: ReviewMode | null = null;
  return chosen.map((w) => {
    const mode = pickMode(w, availableModes(w, active, { audio }), rng, previous);
    previous = mode;
    return { wordId: w.id, mode, early: !isDueToday(w, now), key: `${w.id}:0` };
  });
}

export function shuffle<T>(list: T[], rng: () => number = Math.random): T[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function buildChoices(word: Word, allWords: Word[], rng: () => number = Math.random): Choice[] {
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

export function buildSynonymChoices(word: Word, allWords: Word[], rng: () => number = Math.random): Choice[] {
  const fits = verifiedReplacements(word.synonyms);
  const answer = fits[Math.floor(rng() * fits.length)];
  const distractors = synonymDistractors(word, allWords).slice(0, 6);
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

export function startSession(queue: QueueItem[], { minutes, now = new Date() }: { minutes: number; now?: Date }): SessionState {
  return {
    queue,
    index: 0,
    results: [],
    minutes,
    startedAt: now.toISOString(),
    day: startOfLocalDay(now).toISOString(),
  };
}

export function currentItem(state: SessionState): QueueItem | null {
  return state.queue[state.index] ?? null;
}

export function rateCurrent(state: SessionState, { rating, newDueAt }: { rating: Rating; newDueAt: Date | string }): SessionState {
  const item = currentItem(state);
  if (!item) return state;
  const results: SessionResultEntry[] = [...state.results, { wordId: item.wordId, mode: item.mode, rating, newDueAt: new Date(newDueAt).toISOString() }];
  let queue = state.queue;
  const MAX_REQUEUES = 2;
  const REQUEUE_GAP = 3;
  const times = state.queue.filter((q) => q.wordId === item.wordId).length;
  if (rating === 'again' && times <= MAX_REQUEUES) {
    const insertAt = Math.min(queue.length, state.index + 1 + REQUEUE_GAP);
    const retry: QueueItem = { wordId: item.wordId, mode: 'recall', early: false, key: `${item.wordId}:${times}` };
    queue = [...queue.slice(0, insertAt), retry, ...queue.slice(insertAt)];
  }
  return { ...state, queue, results, index: state.index + 1 };
}

export function isFinished(state: SessionState, now: Date = new Date()): boolean {
  if (state.index >= state.queue.length) return true;
  const elapsed = now.getTime() - new Date(state.startedAt).getTime();
  if (elapsed < state.minutes * 60_000) return false;
  const remaining = state.queue.slice(state.index);
  const missed = new Set(state.results.filter((r) => r.rating === 'again').map((r) => r.wordId));
  return remaining.every((q) => !missed.has(q.wordId));
}

export function summarize(state: SessionState, now: Date = new Date()): SessionSummary {
  const lastByWord = new Map<string, SessionResultEntry>();
  const missed = new Set<string>();
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
    minutes: Math.max(1, Math.round((now.getTime() - new Date(state.startedAt).getTime()) / 60_000)),
  };
}
