import { describe, expect, it } from 'vitest';
import { applyReview, DEFAULT_SRS, formatDelay, normalizeSettings, previewIntervals, schedule, startOfLocalDay, wordStatus } from '@/lib/srs';

const NOW = new Date(2026, 9, 26, 14, 30); // 26 Oct 2026, 14:30 local
const newCard = { ease: 2.5, interval_days: 0, repetitions: 0, lapses: 0, due_at: NOW.toISOString() };

function daysFromToday(date) {
  return Math.round((startOfLocalDay(date) - startOfLocalDay(NOW)) / 86_400_000);
}

describe('schedule (SM-2)', () => {
  it('new card: Again returns in minutes, Good in 1 day, Easy in 4 days', () => {
    const again = schedule(newCard, 'again', NOW);
    expect(again.dueAt - NOW).toBe(10 * 60_000);
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
    const card1 = { ...newCard, ease: r1.ease, interval_days: r1.intervalDays, repetitions: r1.repetitions };
    const r2 = schedule(card1, 'good', NOW);
    expect(r2.intervalDays).toBe(6);
    const card2 = { ...card1, ease: r2.ease, interval_days: r2.intervalDays, repetitions: r2.repetitions };
    const r3 = schedule(card2, 'good', NOW);
    expect(r3.intervalDays).toBe(15); // 6 × 2.5
  });

  it('orders intervals Again < Hard < Good < Easy for a reviewed card', () => {
    const card = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0, due_at: NOW.toISOString() };
    const [again, hard, good, easy] = ['again', 'hard', 'good', 'easy'].map((r) => schedule(card, r, NOW));
    expect(again.intervalDays).toBe(0);
    expect(hard.intervalDays).toBeLessThan(good.intervalDays);
    expect(good.intervalDays).toBeLessThan(easy.intervalDays);
    expect(hard.intervalDays).toBeGreaterThan(card.interval_days);
  });

  it('adjusts ease with the SM-2 formula and never below 1.3', () => {
    const card = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0 };
    expect(schedule(card, 'good', NOW).ease).toBe(2.5);
    expect(schedule(card, 'easy', NOW).ease).toBe(2.6);
    expect(schedule(card, 'hard', NOW).ease).toBe(2.36);
    expect(schedule(card, 'again', NOW).ease).toBe(2.3);
    expect(schedule({ ...card, ease: 1.35 }, 'again', NOW).ease).toBe(1.3);
  });

  it('Again on a learned card counts a lapse and resets repetitions', () => {
    const r = schedule({ ease: 2.5, interval_days: 20, repetitions: 4, lapses: 1 }, 'again', NOW);
    expect(r.lapses).toBe(2);
    expect(r.repetitions).toBe(0);
  });

  it('difficult words come back sooner than easy ones', () => {
    const card = { ease: 2.5, interval_days: 6, repetitions: 2, lapses: 0 };
    expect(schedule(card, 'hard', NOW).dueAt < schedule(card, 'easy', NOW).dueAt).toBe(true);
    const hardCard = { ...card, ease: 1.5 };
    expect(schedule(hardCard, 'good', NOW).intervalDays).toBeLessThan(schedule(card, 'good', NOW).intervalDays);
  });

  it('respects adjustable settings and the maximum interval', () => {
    const custom = { ...DEFAULT_SRS, againMinutes: 1, firstIntervalDays: 2, maxIntervalDays: 30 };
    expect(schedule(newCard, 'again', NOW, custom).dueAt - NOW).toBe(60_000);
    expect(schedule(newCard, 'good', NOW, custom).intervalDays).toBe(2);
    const old = { ease: 2.5, interval_days: 25, repetitions: 6, lapses: 0 };
    expect(schedule(old, 'easy', NOW, custom).intervalDays).toBe(30);
  });

  it('clamps invalid settings', () => {
    const s = normalizeSettings({ againMinutes: -5, easyBonus: 'abc', maxIntervalDays: 99999 });
    expect(s.againMinutes).toBe(1);
    expect(s.easyBonus).toBe(DEFAULT_SRS.easyBonus);
    expect(s.maxIntervalDays).toBe(3650);
  });

  it('rejects unknown ratings', () => {
    expect(() => schedule(newCard, 'perfect', NOW)).toThrow();
  });
});

describe('applyReview (early practice)', () => {
  const notDue = { ease: 2.5, interval_days: 10, repetitions: 3, lapses: 0, due_at: new Date(2026, 10, 3).toISOString() };

  it('does not stretch the interval when a card is practised early', () => {
    const r = applyReview(notDue, 'easy', NOW);
    expect(r.early).toBe(true);
    expect(r.changed).toBe(false);
    expect(r.intervalDays).toBe(10);
    expect(r.dueAt.toISOString()).toBe(notDue.due_at);
  });

  it('still resets an early card rated Again', () => {
    const r = applyReview(notDue, 'again', NOW);
    expect(r.changed).toBe(true);
    expect(r.repetitions).toBe(0);
  });

  it('treats cards due later today as due', () => {
    const laterToday = { ...notDue, due_at: new Date(2026, 9, 26, 22, 0).toISOString() };
    expect(applyReview(laterToday, 'good', NOW).changed).toBe(true);
  });

  it('previews intervals for each button', () => {
    expect(previewIntervals(newCard, NOW)).toEqual({ again: '10m', hard: '1d', good: '1d', easy: '4d' });
    expect(previewIntervals(notDue, NOW).good).toBe('no change');
  });
});

describe('helpers', () => {
  it('formats delays', () => {
    expect(formatDelay(new Date(NOW.getTime() + 10 * 60_000), NOW)).toBe('10m');
    expect(formatDelay(new Date(2026, 10, 1), NOW)).toBe('6d');
    expect(formatDelay(new Date(2027, 1, 1), NOW)).toBe('3mo');
  });

  it('derives word status', () => {
    expect(wordStatus({ status: 'active', last_reviewed_at: null })).toBe('new');
    expect(wordStatus({ status: 'active', last_reviewed_at: 'x', interval_days: 5 })).toBe('learning');
    expect(wordStatus({ status: 'active', last_reviewed_at: 'x', interval_days: 30 })).toBe('mastered');
    expect(wordStatus({ status: 'archived' })).toBe('archived');
  });
});
