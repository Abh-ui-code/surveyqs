import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import { SurveyQsApiClient, type TokenStore } from "@surveyqs/shared";

import { secureTokenStore } from "./secure-storage";
import { setAuthActive } from "./auth-store";

const USER_ID_KEY = "surveyqs.session.userId";

function resolveApiBase(): string {
  const fromExtra = Constants.expoConfig?.extra?.apiUrl as string | undefined;
  return fromExtra ?? "http://localhost:8000/api";
}

const tokenStore = secureTokenStore() as TokenStore & { __hydrate: () => Promise<boolean> };

export const api = new SurveyQsApiClient({
  baseUrl: resolveApiBase(),
  tokenStore,
  onUnauthorized: () => {
    setAuthActive(false);
  },
});

/** Reads the encrypted store into the in-memory mirror once at boot.
 * Returns whether a session was found — App.tsx uses this to decide
 * whether to skip straight past the login screen. */
export async function hydrateSession(): Promise<boolean> {
  return tokenStore.__hydrate();
}

/** Persist a fresh access/refresh pair after login — the request
 * interceptor reads them from this same store on every call after. */
export function persistSession(access: string, refresh: string): void {
  tokenStore.setTokens(access, refresh);
}

/** Wipe the session on sign-out. */
export function clearSession(): void {
  tokenStore.clear();
  void AsyncStorage.removeItem(USER_ID_KEY);
}

/** Not a secret — just which user's drafts/outbox to scope to before a
 * biometric unlock has re-established a live session. */
export function persistUserId(id: string): void {
  void AsyncStorage.setItem(USER_ID_KEY, id);
}

export async function getStoredUserId(): Promise<string | null> {
  return AsyncStorage.getItem(USER_ID_KEY);
}
