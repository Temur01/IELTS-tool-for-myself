// Free Dictionary API (https://dictionaryapi.dev/) — no key required.
// Content comes from Wiktionary (CC BY-SA); audio files carry their own
// license, and only audio with a stated license is returned.
import { getJson } from './http.js';

export const freeDictionary = {
  id: 'freedictionary',
  name: 'Free Dictionary API (Wiktionary)',
  homepage: 'https://dictionaryapi.dev/',
  enabled: () => true,

  async lookup(term, { fresh }) {
    const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(term)}`;
    // Unknown words get 404, or sometimes a 5xx with a "No Definitions Found" body.
    const data = await getJson(url, { fresh, isNotFoundBody: (b) => b?.title === 'No Definitions Found' });
    return parseFreeDictionary(data, term);
  },
};

export function parseFreeDictionary(data, term) {
  const entries = Array.isArray(data) ? data : [];
  const senses = [];
  const audio = [];
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
