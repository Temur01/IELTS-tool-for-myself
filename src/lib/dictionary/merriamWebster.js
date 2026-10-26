// Merriam-Webster Collegiate Thesaurus (https://dictionaryapi.com/).
// Needs MW_THESAURUS_API_KEY (server-only). Free for non-commercial use,
// 1,000 queries/day per key. Synonyms are listed per sense, so they are
// tied to that sense.
import { getJson, ProviderError } from './http.js';

export const merriamWebster = {
  id: 'merriam-webster',
  name: 'Merriam-Webster Thesaurus',
  homepage: 'https://www.merriam-webster.com/thesaurus',
  enabled: () => Boolean(process.env.MW_THESAURUS_API_KEY),

  async lookup(term, { fresh }) {
    const key = process.env.MW_THESAURUS_API_KEY;
    const url = `https://www.dictionaryapi.com/api/v3/references/thesaurus/json/${encodeURIComponent(term)}?key=${encodeURIComponent(key)}`;
    const data = await getJson(url, { fresh });
    return parseMerriamWebster(data, term);
  },
};

export function parseMerriamWebster(data, term) {
  const sourceUrl = `https://www.merriam-webster.com/thesaurus/${encodeURIComponent(term)}`;
  // Unknown words come back as an array of spelling suggestions (strings).
  if (!Array.isArray(data) || data.length === 0 || typeof data[0] === 'string') {
    const suggestions = Array.isArray(data) ? data.filter((d) => typeof d === 'string').slice(0, 5) : [];
    throw Object.assign(new ProviderError('not_found', 'No thesaurus entry found.'), { suggestions });
  }
  const want = term.toLowerCase();
  const senses = [];
  data.forEach((entry, e) => {
    const headword = String(entry?.meta?.id ?? '').split(':')[0].toLowerCase();
    if (headword !== want) return;
    const shortdefs = entry.shortdef ?? [];
    const syns = entry.meta?.syns ?? [];
    shortdefs.forEach((definition, i) => {
      senses.push({
        id: `merriam-webster:${e}:${i}`,
        provider: merriamWebster.id,
        providerName: merriamWebster.name,
        partOfSpeech: String(entry.fl ?? '').toLowerCase(),
        definition,
        example: '',
        synonyms: syns[i] ?? [],
        relatedSynonyms: [],
        sourceUrl,
      });
    });
  });
  if (!senses.length) throw new ProviderError('not_found', 'No thesaurus entry for this exact word.');
  return { senses, candidates: [], audio: [], sourceUrl };
}
