import { describe, expect, it } from 'vitest';
import { applyReview, DEFAULT_SRS, formatDelay, normalizeSettings, previewIntervals, schedule, startOfLocalDay, wordStatus } from '@/lib/srs';
import type { SrsCard } from '@/lib/types';

const NOW = new Date(2026, 9, 26, 14, 30); // 26 Oct 2026, 14:30 local
const newCard: SrsCard = { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, due_at: NOW.toISOString() };

function daysFromToday(date: Date): number {
  return Math.round((startOfLocalDay(date).getTime() - startOfLocalDay(NOW).getTime()) / 86_400_000);
}

describe('schedule (SM-2)', () => {
  it('new card: Again returns in minutes, Good in 1 day, Easy in 4 days', () => {
    const again = schedule(newCard, 'again', NOW);
    expect(again.dueAt.getTime() - NOW.getTime()).toBe(10 * 60_000);
    expect(again.repetitions).toBe(0);
    expect(again.lapses).toBe(0); // never learned, so not a lapse

    expect(daysFromToday(schedule(newCard, 'good', NOW).dueAt)).toBe(1);
    expect(daysFromToday(schedule(newCard, 'easy', NOW).dueAt)).toBe(4);
  });

  it('day intervals start at local midnight', () => {
    const { dueAt } = schedule(newCard, 'good', NOW);
    expect(dueAt.getHours()).toBe(0);
    expect(dueAt.getMinutes()).toBe(0);
  });

  it('second success uses the second interval, later ones multiply by ease', () => {
    const r1 = schedule(newCard, 'good', NOW);
    const card1: SrsCard = { ...newCard, ease: r1.ease, interval_days: r1.intervalDays, repetitions: r1.repetitions };
    const r2 = schedule(card1, 'good', NOW);
    expect(r2.intervalDays).toBe(6);
    const card2: SrsCard = { ...card1, ease: r2.ease, interval_days: r2.intervalDays, repetitions: r2.repetitions };
    const r3 = schedule(card2, 'good', NOW);
    expect(r3.intervalDays).toBe(15); // 6 × 2.5
  });

  it('orders intervals Again < Hard < Good < Easy for a reviewed card', () => {
    const card: SrsCard = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0, due_at: NOW.toISOString() };
    const [again, hard, good, easy] = (['again', 'hard', 'good', 'easy'] as const).map((r) => schedule(card, r, NOW));
    expect(again.intervalDays).toBe(0);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(good.intervalDays).toBeLessThan(easy.intervalDays);
    expect(hard.intervalDays).toBeGreaterThan(card.interval_days!);
  });

  it('adjusts ease with the SM-2 formula and never below 1.3', () => {
    const card: SrsCard = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0 };
    expect(schedule(card, 'good', NOW).ease).toBe(2.5);
    expect(schedule(card, 'easy', NOW).ease).toBe(2.6);
    expect(schedule(card, 'hard', NOW).ease).toBe(2.36);

    const lowCard: SrsCard = { ease: 1.35, interval_days: 1, repetitions: 1, lapses: 0 };
    expect(schedule(lowCard, 'again', NOW).ease).toBe(1.3);
  });

  it('Again on a new card does not add a lapse', () => {
    expect(schedule(newCard, 'again', NOW).lapses).toBe(0);
  });

  it('Again on a reviewed card adds a lapse', () => {
    const card: SrsCard = { ...newCard, repetitions: 2 };
    expect(schedule(card, 'again', NOW).lapses).toBe(1);
  });

  it('Easy always gives a longer interval than Good', () => {
    for (let reps = 0; reps <= 5; reps++) {
      const card: SrsCard = { ease: 2.5, interval_days: reps * 5, repetitions: reps, lapses: 0, due_at: NOW.toISOString() };
      const good = schedule(card, 'good', NOW);
      const easy = schedule(card, 'easy', NOW);
      expect(easy.intervalDays).toBeGreaterThan(good.intervalDays);
    }
  });

  it('respects maxIntervalDays', () => {
    const card: SrsCard = { ease: 4.0, interval_days: 300, repetitions: 10, lapses: 0, due_at: NOW.toISOString() };
    const result = schedule(card, 'easy', NOW, { ...DEFAULT_SRS, maxIntervalDays: 365 });
    expect(result.intervalDays).toBeLessThanOrEqual(365);
  });

  it('throws on unknown rating', () => {
    // @ts-expect-error intentional bad input
    expect(() => schedule(newCard, 'unknown', NOW)).toThrow();
  });
});

