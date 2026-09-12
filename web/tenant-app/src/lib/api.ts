import { SurveyQsApiClient } from "@/lib/api-client/client";
import { localStorageTokenStore } from "@/lib/api-client/token-store";

/**
 * Mirrors the browser's own hostname when building the API base URL. This
 * is load-bearing: multi-tenancy is routed off the backend's Host header,
 * so `abc.surveyqs.local:3000` must call `abc.surveyqs.local:8000` --
 * calling a bare `localhost:8000` from a tenant subdomain lands on the
 * public schema, where the tenant endpoints don't exist, and produces an
 * app that loads, signs in, and shows nothing.
 */
function resolveApiBase(): string {
  if (process.env.NEXT_PUBLIC_API_URL) return process.env.NEXT_PUBLIC_API_URL;
  if (typeof window !== "undefined") {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:8000/api`;
  }
  return "http://127.0.0.1:8000/api";
}

let hasRedirectedToLogin = false;

export const api = new SurveyQsApiClient({
  baseUrl: resolveApiBase(),
  tokenStore: localStorageTokenStore("surveyqs"),
  onUnauthorized: () => {
    if (typeof window === "undefined" || hasRedirectedToLogin || window.location.pathname === "/login") return;
    hasRedirectedToLogin = true;
    window.location.href = "/login";
  },
});
