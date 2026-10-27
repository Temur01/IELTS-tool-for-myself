// Datamuse (https://www.datamuse.com/api/) — candidate synonyms only.
import { getJson, POS_NAMES } from './http';
import type { ProviderResult, Candidate, DictionaryProvider } from '../types';

const BASE = 'https://api.datamuse.com/words';

export const datamuse: DictionaryProvider = {
  id: 'datamuse',
  name: 'Datamuse',
  homepage: 'https://www.datamuse.com/api/',
  enabled: () => true,

  async lookup(term, { fresh, lc, rc }) {
    const key = process.env.DATAMUSE_API_KEY;
    const common: Record<string, string> = { md: 'p', max: '12', ...(key ? { key } : {}) };
    const syn = new URLSearchParams({ rel_syn: term, ...common });
    const ml = new URLSearchParams({ ml: term, ...common, ...(lc ? { lc } : {}), ...(rc ? { rc } : {}) });
    const [synData, mlData] = await Promise.all([
      getJson(`${BASE}?${syn}`, { fresh }),
      getJson(`${BASE}?${ml}`, { fresh }),
    ]);
    return parseDatamuse(synData, mlData, term);
  },
};

interface DatamuseWord {
  word?: string;
  tags?: string[];
}

function tagsToPos(tags: string[] = []): string[] {
  return tags.map((t) => POS_NAMES[t]).filter(Boolean);
}

export function parseDatamuse(synData: unknown, mlData: unknown, term = ''): ProviderResult {
  const sourceUrl = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(term)}`;
  const candidates: Candidate[] = [];
  const seen = new Set<string>();
  const push = (item: DatamuseWord | undefined, basis: string) => {
    const word = item?.word;
    if (!word || seen.has(word)) return;
    seen.add(word);
    candidates.push({
      word,
      partsOfSpeech: tagsToPos(item?.tags),
      basis,
      provider: datamuse.id,
      providerName: datamuse.name,
      sourceUrl,
    });
  };
  for (const item of (Array.isArray(synData) ? synData : []) as DatamuseWord[]) {
    push(item, 'Shares a WordNet synset (Datamuse); sense not specified');
  }
  for (const item of (Array.isArray(mlData) ? (mlData as DatamuseWord[]).slice(0, 8) : [])) {
    push(item, 'Similar meaning (Datamuse "means like"); may differ in tone or use');
  }
  return { senses: [], candidates, audio: [], sourceUrl };
}
