import { describe, expect, it } from 'vitest';
import {
  availableModes, buildChoices, buildQueue, buildSynonymChoices, currentItem,
  isFinished, pickMode, rateCurrent, shuffle, startSession, summarize,
} from '@/lib/session';
import type { Word, QueueItem, SessionState } from '@/lib/types';

const NOW = new Date(2026, 9, 26, 14, 30);
const DUE = new Date(NOW.getTime() - 86_400_000).toISOString(); // yesterday
const FUTURE = new Date(NOW.getTime() + 86_400_000 * 5).toISOString(); // 5 days ahead

function makeWord(partial: Partial<Word>): Word {
  return {
    id: 'w1',
    term: 'mitigate',
    source: 'reading',
    context: 'New rules aim to mitigate the damage.',
    meaning: 'to make less harmful',
    uzbek: 'yumshatmoq',
    paraphrase: 'to lessen something bad',
    example: '',
    part_of_speech: 'verb',
    sense_key: '',
    sense: null,
    synonyms: [],
    audio: null,
    lookup_meta: null,
    status: 'active',
    ease: 2.5,
    interval_days: 1,
    repetitions: 0,
    lapses: 0,
    confidence: 3,
    due_at: DUE,
    last_reviewed_at: null,
    created_at: DUE,
    ...partial,
  };
}

const WORD = makeWord({});
const OTHERS = ['alleviate', 'exacerbate', 'undermine', 'amplify'].map((t, i) =>
  makeWord({ id: `o${i}`, term: t, meaning: `meaning of ${t}`, due_at: FUTURE }),
);
const ALL_WORDS = [WORD, ...OTHERS];

describe('availableModes', () => {
  it('always includes recall', () => {
    expect(availableModes(WORD, ALL_WORDS)).toContain('recall');
  });

  it('includes type and reverse when meaning exists', () => {
    const modes = availableModes(WORD, ALL_WORDS);
    expect(modes).toContain('type');
    expect(modes).toContain('reverse');
  });

  it('includes cloze when context contains the term', () => {
    expect(availableModes(WORD, ALL_WORDS)).toContain('cloze');
  });

  it('includes choice when enough distractors exist', () => {
    expect(availableModes(WORD, ALL_WORDS)).toContain('choice');
  });

  it('excludes synonym mode when no verified replacements', () => {
    expect(availableModes(WORD, ALL_WORDS)).not.toContain('synonym');
  });

  it('includes synonym mode when verified replacements + distractors exist', () => {
    const wordWithSyns = makeWord({
      synonyms: [
        { word: 'reduce', label: 'near', basis: 'test', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'fits', note: '', sources: [] },
        { word: 'lessen', label: 'near', basis: 'test', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'rejected', note: '', sources: [] },
      ],
    });
    expect(availableModes(wordWithSyns, ALL_WORDS)).toContain('synonym');
  });
});

describe('pickMode', () => {
  it('returns a valid mode from the list', () => {
    const modes = availableModes(WORD, ALL_WORDS);
    const mode = pickMode(WORD, modes);
    expect(modes).toContain(mode);
  });

  it('avoids repeating the previous mode when alternatives exist', () => {
    const modes = availableModes(WORD, ALL_WORDS);
    const counts: Record<string, number> = {};
    for (let i = 0; i < 100; i++) {
      const m = pickMode(WORD, modes, Math.random, 'recall');
      counts[m] = (counts[m] ?? 0) + 1;
    }
    expect(counts['recall'] ?? 0).toBe(0);
  });
});

