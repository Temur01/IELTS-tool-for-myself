import { describe, expect, it } from 'vitest';
import { backupJson, csvCell, wordsToCsv } from '@/lib/exportData';
import type { Word, Review } from '@/lib/types';

function makeWord(partial: Partial<Word> = {}): Word {
  return {
    id: 'w1',
    term: 'mitigate',
    source: 'reading',
    context: 'aim to mitigate the damage',
    meaning: 'to make less harmful',
    uzbek: 'yumshatmoq',
    paraphrase: 'to reduce something bad',
    example: '',
    part_of_speech: 'verb',
    sense_key: '',
    sense: null,
    synonyms: [
      { word: 'reduce', label: 'near', basis: 'test', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'fits', note: '', sources: [] },
      { word: 'worsen', label: 'related', basis: 'test', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'rejected', note: '', sources: [] },
    ],
    audio: null,
    lookup_meta: null,
    status: 'active',
    ease: 2.5,
    interval_days: 6,
    repetitions: 2,
    lapses: 0,
    confidence: 3,
    due_at: new Date().toISOString(),
    last_reviewed_at: new Date().toISOString(),
    created_at: new Date().toISOString(),
    ...partial,
  };
}

describe('csvCell', () => {
  it('returns empty string for null/undefined', () => {
    expect(csvCell(null)).toBe('');
    expect(csvCell(undefined)).toBe('');
  });

  it('wraps cells containing commas in quotes', () => {
    expect(csvCell('a,b')).toBe('"a,b"');
  });

  it('escapes double quotes inside quoted cells', () => {
    expect(csvCell('say "hello"')).toBe('"say ""hello"""');
  });

  it('prefixes formula-like values to prevent injection', () => {
    expect(csvCell('=SUM(A1)')).toBe("'=SUM(A1)");
    expect(csvCell('+cmd')).toBe("'+cmd");
  });

  it('passes through normal strings unchanged', () => {
    expect(csvCell('mitigate')).toBe('mitigate');
    expect(csvCell(42)).toBe('42');
  });
});

describe('wordsToCsv', () => {
  it('includes a header row', () => {
    const csv = wordsToCsv([makeWord()]);
    const lines = csv.split('\r\n');
    expect(lines[0]).toContain('term');
    expect(lines[0]).toContain('meaning');
    expect(lines[0]).toContain('verified_synonyms');
  });

  it('includes one row per word', () => {
    const csv = wordsToCsv([makeWord(), makeWord({ id: 'w2', term: 'exacerbate' })]);
    const lines = csv.split('\r\n').filter(Boolean);
    expect(lines.length).toBe(3); // header + 2 words
  });

  it('lists verified synonyms as semicolon-separated', () => {
    const word = makeWord({
      synonyms: [
        { word: 'reduce', label: 'near', basis: '', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'fits', note: '', sources: [] },
        { word: 'lessen', label: 'near', basis: '', provider: 'test', providerName: 'Test', sourceUrl: '', retrievedAt: '', verdict: 'fits', note: '', sources: [] },
      ],
    });
    const csv = wordsToCsv([word]);
    expect(csv).toContain('reduce; lessen');
  });
});

describe('backupJson', () => {
  it('produces valid JSON', () => {
    const json = backupJson([makeWord()], []);
    expect(() => JSON.parse(json)).not.toThrow();
  });

  it('includes app and version metadata', () => {
    const parsed = JSON.parse(backupJson([makeWord()], [])) as { app: string; version: number };
    expect(parsed.app).toBe('ielts-vocab');
    expect(parsed.version).toBe(1);
  });

  it('includes both words and reviews', () => {
    const word = makeWord();
    const review: Review = {
      id: 'r1',
      word_id: word.id,
      mode: 'recall',
      rating: 'good',
      correct: null,
      answer: null,
      early: false,
      prev_interval: 1,
      new_interval: 6,
      reviewed_at: new Date().toISOString(),
    };
    const parsed = JSON.parse(backupJson([word], [review])) as { words: Word[]; reviews: Review[] };
    expect(parsed.words.length).toBe(1);
    expect(parsed.reviews.length).toBe(1);
  });
});
