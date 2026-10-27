// Small axios wrapper for dictionary providers (server only).
import axios, { AxiosError } from 'axios';

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

async function getJsonOnce(url: string, { notFoundStatuses = [404], isNotFoundBody }: GetJsonOptions = {}): Promise<unknown> {
  let status: number;
  let data: unknown;

  try {
    const res = await axios.get<unknown>(url, {
      headers: { Accept: 'application/json' },
      timeout: TIMEOUT_MS,
      // Let us inspect the status ourselves instead of having axios throw on 4xx/5xx.
      validateStatus: () => true,
    });
    status = res.status;
    data = res.data;
  } catch (err) {
    const e = err as AxiosError;
    if (e.code === 'ECONNABORTED' || e.code === 'ERR_CANCELED') {
      throw new ProviderError('error', 'The provider took too long to respond.');
    }
    throw Object.assign(new ProviderError('error', 'Could not reach the provider.'), { retryable: true });
  }

  if (notFoundStatuses.includes(status)) throw new ProviderError('not_found', 'No entry found.');
  if (status === 429) throw new ProviderError('rate_limited', 'Rate limit reached. Try again later.');
  if (status >= 400) {
    if (isNotFoundBody && isNotFoundBody(data)) throw new ProviderError('not_found', 'No entry found.');
    throw Object.assign(
      new ProviderError('error', `Provider returned HTTP ${status}.`),
      { retryable: status >= 500 },
    );
  }

  return data;
}

export const POS_NAMES: Record<string, string> = { n: 'noun', v: 'verb', adj: 'adjective', adv: 'adverb' };
