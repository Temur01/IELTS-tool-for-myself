import { describe, expect, it, vi } from 'vitest';
import { cleanTerm, lookupAll } from '@/lib/dictionary';
import { getJson, ProviderError } from '@/lib/dictionary/http';

const ok = (id, senses = []) => ({
  id, name: id, homepage: `https://${id}`, enabled: () => true,
  lookup: vi.fn(async () => ({ senses, candidates: [{ word: 'x', provider: id }], audio: [], sourceUrl: `https://${id}/w` })),
});
const failing = (id, err) => ({ id, name: id, homepage: `https://${id}`, enabled: () => true, lookup: vi.fn(async () => { throw err; }) });

describe('cleanTerm', () => {
  it('accepts words and short phrases only', () => {
    expect(cleanTerm('  Carry   Out ')).toBe('carry out');
    expect(cleanTerm("well-being")).toBe('well-being');
    expect(cleanTerm('<script>')).toBeNull();
    expect(cleanTerm('')).toBeNull();
    expect(cleanTerm('a'.repeat(61))).toBeNull();
  });
});

describe('lookupAll', () => {
  it('combines providers and reports each status, so one failure does not break the rest', async () => {
    const providers = [
      ok('a', [{ id: 's1' }]),
      failing('b', new ProviderError('rate_limited', 'Slow down')),
      failing('c', new Error('boom')),
      { ...ok('d'), enabled: () => false },
    ];
    const r = await lookupAll('Mitigate', { providers, lc: 'to', rc: 'the' });
    expect(r.term).toBe('mitigate');
    expect(r.senses).toHaveLength(1);
    expect(r.providers.map((p) => [p.id, p.status])).toEqual([['a', 'ok'], ['b', 'rate_limited'], ['c', 'error']]);
    expect(r.providers[2].message).toBe('Unexpected provider error.');
    expect(providers[0].lookup).toHaveBeenCalledWith('mitigate', { fresh: false, lc: 'to', rc: 'the' });
    expect(providers[3].lookup).not.toHaveBeenCalled();
  });

  it('only forwards single neighbouring words, never sentences', async () => {
    const p = ok('a');
    await lookupAll('bank', { providers: [p], lc: 'the whole river bank sentence', rc: 'of' });
    expect(p.lookup).toHaveBeenCalledWith('bank', { fresh: false, lc: '', rc: 'of' });
  });

  it('rejects invalid terms', async () => {
    await expect(lookupAll('http://evil', { providers: [] })).rejects.toThrow();
  });
});

describe('getJson', () => {
  it('maps HTTP statuses to provider errors', async () => {
    const respond = (status, body = {}) => vi.fn(async () => new Response(JSON.stringify(body), { status }));
    vi.stubGlobal('fetch', respond(404));
    await expect(getJson('https://x')).rejects.toMatchObject({ status: 'not_found' });
    vi.stubGlobal('fetch', respond(429));
    await expect(getJson('https://x')).rejects.toMatchObject({ status: 'rate_limited' });
    vi.stubGlobal('fetch', respond(502, { title: 'No Definitions Found' }));
    await expect(getJson('https://x', { isNotFoundBody: (b) => b.title === 'No Definitions Found' })).rejects.toMatchObject({ status: 'not_found' });
    vi.stubGlobal('fetch', respond(500));
    await expect(getJson('https://x', { retryDelayMs: 0 })).rejects.toMatchObject({ status: 'error' });
    vi.stubGlobal('fetch', vi.fn(async () => { throw new TypeError('fetch failed'); }));
    await expect(getJson('https://x', { retryDelayMs: 0 })).rejects.toMatchObject({ status: 'error' });
    vi.unstubAllGlobals();
  });

  it('retries once on a transient 5xx, but not on 404 or 429', async () => {
    const fetch = vi.fn()
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockResolvedValueOnce(new Response('[1]', { status: 200 }));
    vi.stubGlobal('fetch', fetch);
    await expect(getJson('https://x', { retryDelayMs: 0 })).resolves.toEqual([1]);
    expect(fetch).toHaveBeenCalledTimes(2);

    const limited = vi.fn(async () => new Response('{}', { status: 429 }));
    vi.stubGlobal('fetch', limited);
    await expect(getJson('https://x', { retryDelayMs: 0 })).rejects.toMatchObject({ status: 'rate_limited' });
    expect(limited).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });
});
