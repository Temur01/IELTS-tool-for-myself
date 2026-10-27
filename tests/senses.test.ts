import { describe, expect, it } from 'vitest';
import { buildCandidates, contentWords, mergeCandidates, rankSenses, rejectedCandidates, senseKey, verifiedReplacements } from '@/lib/senses';
import type { Sense, Synonym, LookupResult } from '@/lib/types';

const makeSense = (partial: Partial<Sense>): Sense => ({
  id: 'test:0',
  provider: 'test',
  providerName: 'Test',
  partOfSpeech: 'verb',
  definition: 'to make less harmful',
  example: 'measures to mitigate the damage',
  synonyms: ['reduce', 'lessen'],
  relatedSynonyms: [],
  sourceUrl: 'https://example.com',
  ...partial,
});

const makeSynonym = (partial: Partial<Synonym>): Synonym => ({
  word: 'reduce',
  label: 'near',
  basis: 'listed',
  provider: 'test',
  providerName: 'Test',
  sourceUrl: '',
  retrievedAt: new Date().toISOString(),
  verdict: 'unreviewed',
  note: '',
  sources: [],
  ...partial,
});

describe('contentWords', () => {
  it('extracts non-stopword content words and stems them', () => {
    const words = contentWords('measures to mitigate the damage');
    expect(words.has('measur')).toBe(true);
    expect(words.has('damag')).toBe(true);
    expect(words.has('the')).toBe(false);
    expect(words.has('to')).toBe(false);
  });

  it('handles non-strings', () => {
    expect(contentWords(null).size).toBe(0);
    expect(contentWords(undefined).size).toBe(0);
  });
});

describe('senseKey', () => {
  it('generates a stable key', () => {
    const sense = makeSense({});
    const key = senseKey(sense);
    expect(key).toBe(senseKey(sense));
    expect(key.startsWith('verb|')).toBe(true);
  });

  it('returns empty string for null/undefined', () => {
    expect(senseKey(null)).toBe('');
    expect(senseKey(undefined)).toBe('');
    expect(senseKey({})).toBe('');
  });
});

describe('rankSenses', () => {
  const senses: Sense[] = [
    makeSense({ id: 'a', definition: 'to make less harmful', example: 'mitigate damage' }),
    makeSense({ id: 'b', definition: 'to reduce severity', synonyms: [] }),
    makeSense({ id: 'c', definition: 'to alleviate suffering', example: 'unrelated sentence' }),
  ];

  it('ranks higher-overlap senses first', () => {
    const ranked = rankSenses(senses, { context: 'measures to mitigate the damage', meaning: 'reduce harm' });
    expect(ranked[0].id).toBe('a');
  });

  it('marks the best sense as suggested when overlap > 0', () => {
    const ranked = rankSenses(senses, { context: 'mitigate damage' });
    const best = ranked.find((s) => s.suggested);
    expect(best).toBeDefined();
  });

  it('returns senses unchanged when no context given', () => {
    const ranked = rankSenses(senses);
    expect(ranked.length).toBe(senses.length);
  });
});

describe('buildCandidates', () => {
  const lookup: LookupResult = {
    term: 'mitigate',
    retrievedAt: new Date().toISOString(),
    providers: [],
    senses: [],
    candidates: [
      { word: 'alleviate', partsOfSpeech: ['verb'], basis: 'WordNet synset', provider: 'datamuse', providerName: 'Datamuse', sourceUrl: '' },
    ],
    audio: [],
  };

  it('builds candidates from selected sense synonyms and providers', () => {
    const sense = makeSense({ synonyms: ['reduce', 'lessen'] });
    const candidates = buildCandidates(lookup, sense, 'mitigate');
    expect(candidates.some((c) => c.word === 'reduce')).toBe(true);
    expect(candidates.some((c) => c.word === 'alleviate')).toBe(true);
  });

  it('excludes the term itself', () => {
    const sense = makeSense({ synonyms: ['mitigate', 'reduce'] });
    const candidates = buildCandidates(lookup, sense, 'mitigate');
    expect(candidates.some((c) => c.word.toLowerCase() === 'mitigate')).toBe(false);
  });

  it('labels sense synonyms as near', () => {
    const sense = makeSense({ synonyms: ['reduce'] });
    const candidates = buildCandidates(lookup, sense, 'mitigate');
    const reduce = candidates.find((c) => c.word === 'reduce');
    expect(reduce?.label).toBe('near');
  });

  it('deduplicates candidates merging near over related', () => {
    const senseWithAlleviate = makeSense({ synonyms: ['alleviate'] });
    const candidates = buildCandidates(lookup, senseWithAlleviate, 'mitigate');
    const alleviates = candidates.filter((c) => c.word === 'alleviate');
    expect(alleviates.length).toBe(1);
    expect(alleviates[0].label).toBe('near');
  });
});

describe('mergeCandidates', () => {
  it('preserves verdicts when candidates are refreshed', () => {
    const saved: Synonym[] = [makeSynonym({ word: 'reduce', verdict: 'fits', note: 'good one' })];
    const fresh: Synonym[] = [makeSynonym({ word: 'reduce', verdict: 'unreviewed' })];
    const merged = mergeCandidates(saved, fresh);
    expect(merged[0].verdict).toBe('fits');
    expect(merged[0].note).toBe('good one');
  });

  it('keeps judged candidates that were dropped by the provider', () => {
    const saved: Synonym[] = [makeSynonym({ word: 'lessen', verdict: 'rejected', note: 'wrong tone' })];
    const fresh: Synonym[] = [];
    const merged = mergeCandidates(saved, fresh);
    expect(merged.length).toBe(1);
    expect(merged[0].word).toBe('lessen');
  });

  it('drops dropped unreviewed/unnoted candidates', () => {
    const saved: Synonym[] = [makeSynonym({ word: 'lessen', verdict: 'unreviewed', note: '' })];
    const fresh: Synonym[] = [];
    const merged = mergeCandidates(saved, fresh);
    expect(merged.length).toBe(0);
  });
});

describe('verifiedReplacements / rejectedCandidates', () => {
  const synonyms: Synonym[] = [
    makeSynonym({ word: 'reduce', verdict: 'fits' }),
    makeSynonym({ word: 'lessen', verdict: 'rejected' }),
    makeSynonym({ word: 'allay', verdict: 'unreviewed' }),
  ];

  it('filters to fits', () => {
    expect(verifiedReplacements(synonyms).map((s) => s.word)).toEqual(['reduce']);
  });

  it('filters to rejected', () => {
    expect(rejectedCandidates(synonyms).map((s) => s.word)).toEqual(['lessen']);
  });

  it('returns empty array for undefined', () => {
    expect(verifiedReplacements()).toEqual([]);
    expect(rejectedCandidates()).toEqual([]);
  });
});
