import * as SecureStore from "expo-secure-store";
import type { TokenStore } from "@surveyqs/shared";

const ACCESS_KEY = "surveyqs.access";
const REFRESH_KEY = "surveyqs.refresh";

/**
 * Tokens only — small values, so expo-secure-store's per-key limits never
 * come into play. Everything larger (drafts, the outbox) lives in
 * AsyncStorage; see drafts-store.ts / outbox.ts.
 */
export function secureTokenStore(): TokenStore {
  // In-memory mirror so `getAccess`/`getRefresh` can stay synchronous, which
  // the shared API client's request interceptor assumes (it does its own
  // async refresh, but reads the *current* token synchronously first).
  // Hydrated once at app start — see hydrateTokenStore() in App.tsx.
  let access: string | null = null;
  let refresh: string | null = null;

  return {
    getAccess: () => access,
    getRefresh: () => refresh,
    setTokens: (a, r) => {
      access = a;
      refresh = r;
      void SecureStore.setItemAsync(ACCESS_KEY, a);
      void SecureStore.setItemAsync(REFRESH_KEY, r);
    },
    clear: () => {
      access = null;
      refresh = null;
      void SecureStore.deleteItemAsync(ACCESS_KEY);
      void SecureStore.deleteItemAsync(REFRESH_KEY);
    },
    // Non-standard extras, used only by hydrateTokenStore below.
    ...({
      __hydrate: async () => {
        access = await SecureStore.getItemAsync(ACCESS_KEY);
        refresh = await SecureStore.getItemAsync(REFRESH_KEY);
        return Boolean(access);
      },
    } as Record<string, unknown>),
  } as TokenStore & { __hydrate: () => Promise<boolean> };
}
