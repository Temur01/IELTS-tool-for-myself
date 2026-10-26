// Datamuse (https://www.datamuse.com/api/) — candidate synonyms only.
// rel_syn = words sharing a WordNet synset (sense not specified);
// ml = "means like", ranked by the neighbouring words when given.
// Datamuse provides no rich definitions/examples, so every result here is a
// "related candidate", never a confirmed synonym.
import { getJson, POS_NAMES } from './http.js';

const BASE = 'https://api.datamuse.com/words';

export const datamuse = {
  id: 'datamuse',
  name: 'Datamuse',
  homepage: 'https://www.datamuse.com/api/',
  enabled: () => true,

  async lookup(term, { fresh, lc, rc }) {
    const key = process.env.DATAMUSE_API_KEY;
    const common = { md: 'p', max: '12', ...(key ? { key } : {}) };
    const syn = new URLSearchParams({ rel_syn: term, ...common });
    // Only the single neighbouring words are sent, never the full sentence.
    const ml = new URLSearchParams({ ml: term, ...common, ...(lc ? { lc } : {}), ...(rc ? { rc } : {}) });
    const [synData, mlData] = await Promise.all([
      getJson(`${BASE}?${syn}`, { fresh }),
      getJson(`${BASE}?${ml}`, { fresh }),
    ]);
    return parseDatamuse(synData, mlData, term);
  },
};

function tagsToPos(tags = []) {
  return tags.map((t) => POS_NAMES[t]).filter(Boolean);
}

export function parseDatamuse(synData = [], mlData = [], term = '') {
  const sourceUrl = `https://api.datamuse.com/words?rel_syn=${encodeURIComponent(term)}`;
  const candidates = [];
  const seen = new Set();
  const push = (item, basis) => {
    const word = item?.word;
    if (!word || seen.has(word)) return;
    seen.add(word);
    candidates.push({
      word,
      partsOfSpeech: tagsToPos(item.tags),
      basis,
      provider: datamuse.id,
      providerName: datamuse.name,
      sourceUrl,
    });
  };
  for (const item of synData) push(item, 'Shares a WordNet synset (Datamuse); sense not specified');
  for (const item of mlData.slice(0, 8)) push(item, 'Similar meaning (Datamuse "means like"); may differ in tone or use');
  return { senses: [], candidates, audio: [], sourceUrl };
}
