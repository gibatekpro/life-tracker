import { getApiKey } from './lib/apiKey';
import type { BudgetMonthView } from '@lifetracker/core';

// The Mac's Tailscale address, from mobile/.env. Expo swaps in the value at bundle time,
// so it must be read exactly as process.env.EXPO_PUBLIC_API_URL (no destructuring).
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

// A sleeping Mac doesn't refuse the connection, it just never answers; give up after this.
const TIMEOUT_MS = 10_000;

// An Error whose message is ready to show, plus the HTTP status when the API answered,
// so a screen can react to a 401 (e.g. offer Settings) without matching on the text.
export class ApiError extends Error {
  readonly status?: number;

  constructor(message: string, status?: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

// Every call goes through here, as in web/src/api.ts. Requests from the phone aren't from the
// Mac's loopback, so NetworkApiKeyMiddleware wants X-Api-Key (from the Keychain). When the API
// says no, its message ({ error } or a plain string) becomes the error's message.
async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  if (!baseUrl) {
    throw new ApiError("The API address isn't set: copy mobile/.env.example to mobile/.env and restart Expo.");
  }

  const apiKey = await getApiKey();
  const headers: Record<string, string> = {};
  if (apiKey) headers['X-Api-Key'] = apiKey;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch(`${baseUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch {
    // Timed out (the Mac is asleep) or no route at all (Tailscale off, API not running).
    throw new ApiError(`Can't reach the API at ${baseUrl}. Is the Mac awake, the API running and Tailscale on?`);
  } finally {
    clearTimeout(timer);
  }

  // The middleware answers 401 with no body.
  if (res.status === 401) throw new ApiError('API key missing or wrong, set it in Settings.', 401);

  if (!res.ok) {
    const payload = await res.json().catch(() => null);
    const message =
      typeof payload === 'string' ? payload
        : payload?.error ?? payload?.title
        ?? (res.status === 404 ? 'Not found.' : `Something went wrong (${res.status}).`);
    throw new ApiError(message, res.status);
  }

  return res.status === 204 ? (undefined as T) : res.json();
}

// Budgets: a month's lines (no year/month = the budget month I'm in now, following payday).
export const getBudgetMonth = (year?: number, month?: number) =>
  request<BudgetMonthView>('GET', year && month ? `/budgets/month?year=${year}&month=${month}` : '/budgets/month');
