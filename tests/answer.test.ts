import { describe, expect, it } from 'vitest';
import { normalizeAnswer, levenshtein, checkAnswer, findCloze, neighbours, usesTerm } from '@/lib/answer';

describe('normalizeAnswer', () => {
  it('lowercases and strips punctuation', () => {
    expect(normalizeAnswer('Hello, World!')).toBe('hello world');
  });

  it('strips diacritics', () => {
    expect(normalizeAnswer('café')).toBe('cafe');
  });

  it('collapses whitespace', () => {
    expect(normalizeAnswer('  a  b  ')).toBe('a b');
  });

  it('handles non-strings', () => {
    expect(normalizeAnswer(null)).toBe('');
    expect(normalizeAnswer(undefined)).toBe('');
    expect(normalizeAnswer(42)).toBe('42');
  });
});

describe('levenshtein', () => {
  it('returns 0 for identical strings', () => {
    expect(levenshtein('abc', 'abc')).toBe(0);
  });

  it('returns length for empty string vs non-empty', () => {
    expect(levenshtein('', 'abc')).toBe(3);
    expect(levenshtein('abc', '')).toBe(3);
  });

  it('counts insertions, deletions, substitutions', () => {
    expect(levenshtein('kitten', 'sitting')).toBe(3);
    expect(levenshtein('mitigate', 'mtigate')).toBe(1);
    expect(levenshtein('mitigate', 'mitigated')).toBe(1);
  });
});

describe('checkAnswer', () => {
  it('accepts exact match', () => {
    const r = checkAnswer('mitigate', 'mitigate');
    expect(r.correct).toBe(true);
    expect(r.typo).toBe(false);
    expect(r.matched).toBe('mitigate');
  });

  it('accepts case-insensitive match', () => {
    expect(checkAnswer('MITIGATE', 'mitigate').correct).toBe(true);
  });

  it('strips leading "to" from answer and target', () => {
    expect(checkAnswer('to mitigate', 'mitigate').correct).toBe(true);
    expect(checkAnswer('mitigate', 'to mitigate').correct).toBe(true);
  });

  it('accepts array of accepted answers', () => {
    expect(checkAnswer('reduce', ['lessen', 'reduce', 'diminish']).correct).toBe(true);
  });

  it('accepts a small typo for long words', () => {
    const r = checkAnswer('mitigatte', 'mitigate');
    expect(r.correct).toBe(true);
    expect(r.typo).toBe(true);
  });

  it('rejects wrong answer', () => {
    expect(checkAnswer('exacerbate', 'mitigate').correct).toBe(false);
  });

  it('rejects empty input', () => {
    expect(checkAnswer('', 'mitigate').correct).toBe(false);
  });

  it('does not accept typo for short words', () => {
    expect(checkAnswer('abc', 'abcd').correct).toBe(false);
  });
});

describe('findCloze', () => {
  const sentence = 'New rules aim to mitigate the damage.';

  it('finds the term in context', () => {
    const r = findCloze(sentence, 'mitigate');
    expect(r).not.toBeNull();
    expect(r!.answer).toBe('mitigate');
    expect(r!.before).toBe('New rules aim to ');
    expect(r!.after).toBe(' the damage.');
  });

  it('finds inflected form', () => {
    const r = findCloze(sentence, 'mitigated');
    expect(r).not.toBeNull();
    expect(r!.answer).toBe('mitigate');
  });

  it('returns null for missing term', () => {
    expect(findCloze(sentence, 'exacerbate')).toBeNull();
  });

  it('returns null for empty inputs', () => {
    expect(findCloze('', 'mitigate')).toBeNull();
    expect(findCloze(sentence, '')).toBeNull();
    expect(findCloze(null, 'mitigate')).toBeNull();
  });

  it('handles phrases', () => {
    const r = findCloze('He decided to carry out the plan.', 'carry out');
    expect(r).not.toBeNull();
    expect(r!.answer.toLowerCase()).toContain('carry');
  });
});

describe('neighbours', () => {
  it('returns words left and right of the term', () => {
    const { lc, rc } = neighbours('aim to mitigate the', 'mitigate');
    expect(lc).toBe('to');
    expect(rc).toBe('the');
  });

  it('returns empty strings when term not found', () => {
    const { lc, rc } = neighbours('aim to mitigate the', 'exacerbate');
    expect(lc).toBe('');
    expect(rc).toBe('');
  });
});

describe('usesTerm', () => {
  it('returns true when text contains the term', () => {
    expect(usesTerm('to mitigate the risk', 'mitigate')).toBe(true);
  });

  it('returns true for inflected form', () => {
    expect(usesTerm('he mitigated the damage', 'mitigate')).toBe(true);
  });

  it('returns false when text does not contain the term', () => {
    expect(usesTerm('to reduce the risk', 'mitigate')).toBe(false);
  });
});
