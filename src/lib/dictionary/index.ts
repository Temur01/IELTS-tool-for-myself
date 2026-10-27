// Dictionary provider registry.
import { ProviderError } from './http';
import { freeDictionary } from './freeDictionary';
import { datamuse } from './datamuse';
import { merriamWebster } from './merriamWebster';
import type { LookupResult, DictionaryProvider, LookupOptions } from '../types';

export { ProviderError };

export const PROVIDERS: DictionaryProvider[] = [merriamWebster, freeDictionary, datamuse];

export const TERM_PATTERN = /^[\p{L}][\p{L}''\- ]{0,59}$/u;

export function cleanTerm(raw: unknown): string | null {
  const term = String(raw ?? '').replace(/\s+/g, ' ').trim().toLowerCase();
  return TERM_PATTERN.test(term) ? term : null;
}

function cleanNeighbour(raw: unknown): string {
  const w = String(raw ?? '').toLowerCase().trim();
  return /^[\p{L}']{1,30}$/u.test(w) ? w : '';
}

interface LookupAllOptions extends LookupOptions {
  providers?: DictionaryProvider[];
}

export async function lookupAll(rawTerm: unknown, { fresh = false, lc, rc, providers = PROVIDERS }: LookupAllOptions = {}): Promise<LookupResult> {
  const term = cleanTerm(rawTerm);
  if (!term) throw new Error('invalid term');
  const opts = { fresh, lc: cleanNeighbour(lc), rc: cleanNeighbour(rc) };
  const active = providers.filter((p) => p.enabled());
  const settled = await Promise.allSettled(active.map((p) => p.lookup(term, opts)));

  const result: LookupResult = { term, retrievedAt: new Date().toISOString(), providers: [], senses: [], candidates: [], audio: [] };
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
      const err = s.reason as ProviderError & { suggestions?: string[] };
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
