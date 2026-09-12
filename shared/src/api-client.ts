import axios, { type AxiosInstance, type AxiosRequestConfig, type AxiosResponse } from "axios";
import { jwtDecode } from "jwt-decode";

export interface PaginatedResponse<T> {
  count: number;
  next: string | null;
  previous: string | null;
  results: T[];
}

/** Injected so the same client works against localStorage (web) or an
 * encrypted secure-store (mobile) without this file knowing which. */
export interface TokenStore {
  getAccess(): string | null;
  getRefresh(): string | null;
  setTokens(access: string, refresh: string): void;
  clear(): void;
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
 * One HTTP client shared by web and mobile: proactive refresh before the
 * access token expires, a single-flight reactive refresh-and-retry on 401,
 * and the rule that only a real 401 *with a response* clears credentials —
 * a network error, timeout or 5xx rethrows and keeps the session, which
 * matters even more on mobile than on web since a dropped signal must
 * never be indistinguishable from being signed out.
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
}

/** DRF returns either `{detail: "..."}` or `{field: ["msg", ...]}`. One
 * unwrap, shared by both clients' error toasts/messages. */
export function apiErrorMessage(error: unknown, fallback = "Something went wrong. Please try again."): string {
  const data = (error as { response?: { data?: Record<string, unknown> } })?.response?.data;
  if (!data) return error instanceof Error && error.message ? error.message : fallback;
  if (typeof data.detail === "string") return data.detail;
  const fieldErrors = Object.values(data)
    .flat()
    .filter((v): v is string => typeof v === "string");
  return fieldErrors.length > 0 ? fieldErrors.join(" ") : fallback;
}
