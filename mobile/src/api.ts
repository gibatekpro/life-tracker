import { ApiError, createApi } from '@lifetracker/core';

import { getApiKey } from './lib/apiKey';

// The Mac's Tailscale address, from mobile/.env. Expo swaps in the value at bundle time,
// so it must be read exactly as process.env.EXPO_PUBLIC_API_URL (no destructuring).
const baseUrl = process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '');

// The phone's API client (the endpoints live in packages/core/src/api.ts). Requests from the phone
// aren't from the Mac's loopback, so NetworkApiKeyMiddleware wants X-Api-Key (from the Keychain).
// A sleeping Mac doesn't refuse the connection, it just never answers, hence the timeout.
export const { getBudgetMonth } = createApi({
  baseUrl: baseUrl ?? '',
  getHeaders: async (): Promise<Record<string, string>> => {
    if (!baseUrl) {
      throw new ApiError("The API address isn't set: copy mobile/.env.example to mobile/.env and restart Expo.");
    }
    const apiKey = await getApiKey();
    return apiKey ? { 'X-Api-Key': apiKey } : {};
  },
  timeoutMs: 10_000,
  messages: {
    unreachable: `Can't reach the API at ${baseUrl}. Is the Mac awake, the API running and Tailscale on?`,
    // The middleware answers 401 with no body.
    unauthorized: 'API key missing or wrong, set it in Settings.',
  },
});