describe('buildQueue', () => {
  it('includes due words first', () => {
    const queue = buildQueue(ALL_WORDS, { now: NOW });
    expect(queue.length).toBeGreaterThan(0);
    expect(queue[0].wordId).toBe(WORD.id);
  });

  it('respects the minutes limit', () => {
    const queue = buildQueue(ALL_WORDS, { minutes: 5, now: NOW, practiceExtra: false });
    expect(queue.length).toBeLessThanOrEqual(10);
  });

  it('excludes archived words', () => {
    const archived = makeWord({ id: 'arch', status: 'archived', due_at: DUE });
    const queue = buildQueue([...ALL_WORDS, archived], { now: NOW });
    expect(queue.every((q) => q.wordId !== 'arch')).toBe(true);
  });

  it('marks non-due words as early', () => {
    const queue = buildQueue(ALL_WORDS, { now: NOW, practiceExtra: true });
    const nonDue = queue.filter((q) => q.wordId !== WORD.id);
    expect(nonDue.every((q) => q.early)).toBe(true);
  });
});

describe('shuffle', () => {
  it('returns all elements', () => {
    const list = [1, 2, 3, 4, 5];
    const shuffled = shuffle(list);
    expect(shuffled.sort()).toEqual(list.sort());
  });

  it('does not mutate the original', () => {
    const list = [1, 2, 3];
    shuffle(list);
    expect(list).toEqual([1, 2, 3]);
  });
});

describe('buildChoices', () => {
  it('returns 4 choices with exactly one correct', () => {
    const choices = buildChoices(WORD, ALL_WORDS);
    expect(choices.length).toBe(4);
    expect(choices.filter((c) => c.correct).length).toBe(1);
  });

  it('correct choice is the word being reviewed', () => {
    const choices = buildChoices(WORD, ALL_WORDS);
    const correct = choices.find((c) => c.correct);
    expect(correct?.term).toBe(WORD.term);
  });
});

describe('startSession / currentItem / rateCurrent / isFinished', () => {
  const queue: QueueItem[] = [
    { wordId: 'w1', mode: 'recall', early: false, key: 'w1:0' },
    { wordId: 'w2', mode: 'type', early: false, key: 'w2:0' },
  ];

  it('starts at index 0', () => {
    const state = startSession(queue, { minutes: 10, now: NOW });
    expect(state.index).toBe(0);
    expect(currentItem(state)?.wordId).toBe('w1');
  });

  it('advances index on rateCurrent', () => {
    let state = startSession(queue, { minutes: 10, now: NOW });
    state = rateCurrent(state, { rating: 'good', newDueAt: new Date(NOW.getTime() + 86_400_000) });
    expect(state.index).toBe(1);
    expect(currentItem(state)?.wordId).toBe('w2');
  });

  it('requeues on Again', () => {
    let state = startSession(queue, { minutes: 10, now: NOW });
    state = rateCurrent(state, { rating: 'again', newDueAt: NOW });
    const requeued = state.queue.find((q, i) => i > state.index && q.wordId === 'w1');
    expect(requeued).toBeDefined();
  });

  it('isFinished when all cards done', () => {
    let state = startSession(queue, { minutes: 10, now: NOW });
    state = rateCurrent(state, { rating: 'good', newDueAt: NOW });
    state = rateCurrent(state, { rating: 'good', newDueAt: NOW });
    expect(isFinished(state, NOW)).toBe(true);
  });

  it('currentItem returns null when finished', () => {
    const state: SessionState = { queue, index: queue.length, results: [], minutes: 10, startedAt: NOW.toISOString(), day: '' };
    expect(currentItem(state)).toBeNull();
  });
});

describe('summarize', () => {
  it('counts reviewed, words, learned and missed', () => {
    const queue: QueueItem[] = [
      { wordId: 'w1', mode: 'recall', early: false, key: 'w1:0' },
      { wordId: 'w2', mode: 'recall', early: false, key: 'w2:0' },
    ];
    let state = startSession(queue, { minutes: 10, now: NOW });
    const futureDate = new Date(NOW.getTime() + 86_400_000 * 3);
    state = rateCurrent(state, { rating: 'good', newDueAt: futureDate });
    state = rateCurrent(state, { rating: 'again', newDueAt: NOW });
    const summary = summarize(state, NOW);
    expect(summary.reviewed).toBe(2);
    expect(summary.words).toBe(2);
    expect(summary.learned).toBe(1);
    expect(summary.missed).toBe(1);
  });
});
