// SM-2 spaced repetition with four answer buttons.
//
// Based on Wozniak's SM-2 (1987): each card has an ease factor (EF, min 1.3)
// and an interval. A successful review multiplies the interval by EF; EF is
// adjusted with the SM-2 formula using the quality mapped from the button:
//   Hard -> q=3, Good -> q=4, Easy -> q=5.
// "Again" resets the card (repetitions = 0), lowers EF by 0.2 and brings it
// back after a short delay in minutes.
//
// Day intervals are anchored to the start of the learner's local day so a
// card scheduled "in 1 day" is due all of tomorrow, not at the same minute.

import type { Rating, SrsSettings, SrsCard, ScheduleResult, ApplyReviewResult, WordStatus } from './types';

export type { Rating, SrsSettings, SrsCard, ScheduleResult, ApplyReviewResult, WordStatus };

export const RATINGS: Rating[] = ['again', 'hard', 'good', 'easy'];

export const RATING_LABELS: Record<Rating, string> = {
  again: 'Again',
  hard: 'Hard',
  good: 'Good',
  easy: 'Easy',
};

const QUALITY: Record<Exclude<Rating, 'again'>, number> = { hard: 3, good: 4, easy: 5 };

export const DEFAULT_SRS: Readonly<SrsSettings> = Object.freeze({
  againMinutes: 10,
  firstIntervalDays: 1,
  secondIntervalDays: 6,
  easyFirstIntervalDays: 4,
  hardMultiplier: 1.2,
  easyBonus: 1.3,
  startingEase: 2.5,
  maxIntervalDays: 365,
});

export const MIN_EASE = 1.3;
const MAX_EASE = 5;

export const SRS_LIMITS: Record<keyof SrsSettings, [number, number]> = {
  againMinutes: [1, 1440],
  firstIntervalDays: [1, 30],
  secondIntervalDays: [1, 60],
  easyFirstIntervalDays: [1, 60],
  hardMultiplier: [1, 2],
  easyBonus: [1, 3],
  startingEase: [1.3, 3.5],
  maxIntervalDays: [7, 3650],
};

export function normalizeSettings(input: Partial<SrsSettings> = {}): SrsSettings {
  const out = {} as SrsSettings;
  for (const [key, fallback] of Object.entries(DEFAULT_SRS) as [keyof SrsSettings, number][]) {
    const raw = Number(input?.[key]);
    const [min, max] = SRS_LIMITS[key];
    out[key] = Number.isFinite(raw) ? Math.min(max, Math.max(min, raw)) : fallback;
  }
  return out;
}

export function startOfLocalDay(date: Date | string | number): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

export function addLocalDays(date: Date | string | number, days: number): Date {
  const d = startOfLocalDay(date);
  d.setDate(d.getDate() + days);
  return d;
}

export function endOfLocalDay(date: Date | string | number): Date {
  return addLocalDays(date, 1);
}

export function isDueToday(card: SrsCard, now: Date = new Date()): boolean {
  return new Date(card.due_at ?? 0) < endOfLocalDay(now);
}

function sm2Ease(ease: number, quality: number): number {
  const next = ease + (0.1 - (5 - quality) * (0.08 + (5 - quality) * 0.02));
  return round2(Math.min(MAX_EASE, Math.max(MIN_EASE, next)));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function schedule(card: SrsCard, rating: Rating, now: Date = new Date(), settings: SrsSettings = DEFAULT_SRS): ScheduleResult {
  if (!RATINGS.includes(rating)) throw new Error(`Unknown rating: ${rating}`);
  const s = normalizeSettings(settings);
  const ease = Number.isFinite(card.ease) ? (card.ease as number) : s.startingEase;
  const reps = card.repetitions ?? 0;
  const prev = card.interval_days ?? 0;
  const lapses = card.lapses ?? 0;

  if (rating === 'again') {
    return {
      ease: round2(Math.max(MIN_EASE, ease - 0.2)),
      intervalDays: 0,
      repetitions: 0,
      lapses: reps > 0 ? lapses + 1 : lapses,
      dueAt: new Date(now.getTime() + s.againMinutes * 60_000),
      confidence: 1,
    };
  }

  const nextEase = sm2Ease(ease, QUALITY[rating]);
  const intervals = nextIntervals(reps, prev, nextEase, s);
  const intervalDays = Math.min(s.maxIntervalDays, intervals[rating]);

  return {
    ease: nextEase,
    intervalDays,
    repetitions: reps + 1,
    lapses,
    dueAt: addLocalDays(now, intervalDays),
    confidence: rating === 'hard' ? 2 : rating === 'easy' ? 5 : intervalDays >= 21 ? 4 : 3,
  };
}

function nextIntervals(reps: number, prev: number, ease: number, s: SrsSettings): Record<Exclude<Rating, 'again'>, number> {
  if (reps === 0) {
    return {
      hard: s.firstIntervalDays,
      good: s.firstIntervalDays,
      easy: Math.max(s.easyFirstIntervalDays, s.firstIntervalDays + 1),
    };
  }
  const base = Math.max(1, prev);
  const hard = Math.max(base + 1, Math.round(base * s.hardMultiplier));
  const good = Math.max(
    hard,
    reps === 1 ? s.secondIntervalDays : Math.round(base * ease),
  );
  const easy = Math.max(good + 1, Math.round(good * s.easyBonus));
  return { hard, good, easy };
}

export function applyReview(card: SrsCard, rating: Rating, now: Date = new Date(), settings: SrsSettings = DEFAULT_SRS): ApplyReviewResult {
  const early = !isDueToday(card, now);
  if (early && rating !== 'again') {
    return {
      early: true,
      changed: false,
      ease: card.ease ?? DEFAULT_SRS.startingEase,
      intervalDays: card.interval_days ?? 0,
      repetitions: card.repetitions ?? 0,
      lapses: card.lapses ?? 0,
      dueAt: new Date(card.due_at ?? 0),
      confidence: Math.max(card.confidence ?? 0, rating === 'hard' ? 2 : 3),
    };
  }
  return { early, changed: true, ...schedule(card, rating, now, settings) };
}

export function previewIntervals(card: SrsCard, now: Date = new Date(), settings: SrsSettings = DEFAULT_SRS): Record<Rating, string> {
  const out = {} as Record<Rating, string>;
  for (const rating of RATINGS) {
    const r = applyReview(card, rating, now, settings);
    out[rating] = r.changed ? formatDelay(r.dueAt, now) : 'no change';
  }
  return out;
}

export function formatDelay(dueAt: Date | string, now: Date = new Date()): string {
  const ms = new Date(dueAt).getTime() - now.getTime();
  if (ms < 60 * 60_000) return `${Math.max(1, Math.round(ms / 60_000))}m`;
  const days = Math.round((startOfLocalDay(dueAt).getTime() - startOfLocalDay(now).getTime()) / 86_400_000);
  if (days < 1) return `${Math.round(ms / 3_600_000)}h`;
  if (days < 30) return `${days}d`;
  if (days < 365) return `${Math.round(days / 30)}mo`;
  return `${(days / 365).toFixed(1)}y`;
}

export function wordStatus(word: Pick<SrsCard, 'interval_days'> & { status?: string; last_reviewed_at?: string | null }): WordStatus {
  if (word.status === 'archived') return 'archived';
  if (!word.last_reviewed_at) return 'new';
  if ((word.interval_days ?? 0) >= 21) return 'mastered';
  return 'learning';
}
