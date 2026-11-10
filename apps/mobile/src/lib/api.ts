/**
 * Mobile API client — thin typed wrapper over fetch with token injection and
 * refresh-on-401. Mirrors the web client so services are portable.
 */
import 'react-native-url-polyfill/auto';
import { tokenStore } from './storage';

const API_URL = process.env.EXPO_PUBLIC_API_URL || 'http://localhost:4000/api';

export class ApiError extends Error {
  status: number;
  data: unknown;
  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.status = status;
    this.data = data;
  }
}

/** Optional hook the auth provider installs to react to a hard 401. */
let onUnauthorized: (() => void) | null = null;
export function setUnauthorizedHandler(fn: (() => void) | null) {
  onUnauthorized = fn;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  token?: string | null;
  skipRefresh?: boolean;
  query?: Record<string, unknown>;
  headers?: Record<string, string>;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const base = path.startsWith('http') ? path : `${API_URL}${path}`;
  if (!query) return base;
  const params = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) {
    if (v === undefined || v === null || v === '') continue;
    if (typeof v === 'string' || typeof v === 'number' || typeof v === 'boolean') {
      params.set(k, String(v));
    }
  }
  const qs = params.toString();
  return qs ? `${base}?${qs}` : base;
}

async function rawFetch<T>(path: string, opts: RequestOptions): Promise<T> {
  const token = opts.token !== undefined ? opts.token : tokenStore.access;
  const headers: Record<string, string> = {
    Accept: 'application/json',
    ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(opts.headers ?? {}),
  };

  const res = await fetch(buildUrl(path, opts.query), {
    method: opts.method ?? 'GET',
    headers,
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }
  }

  if (!res.ok) {
    const msg = (data as { message?: string | string[] })?.message;
    const message = Array.isArray(msg) ? msg.join(', ') : msg?.toString() || `Request failed (${res.status})`;
    throw new ApiError(res.status, message, data);
  }
  return data as T;
}

async function tryRefresh(): Promise<boolean> {
  const refresh = tokenStore.refresh;
  if (!refresh) return false;
  try {
    const data = await rawFetch<{ tokens: { accessToken: string; refreshToken: string } }>(
      '/auth/refresh',
      { method: 'POST', body: { refreshToken: refresh }, token: null, skipRefresh: true },
    );
    await tokenStore.set(data.tokens.accessToken, data.tokens.refreshToken);
    return true;
  } catch {
    await tokenStore.clear();
    return false;
  }
}

export async function api<T = unknown>(path: string, opts: RequestOptions = {}): Promise<T> {
  try {
    return await rawFetch<T>(path, opts);
  } catch (err) {
    if (err instanceof ApiError && err.status === 401 && !opts.skipRefresh) {
      const ok = await tryRefresh();
      if (ok) return rawFetch<T>(path, opts);
      onUnauthorized?.();
    }
    throw err;
  }
}

export const http = {
  get: <T = unknown>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    api<T>(path, { ...opts, method: 'GET' }),
  post: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    api<T>(path, { ...opts, method: 'POST', body }),
  put: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    api<T>(path, { ...opts, method: 'PUT', body }),
  patch: <T = unknown>(path: string, body?: unknown, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    api<T>(path, { ...opts, method: 'PATCH', body }),
  delete: <T = unknown>(path: string, opts: Omit<RequestOptions, 'method' | 'body'> = {}) =>
    api<T>(path, { ...opts, method: 'DELETE' }),
};

export { API_URL };
