// Small fetch wrapper for dictionary providers (server only).

export const CACHE_SECONDS = 60 * 60 * 24;
const TIMEOUT_MS = 7000;

export class ProviderError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status; // 'not_found' | 'rate_limited' | 'error'
  }
}

/** GET JSON, retrying once after a brief pause on network errors or 5xx responses. */
export async function getJson(url, options = {}) {
  try {
    return await getJsonOnce(url, options);
  } catch (err) {
    if (!(err instanceof ProviderError) || !err.retryable) throw err;
    await new Promise((r) => setTimeout(r, options.retryDelayMs ?? 400));
    return getJsonOnce(url, options);
  }
}

/**
 * GET JSON with a timeout. Responses are kept in Next's data cache for 24h
 * unless `fresh` is set (the learner pressed Refresh).
 */
async function getJsonOnce(url, { fresh = false, notFoundStatuses = [404], isNotFoundBody } = {}) {
  let res;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(fresh ? { cache: 'no-store' } : { next: { revalidate: CACHE_SECONDS } }),
    });
  } catch (err) {
    const timeout = err?.name === 'TimeoutError' || err?.name === 'AbortError';
    if (timeout) throw new ProviderError('error', 'The provider took too long to respond.');
    throw Object.assign(new ProviderError('error', 'Could not reach the provider.'), { retryable: true });
  }
  if (notFoundStatuses.includes(res.status)) throw new ProviderError('not_found', 'No entry found.');
  if (res.status === 429) throw new ProviderError('rate_limited', 'Rate limit reached. Try again later.');
  if (!res.ok) {
    // Some providers report a missing word with a 5xx status but a clear body.
    if (isNotFoundBody) {
      const body = await res.json().catch(() => null);
      if (body && isNotFoundBody(body)) throw new ProviderError('not_found', 'No entry found.');
    }
    throw Object.assign(new ProviderError('error', `Provider returned HTTP ${res.status}.`), { retryable: res.status >= 500 });
  }
  try {
    return await res.json();
  } catch {
    throw new ProviderError('error', 'Provider sent an unreadable response.');
  }
}

export const POS_NAMES = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
