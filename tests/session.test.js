import { describe, expect, it } from 'vitest';
import {
  availableModes, buildChoices, buildQueue, buildSynonymChoices, currentItem, isFinished, pickMode, rateCurrent, startSession, summarize,
} from '@/lib/session';

const NOW = new Date(2026, 9, 26, 9, 0);

function seeded(seed = 1) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

function word(id, extra = {}) {
  return {
    id,
    term: `term${id}`,
    meaning: `meaning ${id}`,
    uzbek: '',
    context: '',
    part_of_speech: 'noun',
    synonyms: [],
    status: 'active',
    ease: 2.5,
    interval_days: 0,
    repetitions: 0,
    lapses: 0,
    due_at: NOW.toISOString(),
    ...extra,
  };
}

const mitigate = word('m', {
  term: 'mitigate',
  part_of_speech: 'verb',
  context: 'New rules aim to mitigate the damage.',
  synonyms: [
    { word: 'reduce', verdict: 'fits', note: '' },
    { word: 'soothe', verdict: 'rejected', note: 'for feelings or pain' },
    { word: 'allay', verdict: 'rejected', note: 'for fears' },
  ],
});

describe('availableModes', () => {
  it('only offers modes the saved data supports', () => {
    expect(availableModes(word('a', { meaning: '', uzbek: '' }), [])).toEqual(['recall']);
    const others = [word('b'), word('c'), word('d')];
    const modes = availableModes(mitigate, [mitigate, ...others]);
    expect(modes).toEqual(expect.arrayContaining(['recall', 'reverse', 'type', 'paraphrase', 'cloze', 'choice', 'synonym']));
    expect(modes).not.toContain('listen');
    expect(availableModes(mitigate, [mitigate], { audio: true })).toContain('listen');
  });

  it('needs a verified replacement for the synonym mode', () => {
    const noFits = { ...mitigate, synonyms: mitigate.synonyms.map((s) => ({ ...s, verdict: 'unreviewed' })) };
    expect(availableModes(noFits, [noFits, word('b'), word('c')])).not.toContain('synonym');
  });
});

describe('pickMode', () => {
  it('avoids repeating the previous mode when possible', () => {
    const rng = seeded(3);
    for (let i = 0; i < 20; i++) {
      expect(pickMode(mitigate, ['recall', 'type'], rng, 'recall')).toBe('type');
    }
  });

  it('favours recognition modes for new words and production for mature ones', () => {
    const modes = ['recall', 'choice', 'type', 'cloze'];
    const count = (w) => {
      const rng = seeded(7);
      let production = 0;
      for (let i = 0; i < 400; i++) if (['type', 'cloze'].includes(pickMode(w, modes, rng))) production += 1;
      return production;
    };
    expect(count(mitigate)).toBeLessThan(count({ ...mitigate, repetitions: 5 }));
  });
});

describe('buildQueue', () => {
  it('puts due cards first, hardest first, and limits to the session size', () => {
    const words = [
      word('easy', { ease: 2.8 }),
      word('hard', { ease: 1.5 }),
      word('later', { due_at: new Date(2026, 10, 5).toISOString() }),
      word('archived', { status: 'archived' }),
    ];
    const q = buildQueue(words, { minutes: 1, now: NOW, rng: seeded() });
    expect(q.map((x) => x.wordId)).toEqual(['hard', 'easy']);
    expect(q.every((x) => !x.early)).toBe(true);
  });

  it('tops up with early practice when there is time, marked as early', () => {
    const words = [word('due'), word('later', { due_at: new Date(2026, 10, 5).toISOString() })];
    const q = buildQueue(words, { minutes: 5, now: NOW, rng: seeded() });
    expect(q.map((x) => [x.wordId, x.early])).toEqual([['due', false], ['later', true]]);
  });

  it('never includes archived words', () => {
    expect(buildQueue([word('a', { status: 'archived' })], { now: NOW })).toEqual([]);
  });
});

describe('session flow', () => {
  const queue = ['a', 'b', 'c', 'd', 'e'].map((id) => ({ wordId: id, mode: 'type', early: false, key: `${id}:0` }));

  it('brings a missed card back later in the same session, at most twice', () => {
    let s = startSession(queue, { minutes: 10, now: NOW });
    s = rateCurrent(s, { rating: 'again', newDueAt: NOW });
    expect(s.queue.map((q) => q.wordId)).toEqual(['a', 'b', 'c', 'd', 'a', 'e']);
    expect(s.queue[4].mode).toBe('recall');
    // Rate b, c, d good, then the retry of a again, and again.
    for (let i = 0; i < 3; i++) s = rateCurrent(s, { rating: 'good', newDueAt: new Date(2026, 9, 27) });
    expect(currentItem(s).wordId).toBe('a');
    s = rateCurrent(s, { rating: 'again', newDueAt: NOW });
    s = rateCurrent(s, { rating: 'good', newDueAt: new Date(2026, 9, 27) }); // e
    expect(currentItem(s).wordId).toBe('a');
    s = rateCurrent(s, { rating: 'again', newDueAt: NOW });
    expect(s.queue.filter((q) => q.wordId === 'a')).toHaveLength(3);
    expect(isFinished(s, NOW)).toBe(true);
  });

  it('ends when time is up, but finishes retries of missed cards first', () => {
    let s = startSession(queue, { minutes: 5, now: NOW });
    s = rateCurrent(s, { rating: 'again', newDueAt: NOW });
    const late = new Date(NOW.getTime() + 6 * 60_000);
    expect(isFinished(s, late)).toBe(false);
    for (let i = 0; i < 4; i++) s = rateCurrent(s, { rating: 'good', newDueAt: NOW });
    expect(isFinished(s, late)).toBe(true);
  });

  it('summarizes learned, missed and due-again counts', () => {
    let s = startSession(queue.slice(0, 3), { minutes: 10, now: NOW });
    s = rateCurrent(s, { rating: 'good', newDueAt: new Date(2026, 9, 27) });
    s = rateCurrent(s, { rating: 'again', newDueAt: new Date(NOW.getTime() + 600_000) });
    s = rateCurrent(s, { rating: 'easy', newDueAt: new Date(2026, 9, 30) });
    const sum = summarize(s, NOW);
    expect(sum).toMatchObject({ reviewed: 3, words: 3, learned: 2, missed: 1, dueAgainToday: 1 });
    expect(sum.missedIds).toEqual(['b']);
  });
});

describe('choices', () => {
  const others = [word('b'), word('c'), word('d', { part_of_speech: 'verb' }), word('e', { part_of_speech: 'verb' }), word('f', { part_of_speech: 'verb' })];

  it('multiple choice has one correct answer and plausible same-part-of-speech distractors', () => {
    const c = buildChoices(mitigate, [mitigate, ...others], seeded());
    expect(c).toHaveLength(4);
    expect(c.filter((o) => o.correct).map((o) => o.term)).toEqual(['mitigate']);
    expect(c.filter((o) => !o.correct).map((o) => o.term).sort()).toEqual(['termd', 'terme', 'termf']);
    expect(c.every((o) => o.explanation)).toBe(true);
  });

  it('synonym choice uses a verified replacement and explains rejected candidates', () => {
    const c = buildSynonymChoices(mitigate, [mitigate, ...others], seeded());
    expect(c.find((o) => o.correct).term).toBe('reduce');
    const soothe = c.find((o) => o.term === 'soothe');
    expect(soothe.correct).toBe(false);
    expect(soothe.explanation).toBe('for feelings or pain');
  });
});
