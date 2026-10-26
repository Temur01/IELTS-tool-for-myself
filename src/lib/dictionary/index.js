// Dictionary provider registry. To add or replace a provider, implement
// { id, name, homepage, enabled(), lookup(term, { fresh, lc, rc }) } returning
// { senses, candidates, audio, sourceUrl } or throwing ProviderError.
import { ProviderError } from './http.js';
import { freeDictionary } from './freeDictionary.js';
import { datamuse } from './datamuse.js';
import { merriamWebster } from './merriamWebster.js';

export const PROVIDERS = [merriamWebster, freeDictionary, datamuse];

export const TERM_PATTERN = /^[\p{L}][\p{L}'’\- ]{0,59}$/u;

export function cleanTerm(raw) {
  const term = String(raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return TERM_PATTERN.test(term) ? term : null;
}

function cleanNeighbour(raw) {
  const w = String(raw ?? '').toLowerCase().trim();
  return /^[\p{L}']{1,30}$/u.test(w) ? w : '';
}

export async function lookupAll(rawTerm, { fresh = false, lc, rc, providers = PROVIDERS } = {}) {
  const term = cleanTerm(rawTerm);
  if (!term) throw new Error('invalid term');
  const opts = { fresh, lc: cleanNeighbour(lc), rc: cleanNeighbour(rc) };
  const active = providers.filter((p) => p.enabled());
  const settled = await Promise.allSettled(active.map((p) => p.lookup(term, opts)));

  const result = { term, retrievedAt: new Date().toISOString(), providers: [], senses: [], candidates: [], audio: [] };
  settled.forEach((s, i) => {
    const p = active[i];
    const meta = { id: p.id, name: p.name, url: p.homepage };
    if (s.status === 'fulfilled') {
      const { senses, candidates, audio, sourceUrl } = s.value;
      result.providers.push({ ...meta, url: sourceUrl || p.homepage, status: 'ok' });
      result.senses.push(...senses);
      result.candidates.push(...candidates);
      result.audio.push(...audio);
    } else {
      const err = s.reason;
      const status = err instanceof ProviderError ? err.status : 'error';
      result.providers.push({
        ...meta,
        status,
        message: err instanceof ProviderError ? err.message : 'Unexpected provider error.',
        suggestions: err?.suggestions ?? [],
      });
    }
  });
  return result;
}
