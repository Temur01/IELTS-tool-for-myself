// Small fetch wrapper for dictionary providers (server only).

export const CACHE_SECONDS = 60 * 60 * 24;
const TIMEOUT_MS = 7000;

type ProviderStatus = 'not_found' | 'rate_limited' | 'error';

export class ProviderError extends Error {
  status: ProviderStatus;
  retryable?: boolean;

  constructor(status: ProviderStatus, message: string) {
    super(message);
    this.status = status;
  }
}

interface GetJsonOptions {
  fresh?: boolean;
  notFoundStatuses?: number[];
  isNotFoundBody?: (body: unknown) => boolean;
  retryDelayMs?: number;
}

export async function getJson(url: string, options: GetJsonOptions = {}): Promise<unknown> {
  try {
    return await getJsonOnce(url, options);
  } catch (err) {
    if (!(err instanceof ProviderError) || !err.retryable) throw err;
    await new Promise((r) => setTimeout(r, options.retryDelayMs ?? 400));
    return getJsonOnce(url, options);
  }
}

async function getJsonOnce(url: string, { fresh = false, notFoundStatuses = [404], isNotFoundBody }: GetJsonOptions = {}): Promise<unknown> {
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { Accept: 'application/json' },
      signal: AbortSignal.timeout(TIMEOUT_MS),
      ...(fresh ? { cache: 'no-store' as RequestCache } : { next: { revalidate: CACHE_SECONDS } } as RequestInit),
    });
  } catch (err: unknown) {
    const e = err as { name?: string };
    const timeout = e?.name === 'TimeoutError' || e?.name === 'AbortError';
    if (timeout) throw new ProviderError('error', 'The provider took too long to respond.');
    const retryable = Object.assign(new ProviderError('error', 'Could not reach the provider.'), { retryable: true });
    throw retryable;
  }
  if (notFoundStatuses.includes(res.status)) throw new ProviderError('not_found', 'No entry found.');
  if (res.status === 429) throw new ProviderError('rate_limited', 'Rate limit reached. Try again later.');
  if (!res.ok) {
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

export const POS_NAMES: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
