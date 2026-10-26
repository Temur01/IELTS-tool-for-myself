import { describe, expect, it } from 'vitest';
import { checkAnswer, findCloze, neighbours, normalizeAnswer, usesTerm } from '@/lib/answer';

describe('checkAnswer', () => {
  it('ignores case, punctuation, accents and surrounding spaces', () => {
    expect(checkAnswer('  Mitigate! ', 'mitigate').correct).toBe(true);
    expect(checkAnswer('well-being', 'wellbeing')).toMatchObject({ correct: true, typo: true });
    expect(checkAnswer('well being', 'well-being').correct).toBe(true);
    expect(checkAnswer('café', 'cafe').correct).toBe(true);
    expect(checkAnswer('don’t', "don't").correct).toBe(true);
  });

  it('accepts a leading "to"/"the"', () => {
    expect(checkAnswer('to mitigate', 'mitigate').correct).toBe(true);
    expect(checkAnswer('mitigate', 'to mitigate').correct).toBe(true);
  });

  it('accepts small typos but flags them', () => {
    const r = checkAnswer('mitigat', 'mitigate');
    expect(r).toEqual({ correct: true, typo: true, matched: 'mitigate' });
    expect(checkAnswer('substancial', 'substantial').typo).toBe(true);
  });

  it('does not accept typos on short words or wrong answers', () => {
    expect(checkAnswer('cat', 'car').correct).toBe(false);
    expect(checkAnswer('alleviate', 'mitigate').correct).toBe(false);
    expect(checkAnswer('', 'mitigate').correct).toBe(false);
  });

  it('accepts any of several answers', () => {
    expect(checkAnswer('mitigated', ['mitigated', 'mitigate']).matched).toBe('mitigated');
  });

  it('normalizes', () => {
    expect(normalizeAnswer('  “Carry   OUT”. ')).toBe('carry out');
  });
});

describe('findCloze', () => {
  it('finds the exact term', () => {
    expect(findCloze('We must mitigate the risk.', 'mitigate')).toEqual({ before: 'We must ', answer: 'mitigate', after: ' the risk.' });
  });

  it('finds inflected forms', () => {
    expect(findCloze('Measures mitigated the damage.', 'mitigate').answer).toBe('mitigated');
    expect(findCloze('Several studies show this.', 'study').answer).toBe('studies');
    expect(findCloze('They carried out a survey.', 'carry out').answer).toBe('carried out');
  });

  it('is case-insensitive and respects word boundaries', () => {
    expect(findCloze('Mitigate it.', 'mitigate').before).toBe('');
    expect(findCloze('An unmitigated disaster.', 'mitigate')).toBeNull();
  });

  it('skips stems that are too short to be safe', () => {
    expect(findCloze('Being there helps.', 'be')).toBeNull();
    expect(findCloze('To be fair.', 'be').answer).toBe('be');
  });

  it('returns null without context', () => {
    expect(findCloze('', 'word')).toBeNull();
  });
});

describe('neighbours', () => {
  it('returns only the adjacent words', () => {
    expect(neighbours('Steps to mitigate the effects of floods.', 'mitigate')).toEqual({ lc: 'to', rc: 'the' });
    expect(neighbours('Mitigate.', 'mitigate')).toEqual({ lc: '', rc: '' });
  });
});

describe('usesTerm', () => {
  it('detects the term or its inflections in a paraphrase', () => {
    expect(usesTerm('They mitigated it', 'mitigate')).toBe(true);
    expect(usesTerm('They reduced it', 'mitigate')).toBe(false);
  });
});