describe('normalizeSettings', () => {
  it('returns defaults for empty input', () => {
    expect(normalizeSettings({})).toEqual(DEFAULT_SRS);
  });

  it('clamps values to SRS_LIMITS', () => {
    const s = normalizeSettings({ againMinutes: 9999, startingEase: 0.1 });
    expect(s.againMinutes).toBe(1440);
    expect(s.startingEase).toBe(1.3);
  });

  it('ignores non-numeric values', () => {
    const s = normalizeSettings({ againMinutes: NaN } as Parameters<typeof normalizeSettings>[0]);
    expect(s.againMinutes).toBe(DEFAULT_SRS.againMinutes);
  });
});

describe('applyReview', () => {
  it('early Hard/Good/Easy does not change the schedule', () => {
    const futureCard: SrsCard = {
      ease: 2.5, interval_days: 5, repetitions: 2, lapses: 0,
      due_at: new Date(NOW.getTime() + 3 * 86_400_000).toISOString(),
    };
    const result = applyReview(futureCard, 'good', NOW);
    expect(result.changed).toBe(false);
    expect(result.early).toBe(true);
    expect(result.intervalDays).toBe(futureCard.interval_days);
  });

  it('early Again still resets the card', () => {
    const futureCard: SrsCard = {
      ease: 2.5, interval_days: 5, repetitions: 2, lapses: 0,
      due_at: new Date(NOW.getTime() + 3 * 86_400_000).toISOString(),
    };
    const result = applyReview(futureCard, 'again', NOW);
    expect(result.changed).toBe(true);
    expect(result.repetitions).toBe(0);
  });

  it('due today (early=false) changes the schedule', () => {
    const result = applyReview(newCard, 'good', NOW);
    expect(result.early).toBe(false);
    expect(result.changed).toBe(true);
  });
});

describe('previewIntervals', () => {
  it('returns strings for all four ratings', () => {
    const previews = previewIntervals(newCard, NOW);
    expect(typeof previews.again).toBe('string');
    expect(typeof previews.hard).toBe('string');
    expect(typeof previews.good).toBe('string');
    expect(typeof previews.easy).toBe('string');
  });

  it('shows no change for early cards (except Again)', () => {
    const futureCard: SrsCard = {
      ease: 2.5, interval_days: 5, repetitions: 2, lapses: 0,
      due_at: new Date(NOW.getTime() + 3 * 86_400_000).toISOString(),
    };
    const previews = previewIntervals(futureCard, NOW);
    expect(previews.good).toBe('no change');
    expect(previews.again).not.toBe('no change');
  });
});

describe('formatDelay', () => {
  it('shows minutes for sub-hour delays', () => {
    expect(formatDelay(new Date(NOW.getTime() + 10 * 60_000), NOW)).toBe('10m');
  });

  it('shows days for multi-day delays', () => {
    const dueAt = startOfLocalDay(new Date(NOW.getTime() + 3 * 86_400_000));
    expect(formatDelay(dueAt, NOW)).toBe('3d');
  });
});

describe('wordStatus', () => {
  it('returns archived for archived words', () => {
    expect(wordStatus({ status: 'archived', last_reviewed_at: null, interval_days: 0 })).toBe('archived');
  });

  it('returns new for words never reviewed', () => {
    expect(wordStatus({ status: 'active', last_reviewed_at: null, interval_days: 0 })).toBe('new');
  });

  it('returns mastered for words with interval >= 21', () => {
    expect(wordStatus({ status: 'active', last_reviewed_at: NOW.toISOString(), interval_days: 21 })).toBe('mastered');
  });

  it('returns learning for reviewed words below 21 days', () => {
    expect(wordStatus({ status: 'active', last_reviewed_at: NOW.toISOString(), interval_days: 5 })).toBe('learning');
  });
});
