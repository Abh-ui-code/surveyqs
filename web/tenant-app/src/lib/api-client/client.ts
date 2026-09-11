import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";
import type { TokenStore } from "./token-store";

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

interface JwtPayload {
  exp: number;
}

function isExpiringSoon(token: string, bufferSeconds = 30): boolean {
  try {
    const { exp } = jwtDecode<JwtPayload>(token);
    return exp * 1000 - Date.now() < bufferSeconds * 1000;
  } catch {
    return true;
  }
}

const NO_RETRY_PATHS = ["/auth/login/", "/auth/refresh/", "/auth/logout/"];

export interface SurveyQsApiClientConfig {
  baseUrl: string;
  tokenStore: TokenStore;
  onUnauthorized?: () => void;
}

/**
 * One HTTP client for the whole app: proactive refresh before the access
 * token expires (a page firing several parallel requests at the moment of
 * expiry would otherwise 401 all of them at once), a single-flight
 * reactive refresh-and-retry on 401, and the offline-aware rule that only
 * a real 401/403 *with a response* clears credentials -- a network error,
 * timeout or 5xx rethrows and keeps the session, so a dropped connection
 * never signs a user out mid-task.
 */
export class SurveyQsApiClient {
  readonly axios: AxiosInstance;
  private readonly tokenStore: TokenStore;
  private readonly onUnauthorized?: () => void;
  private refreshPromise: Promise<string | null> | null = null;

  constructor(config: SurveyQsApiClientConfig) {
    this.tokenStore = config.tokenStore;
    this.onUnauthorized = config.onUnauthorized;
    this.axios = axios.create({ baseURL: config.baseUrl, timeout: 20_000 });

    this.axios.interceptors.request.use(async (req) => {
      if (NO_RETRY_PATHS.some((p) => req.url?.includes(p))) return req;
      let access = this.tokenStore.getAccess();
      if (access && isExpiringSoon(access)) {
        access = await this.refreshAccessToken();
      }
      if (access) req.headers.Authorization = `Bearer ${access}`;
      req.headers["X-Request-ID"] = crypto.randomUUID();
      return req;
    });

    this.axios.interceptors.response.use(
      (res) => res,
      async (error) => {
        const original = error.config as (AxiosRequestConfig & { __retried?: boolean }) | undefined;
        const status = error.response?.status;
        const isNoRetryPath = original?.url && NO_RETRY_PATHS.some((p) => original.url!.includes(p));

        if (status === 401 && original && !original.__retried && !isNoRetryPath) {
          original.__retried = true;
          const access = await this.refreshAccessToken();
          if (access) {
            original.headers = { ...original.headers, Authorization: `Bearer ${access}` };
            return this.axios(original);
          }
        }

        // Only a real 401 (unauthenticated, and refresh already failed above)
        // clears credentials. A 403 means the session is valid but lacks
        // permission for this resource -- signing the user out on every
        // permission-gated request would make "logged in as a low-privilege
        // role" indistinguishable from "not logged in". A network error,
        // timeout, or 5xx must never sign the user out either.
        if (error.response && status === 401 && !isNoRetryPath) {
          this.tokenStore.clear();
          this.onUnauthorized?.();
        }
        throw error;
      },
    );
  }

  private async refreshAccessToken(): Promise<string | null> {
    if (this.refreshPromise) return this.refreshPromise;
    const refresh = this.tokenStore.getRefresh();
    if (!refresh) return null;

    this.refreshPromise = axios
      .post(`${this.axios.defaults.baseURL}/auth/refresh/`, { refresh })
      .then((res) => {
        const { access, refresh: newRefresh } = res.data as { access: string; refresh?: string };
        this.tokenStore.setTokens(access, newRefresh ?? refresh);
        return access;
      })
      .catch(() => {
        this.tokenStore.clear();
        this.onUnauthorized?.();
        return null;
      })
      .finally(() => {
        this.refreshPromise = null;
      });

    return this.refreshPromise;
  }

  async get<T>(url: string, params?: object): Promise<T> {
    const res: AxiosResponse<T> = await this.axios.get(url, { params });
    return res.data;
  }

  async list<T>(url: string, params?: object, signal?: AbortSignal): Promise<PaginatedResponse<T>> {
    const res = await this.axios.get<PaginatedResponse<T>>(url, { params, signal });
    return res.data;
  }

  async post<T, B = unknown>(url: string, body?: B, config?: AxiosRequestConfig): Promise<T> {
    const res: AxiosResponse<T> = await this.axios.post(url, body, config);
    return res.data;
  }

  async patch<T, B = unknown>(url: string, body?: B): Promise<T> {
    const res: AxiosResponse<T> = await this.axios.patch(url, body);
    return res.data;
  }

  async delete<T = void>(url: string): Promise<T> {
    const res: AxiosResponse<T> = await this.axios.delete(url);
    return res.data;
  }

  async postMultipart<T>(url: string, formData: FormData, onUploadProgress?: (percent: number) => void): Promise<T> {
    const res: AxiosResponse<T> = await this.axios.post(url, formData, {
      headers: { "Content-Type": "multipart/form-data" },
      onUploadProgress: onUploadProgress
        ? (e) => onUploadProgress(e.total ? Math.round((e.loaded / e.total) * 100) : 0)
        : undefined,
    });
    return res.data;
  }

  async getBlob(url: string, params?: Record<string, unknown>): Promise<{ blob: Blob; headers: Record<string, string> }> {
    const res = await this.axios.get(url, { params, responseType: "blob" });
    const headers: Record<string, string> = {};
    Object.entries(res.headers).forEach(([k, v]) => {
      headers[k.toLowerCase()] = String(v);
    });
    return { blob: res.data, headers };
  }
}

/** DRF returns either `{detail: "..."}` or `{field: ["msg", ...]}`. This is
 * the one place that unwrapping happens, so it is never copy-pasted into
 * every mutation's onError handler. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return fallback;
  if (typeof data.detail === "string") return data.detail;
  const fieldErrors = Object.values(data)
    .flat()
    .filter((v): v is string => typeof v === "string");
  return fieldErrors.length > 0 ? fieldErrors.join(" ") : fallback;
}
