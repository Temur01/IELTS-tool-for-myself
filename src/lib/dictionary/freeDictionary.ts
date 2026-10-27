// Free Dictionary API (https://dictionaryapi.dev/) — no key required.
import { getJson } from './http';
import type { ProviderResult, Sense, Audio, DictionaryProvider } from '../types';

export const freeDictionary: DictionaryProvider = {
  id: 'freedictionary',
  name: 'Free Dictionary API (Wiktionary)',
  homepage: 'https://dictionaryapi.dev/',
  enabled: () => true,

  async lookup(term, { fresh }) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`;
    const data = await getJson(url, { fresh, isNotFoundBody: (b) => (b as { title?: string })?.title === 'No Definitions Found' });
    return parseFreeDictionary(data, term);
  },
};

interface FdPhonetic {
  audio?: string;
  text?: string;
  license?: { name: string; url?: string };
  sourceUrl?: string;
}

interface FdDefinition {
  definition: string;
  example?: string;
  synonyms?: string[];
}

interface FdMeaning {
  partOfSpeech?: string;
  definitions?: FdDefinition[];
  synonyms?: string[];
}

interface FdEntry {
  phonetic?: string;
  phonetics?: FdPhonetic[];
  meanings?: FdMeaning[];
  sourceUrls?: string[];
}

export function parseFreeDictionary(data: unknown, term: string): ProviderResult {
  const entries: FdEntry[] = Array.isArray(data) ? (data as FdEntry[]) : [];
  const senses: Sense[] = [];
  const audio: Audio[] = [];
  let sourceUrl = `https://en.wiktionary.org/wiki/${encodeURIComponent(term.replace(/ /g, '_'))}`;

  entries.forEach((entry, e) => {
    if (entry.sourceUrls?.[0]) sourceUrl = entry.sourceUrls[0];
    for (const p of entry.phonetics ?? []) {
      if (p.audio && p.license?.name && !audio.some((a) => a.url === p.audio)) {
        audio.push({
          url: p.audio,
          text: p.text ?? entry.phonetic ?? '',
          license: { name: p.license.name, url: p.license.url ?? '' },
          sourceUrl: p.sourceUrl ?? '',
          accent: /-uk\.mp3$/.test(p.audio) ? 'UK' : /-us\.mp3$/.test(p.audio) ? 'US' : /-au\.mp3$/.test(p.audio) ? 'AU' : '',
        });
      }
    }
    (entry.meanings ?? []).forEach((meaning, m) => {
      (meaning.definitions ?? []).forEach((def, d) => {
        if (!def.definition) return;
        senses.push({
          id: `freedictionary:${e}:${m}:${d}`,
          provider: freeDictionary.id,
          providerName: freeDictionary.name,
          partOfSpeech: String(meaning.partOfSpeech ?? '').toLowerCase(),
          definition: def.definition,
          example: def.example ?? '',
          synonyms: def.synonyms ?? [],
          relatedSynonyms: meaning.synonyms ?? [],
          sourceUrl: entry.sourceUrls?.[0] ?? sourceUrl,
        });
      });
    });
  });

  return { senses, candidates: [], audio, sourceUrl };
}
