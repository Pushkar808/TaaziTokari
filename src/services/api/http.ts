// The only place the browser talks to the backend. Requests go to /api (the Vite dev
// server proxies it to the NestJS API) and carry the login token when there is one.

const TOKEN_KEY = 'taazi_tokari_token';

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

type Method = 'GET' | 'POST' | 'PATCH' | 'DELETE';

// Counts requests in flight so the global loader knows when to show. Silent calls are not counted.
let pending = 0;
const listeners = new Set<() => void>();
const setPending = (delta: number) => {
  pending += delta;
  listeners.forEach((l) => l());
};

// Requests started while a silent scope is open (background polling) are not counted.
let silentDepth = 0;

export const busy = {
  get: () => pending,
  runSilent: async <T>(fn: () => Promise<T>): Promise<T> => {
    silentDepth++;
    try {
      return await fn();
    } finally {
      silentDepth--;
    }
  },
  subscribe: (listener: () => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

async function request<T>(method: Method, path: string, body?: unknown, silent = false): Promise<T> {
  if (silent || silentDepth > 0) return send<T>(method, path, body);
  setPending(1);
  try {
    return await send<T>(method, path, body);
  } finally {
    setPending(-1);
  }
}

async function send<T>(method: Method, path: string, body?: unknown): Promise<T> {
  const token = tokenStore.get();
  let response: Response;
  try {
    response = await fetch(`/api${path}`, {
      method,
      headers: {
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
  } catch {
    throw new Error('Cannot reach the server. Please check your connection and try again.');
  }

  const text = await response.text();
  const data = text ? JSON.parse(text) : null;
  if (!response.ok) {
    // The API answers errors with { message: string | string[] }.
    const message = Array.isArray(data?.message) ? data.message.join(', ') : data?.message;
    throw new Error(message || `Request failed (${response.status})`);
  }
  return data as T;
}

export const http = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body?: unknown, opts?: { silent?: boolean }) =>
    request<T>('POST', path, body ?? {}, opts?.silent),
  patch: <T>(path: string, body: unknown) => request<T>('PATCH', path, body),
  delete: <T>(path: string) => request<T>('DELETE', path),
};
