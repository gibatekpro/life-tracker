import { afterEach, describe, expect, it, vi } from 'vitest';

import { ApiError, createApi } from './api';

// A fake fetch that records each call and answers with `respond`.
function fakeFetch(respond: (url: string, init: RequestInit) => Response | Promise<Response>) {
  const calls: { url: string; init: RequestInit }[] = [];
  vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => {
    calls.push({ url, init });
    return Promise.resolve(respond(url, init));
  }));
  return calls;
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('createApi', () => {
  it('puts the base URL in front, adds the headers, and sends JSON', async () => {
    const calls = fakeFetch(() => json({ id: 1 }, 201));
    const api = createApi({ baseUrl: 'http://100.1.2.3:5080', getHeaders: async () => ({ 'X-Api-Key': 'k' }) });
    await api.addAlias(5, "Lloyd's");
    expect(calls[0].url).toBe('http://100.1.2.3:5080/accounts/5/aliases');
    expect(calls[0].init).toMatchObject({ method: 'POST', body: JSON.stringify({ alias: "Lloyd's" }),
      headers: { 'X-Api-Key': 'k', 'Content-Type': 'application/json' } });
  });

  it("turns the API's refusal into an ApiError with its message and status", async () => {
    fakeFetch(() => json({ error: 'Amount must be above zero.' }, 400));
    const err = await createApi({ baseUrl: '/api' }).getSettings().catch((e) => e);
    expect(err).toBeInstanceOf(ApiError);
    expect(err).toMatchObject({ message: 'Amount must be above zero.', status: 400 });
  });

  it('says Not found, or something went wrong, when the API gives no message', async () => {
    fakeFetch(() => new Response('', { status: 404 }));
    await expect(createApi({ baseUrl: '/api' }).getAccount(9)).rejects.toThrow('Not found.');
    fakeFetch(() => new Response('', { status: 500 }));
    await expect(createApi({ baseUrl: '/api' }).getAccount(9)).rejects.toThrow('Something went wrong (500).');
  });

  it('gives back nothing for 204 No Content', async () => {
    fakeFetch(() => new Response(null, { status: 204 }));
    await expect(createApi({ baseUrl: '/api' }).deleteInsight(1)).resolves.toBeUndefined();
  });

  it("uses the app's own wording for a 401 and for no answer, only when it has some (the web doesn't)", async () => {
    const messages = { unauthorized: 'API key missing or wrong, set it in Settings.', unreachable: "Can't reach the API." };
    fakeFetch(() => new Response(null, { status: 401 }));
    await expect(createApi({ baseUrl: '', messages }).getSettings()).rejects.toMatchObject({ message: messages.unauthorized, status: 401 });
    await expect(createApi({ baseUrl: '/api' }).getSettings()).rejects.toThrow('Something went wrong (401).');

    vi.stubGlobal('fetch', vi.fn(() => Promise.reject(new TypeError('Network request failed'))));
    await expect(createApi({ baseUrl: '', messages }).getSettings()).rejects.toThrow("Can't reach the API.");
    await expect(createApi({ baseUrl: '/api' }).getSettings()).rejects.toThrow('Network request failed');
  });

  it('gives up after timeoutMs, but waits slowTimeoutMs for an insight', async () => {
    vi.useFakeTimers();
    const aborted: string[] = [];
    vi.stubGlobal('fetch', vi.fn((url: string, init: RequestInit) => new Promise((_, reject) => {
      init.signal?.addEventListener('abort', () => { aborted.push(url); reject(new Error('aborted')); });
    })));
    const api = createApi({ baseUrl: '', timeoutMs: 10_000, slowTimeoutMs: 90_000, messages: { unreachable: 'gone' } });
    const quick = api.getSettings().catch((e: Error) => e.message);
    const slow = api.generateInsight(2026, 10).catch((e: Error) => e.message);
    await vi.advanceTimersByTimeAsync(10_001);
    expect(aborted).toEqual(['/settings']);
    await vi.advanceTimersByTimeAsync(80_000);
    expect(aborted).toEqual(['/settings', '/insights']);
    expect([await quick, await slow]).toEqual(['gone', 'gone']);
  });
});
