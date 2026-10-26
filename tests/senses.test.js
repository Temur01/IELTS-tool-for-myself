import { describe, expect, it } from 'vitest';
import { buildCandidates, mergeCandidates, rankSenses, senseKey, verifiedReplacements } from '@/lib/senses';
import { parseFreeDictionary } from '@/lib/dictionary/freeDictionary';
import { parseDatamuse } from '@/lib/dictionary/datamuse';
import { parseMerriamWebster } from '@/lib/dictionary/merriamWebster';

const fd = [
  {
    word: 'bank',
    sourceUrls: ['https://en.wiktionary.org/wiki/bank'],
    phonetics: [
      { text: '/bæŋk/', audio: 'https://x/bank-uk.mp3', sourceUrl: 'https://commons/1', license: { name: 'BY-SA 4.0', url: 'https://cc/by-sa' } },
      { text: '/bæŋk/', audio: 'https://x/bank-us.mp3' }, // no licence -> excluded
    ],
    meanings: [
      {
        partOfSpeech: 'noun',
        synonyms: ['depository'],
        definitions: [
          { definition: 'An institution where one can place and borrow money.', synonyms: ['lender'], example: 'I went to the bank.' },
          { definition: 'The edge of a river or lake.', synonyms: ['shore', 'riverside'] },
        ],
      },
      { partOfSpeech: 'verb', synonyms: [], definitions: [{ definition: 'To deposit money.', synonyms: [] }] },
    ],
  },
];

describe('parseFreeDictionary', () => {
  it('creates one sense per definition with its own synonyms', () => {
    const { senses, audio } = parseFreeDictionary(fd, 'bank');
    expect(senses).toHaveLength(3);
    expect(senses[1]).toMatchObject({ partOfSpeech: 'noun', definition: 'The edge of a river or lake.', synonyms: ['shore', 'riverside'] });
    expect(senses[0].relatedSynonyms).toEqual(['depository']);
    expect(audio).toHaveLength(1);
    expect(audio[0]).toMatchObject({ accent: 'UK', license: { name: 'BY-SA 4.0' } });
  });
});

describe('rankSenses', () => {
  it('suggests the sense that overlaps with the learner context, without removing others', () => {
    const { senses } = parseFreeDictionary(fd, 'bank');
    const ranked = rankSenses(senses, { term: 'bank', context: 'We had a picnic on the bank of the river.' });
    expect(ranked[0].definition).toMatch(/river/);
    expect(ranked[0].suggested).toBe(true);
    expect(ranked.filter((s) => s.suggested)).toHaveLength(1);
    expect(ranked).toHaveLength(3);
  });

  it('suggests nothing when there is no overlap', () => {
    const { senses } = parseFreeDictionary(fd, 'bank');
    expect(rankSenses(senses, { term: 'bank', context: 'Hmm.' }).some((s) => s.suggested)).toBe(false);
  });
});

describe('buildCandidates', () => {
  const lookup = {
    retrievedAt: '2026-10-26T10:00:00Z',
    candidates: parseDatamuse(
      [{ word: 'shore', tags: ['n'] }, { word: 'trust', tags: ['v'] }],
      [{ word: 'embankment', tags: ['n'] }],
      'bank',
    ).candidates,
  };
  const riverSense = parseFreeDictionary(fd, 'bank').senses[1];

  it('labels sense-specific synonyms as near and the rest as related, with sources', () => {
    const c = buildCandidates(lookup, riverSense, 'bank');
    const shore = c.find((x) => x.word === 'shore');
    expect(shore.label).toBe('near');
    expect(shore.sources.map((s) => s.provider).sort()).toEqual(['datamuse', 'freedictionary']);
    expect(c.find((x) => x.word === 'embankment').label).toBe('related');
    expect(c.find((x) => x.word === 'lender')).toBeUndefined(); // belongs to another sense
    expect(c.every((x) => x.verdict === 'unreviewed')).toBe(true);
    expect(c.every((x) => x.providerName && x.retrievedAt)).toBe(true);
  });

  it('drops candidates whose part of speech excludes the chosen sense', () => {
    const c = buildCandidates(lookup, riverSense, 'bank');
    expect(c.find((x) => x.word === 'trust')).toBeUndefined();
  });

  it('without a chosen sense everything is only a related candidate', () => {
    const c = buildCandidates(lookup, null, 'bank');
    expect(c.every((x) => x.label === 'related')).toBe(true);
  });

  it('never treats candidates as verified replacements until the learner says so', () => {
    const c = buildCandidates(lookup, riverSense, 'bank');
    expect(verifiedReplacements(c)).toHaveLength(0);
    const judged = c.map((x) => (x.word === 'shore' ? { ...x, verdict: 'fits' } : x));
    expect(verifiedReplacements(judged).map((x) => x.word)).toEqual(['shore']);
  });

  it('excludes the term itself', () => {
    const c = buildCandidates({ candidates: [{ word: 'Bank', provider: 'datamuse' }] }, null, 'bank');
    expect(c).toHaveLength(0);
  });
});

describe('mergeCandidates', () => {
  it('keeps verdicts and notes on refresh and retains judged words the provider dropped', () => {
    const saved = [
      { word: 'shore', verdict: 'fits', note: 'neutral', label: 'near' },
      { word: 'beach', verdict: 'rejected', note: 'sand only', label: 'related' },
      { word: 'side', verdict: 'unreviewed', note: '', label: 'related' },
    ];
    const fresh = [{ word: 'Shore', verdict: 'unreviewed', note: '', label: 'near' }, { word: 'brink', verdict: 'unreviewed', note: '', label: 'related' }];
    const merged = mergeCandidates(saved, fresh);
    expect(merged.find((c) => c.word === 'Shore')).toMatchObject({ verdict: 'fits', note: 'neutral' });
    expect(merged.find((c) => c.word === 'beach')).toBeDefined();
    expect(merged.find((c) => c.word === 'side')).toBeUndefined();
  });
});

describe('senseKey', () => {
  it('is stable across punctuation/case and distinct per sense', () => {
    expect(senseKey({ partOfSpeech: 'Noun', definition: 'The edge of a river.' })).toBe(senseKey({ partOfSpeech: 'noun', definition: 'the edge of a river' }));
    expect(senseKey({ partOfSpeech: 'noun', definition: 'A money lender.' })).not.toBe(senseKey({ partOfSpeech: 'noun', definition: 'The edge of a river.' }));
    expect(senseKey(null)).toBe('');
  });
});

describe('parseMerriamWebster', () => {
  it('maps each short definition to its own synonym list', () => {
    const data = [
      { meta: { id: 'mitigate', syns: [['alleviate', 'ease'], ['temper']] }, fl: 'verb', shortdef: ['to make less severe', 'to make milder'] },
      { meta: { id: 'mitigation', syns: [['relief']] }, fl: 'noun', shortdef: ['x'] },
    ];
    const { senses } = parseMerriamWebster(data, 'mitigate');
    expect(senses).toHaveLength(2);
    expect(senses[0]).toMatchObject({ partOfSpeech: 'verb', synonyms: ['alleviate', 'ease'] });
    expect(senses[1].synonyms).toEqual(['temper']);
  });

  it('reports not found with suggestions', () => {
    try {
      parseMerriamWebster(['mitigate', 'mitigated'], 'mitgate');
      throw new Error('should throw');
    } catch (err) {
      expect(err.status).toBe('not_found');
      expect(err.suggestions).toEqual(['mitigate', 'mitigated']);
    }
  });
});
