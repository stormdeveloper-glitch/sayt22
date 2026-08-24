import axios, { AxiosError, AxiosInstance, AxiosResponse } from 'axios';

const STORAGE_KEY_TOKEN = 'educrm_token';
const STORAGE_KEY_USER = 'educrm_user';

export interface PaginatedResponse<T> {
  data: T;
  meta: {
    page: number;
    limit: number;
    total: number;
    pageCount?: number;
  };
}

function isPaginated<T>(raw: unknown): raw is PaginatedResponse<T> {
  return (
    typeof raw === 'object' &&
    raw !== null &&
    'data' in raw &&
    'meta' in raw &&
    typeof (raw as { meta?: { page?: unknown } }).meta === 'object' &&
    (raw as { meta: { page?: unknown } }).meta !== null
  );
}

export function unwrapListResponse<T>(response: AxiosResponse): PaginatedResponse<T> {
  const payload = response.data;
  if (isPaginated<T>(payload)) {
    return payload;
  }
  const total = Array.isArray(payload) ? payload.length : 0;
  return {
    data: payload as T,
    meta: { page: 1, limit: total, total },
  };
}

export function unwrapData<T>(response: AxiosResponse): T {
  const payload = response.data;
  if (payload && typeof payload === 'object' && 'data' in payload) {
    return (payload as { data: T }).data;
  }
  return payload as T;
}

function extractErrorMessage(error: unknown): string {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ error?: string; message?: string }>;
    const data = ax.response?.data;
    if (data && (data.error || data.message)) {
      return data.error || data.message!;
    }
    if (!ax.response) {
      return 'Tarmoq xatosi. Serverga ulanib bo‘lmadi.';
    }
    if (ax.response.status === 401) return "Ro'yxatdan o'tilmagan";
    if (ax.response.status === 403) return 'Huquqlar yetarli emas';
    if (ax.response.status === 404) return 'Manba topilmadi';
    if (ax.response.status >= 500) return 'Server ichki xatosi';
  }
  if (error instanceof Error) return error.message;
  return 'Noma\'lum xato yuz berdi';
}

// Global axios instance — barcha API so'rovlari shu orqali yuboriladi
const VITE_BASE = (import.meta as unknown as { env?: Record<string, string> }).env?.VITE_API_BASE_URL;
export const api: AxiosInstance = axios.create({
  baseURL: VITE_BASE || '/',
  timeout: 30_000,
  withCredentials: false,
  headers: {
    'Content-Type': 'application/json',
    'Accept': 'application/json',
  },
});

// Request interceptor: Tokenni avtomatik qo'shish
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem(STORAGE_KEY_TOKEN);
    if (token && config.headers) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => Promise.reject(error),
);

// Response interceptor: Xatolarni birlashtirish + 401 bo'lsa tozalash
api.interceptors.response.use(
  (response) => response,
  (error: unknown) => {
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      // Token eskirgan bo'lsa, sessiyani tozalash
      localStorage.removeItem(STORAGE_KEY_TOKEN);
      localStorage.removeItem(STORAGE_KEY_USER);
      delete axios.defaults.headers.common.Authorization;
      // Login sahifasiga yo'naltirish (agar window mavjud bo'lsa)
      if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
        window.location.href = '/login';
      }
    }
    // O'rtacha xato xabarini throw qilmasdan oldin, error.message ni boyitamiz
    const message = extractErrorMessage(error);
    if (error instanceof Error) {
      try {
        (error as { userMessage?: string }).userMessage = message;
      } catch {
        /* empty */
      }
    }
    return Promise.reject(error);
  },
);

export { STORAGE_KEY_TOKEN, STORAGE_KEY_USER, extractErrorMessage };
