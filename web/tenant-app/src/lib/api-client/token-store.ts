/** An injected token store, so the same client class could later be reused
 * by a mobile client backed by a secure-storage implementation instead. */
export interface TokenStore {
  getAccess(): string | null;
  getRefresh(): string | null;
  setTokens(access: string, refresh: string): void;
  clear(): void;
}

export function localStorageTokenStore(prefix = "surveyqs"): TokenStore {
  const accessKey = `${prefix}.access`;
  const refreshKey = `${prefix}.refresh`;
  const safe = typeof window !== "undefined";

  return {
    getAccess: () => (safe ? window.localStorage.getItem(accessKey) : null),
    getRefresh: () => (safe ? window.localStorage.getItem(refreshKey) : null),
    setTokens: (access, refresh) => {
      if (!safe) return;
      window.localStorage.setItem(accessKey, access);
      window.localStorage.setItem(refreshKey, refresh);
    },
    clear: () => {
      if (!safe) return;
      window.localStorage.removeItem(accessKey);
      window.localStorage.removeItem(refreshKey);
    },
  };
}
