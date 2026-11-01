import { fetchJson } from '../../core/helpers';
import { transientApiError } from './studioMatching';

let queue = Promise.resolve();
let nextRequest = 0;

/** All music requests share one rate-aware Discogs queue and retry policy. */
export async function discogsFetch(address: string): Promise<any> {
  let release: () => void = () => {};
  const previous = queue;
  queue = new Promise<void>(done => { release = done; });
  await previous;
  try {
    const token = process.env.DISCOGS_TOKEN;
    const url = new URL(address);
    // Do not expose the Discogs token in HTTP access logs or error URLs.
    url.searchParams.delete('token');
    const headers: Record<string, string> = { 'User-Agent': 'DVinyl-Catalog/1.0' };
    if (token) headers.Authorization = 'Discogs token=' + token;
    for (let attempt = 0; attempt < 3; attempt++) {
      const delay = Math.max(0, nextRequest - Date.now());
      if (delay) await new Promise(done => setTimeout(done, delay));
      nextRequest = Date.now() + 350;
      try {
        return await fetchJson(url.toString(), { headers, signal: AbortSignal.timeout(16000) });
      } catch (error: any) {
        if (!transientApiError(error) || attempt === 2) throw error;
        const pause = Math.min(error.retryAfterMs || 1500 * (attempt + 1), 10000);
        await new Promise(done => setTimeout(done, pause));
      }
    }
  } finally {
    release();
  }
}
