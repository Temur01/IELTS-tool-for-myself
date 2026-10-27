import { describe, expect, it, vi, beforeEach } from 'vitest';
import { parseFreeDictionary } from '@/lib/dictionary/freeDictionary';
import { parseDatamuse } from '@/lib/dictionary/datamuse';
import { parseMerriamWebster } from '@/lib/dictionary/merriamWebster';
import { cleanTerm, lookupAll } from '@/lib/dictionary';
import { ProviderError } from '@/lib/dictionary/http';
import type { DictionaryProvider } from '@/lib/types';

describe('cleanTerm', () => {
  it('lowercases and trims', () => {
    expect(cleanTerm('  Mitigate  ')).toBe('mitigate');
  });

  it('allows hyphens and apostrophes', () => {
    expect(cleanTerm("carry-out")).toBe('carry-out');
    expect(cleanTerm("it's")).toBe("it's");
  });

  it('returns null for empty or invalid input', () => {
    expect(cleanTerm('')).toBeNull();
    expect(cleanTerm(null)).toBeNull();
    expect(cleanTerm('abc!@#')).toBeNull();
  });

  it('returns null for input exceeding 60 chars', () => {
    expect(cleanTerm('a'.repeat(61))).toBeNull();
  });
});

describe('parseFreeDictionary', () => {
  it('extracts senses from a well-formed response', () => {
    const data = [
      {
        meanings: [
          {
            partOfSpeech: 'verb',
            definitions: [
              { definition: 'to make less harmful', example: 'mitigate damage', synonyms: ['reduce'] },
            ],
            synonyms: ['lessen'],
          },
        ],
        phonetics: [],
        sourceUrls: ['https://example.com'],
      },
    ];
    const { senses } = parseFreeDictionary(data, 'mitigate');
    expect(senses.length).toBe(1);
    expect(senses[0].definition).toBe('to make less harmful');
    expect(senses[0].synonyms).toContain('reduce');
    expect(senses[0].relatedSynonyms).toContain('lessen');
  });

  it('extracts audio when license is present', () => {
    const data = [
      {
        meanings: [],
        phonetics: [
          { audio: 'https://cdn/en-us.mp3', text: '/ˈmɪtɪɡeɪt/', license: { name: 'CC BY-SA', url: 'https://cc.org' } },
        ],
        sourceUrls: [],
      },
    ];
    const { audio } = parseFreeDictionary(data, 'mitigate');
    expect(audio.length).toBe(1);
    expect(audio[0].url).toContain('en-us.mp3');
  });

  it('returns empty results for non-array data', () => {
    const { senses, audio } = parseFreeDictionary({ title: 'No Definitions Found' }, 'mitigate');
    expect(senses).toEqual([]);
    expect(audio).toEqual([]);
  });
});

describe('parseDatamuse', () => {
  it('maps synset words to candidates', () => {
    const syn = [{ word: 'reduce', tags: ['v'] }, { word: 'lessen', tags: ['v'] }];
    const { candidates } = parseDatamuse(syn, [], 'mitigate');
    expect(candidates.length).toBe(2);
    expect(candidates[0].word).toBe('reduce');
    expect(candidates[0].partsOfSpeech).toContain('verb');
  });

  it('deduplicates across syn and ml results', () => {
    const syn = [{ word: 'reduce', tags: [] }];
    const ml = [{ word: 'reduce', tags: [] }, { word: 'lessen', tags: [] }];
    const { candidates } = parseDatamuse(syn, ml, 'mitigate');
    const words = candidates.map((c) => c.word);
    expect(new Set(words).size).toBe(words.length);
  });
});

describe('parseMerriamWebster', () => {
  it('extracts senses for the requested term', () => {
    const data = [
      {
        meta: { id: 'mitigate:1', syns: [['reduce', 'lessen']] },
        shortdef: ['to make less severe'],
        fl: 'verb',
      },
    ];
    const { senses } = parseMerriamWebster(data, 'mitigate');
    expect(senses.length).toBe(1);
    expect(senses[0].synonyms).toContain('reduce');
  });

  it('throws not_found for unknown words (string array response)', () => {
    expect(() => parseMerriamWebster(['mitigated', 'mitigation'], 'mitigaet')).toThrow(ProviderError);
  });

  it('throws not_found when headword does not match', () => {
    const data = [{ meta: { id: 'other:1', syns: [] }, shortdef: ['other def'], fl: 'noun' }];
    expect(() => parseMerriamWebster(data, 'mitigate')).toThrow(ProviderError);
  });
});

describe('lookupAll', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('throws on invalid term', async () => {
    await expect(lookupAll('')).rejects.toThrow('invalid term');
    await expect(lookupAll(null)).rejects.toThrow('invalid term');
  });

  it('aggregates results from providers', async () => {
    const mockProvider: DictionaryProvider = {
      id: 'mock',
      name: 'Mock',
      homepage: 'https://mock.com',
      enabled: () => true,
      lookup: vi.fn().mockResolvedValue({
        senses: [{ id: 's1', provider: 'mock', providerName: 'Mock', partOfSpeech: 'verb', definition: 'test def', example: '', synonyms: [], relatedSynonyms: [], sourceUrl: '' }],
        candidates: [],
        audio: [],
        sourceUrl: 'https://mock.com/mitigate',
      }),
    };
    const result = await lookupAll('mitigate', { providers: [mockProvider] });
    expect(result.senses.length).toBe(1);
    expect(result.providers[0].status).toBe('ok');
  });

  it('records provider errors without throwing', async () => {
    const failProvider: DictionaryProvider = {
      id: 'fail',
      name: 'Fail',
      homepage: 'https://fail.com',
      enabled: () => true,
      lookup: vi.fn().mockRejectedValue(new ProviderError('not_found', 'No entry found.')),
    };
    const result = await lookupAll('mitigate', { providers: [failProvider] });
    expect(result.providers[0].status).toBe('not_found');
    expect(result.senses).toEqual([]);
  });
});
