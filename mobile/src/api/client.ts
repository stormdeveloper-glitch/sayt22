import axios, { AxiosError, AxiosInstance, AxiosRequestConfig } from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DEFAULT_BASE_URL = 'https://texnopark.railway.internal';
const BASE_URL_KEY = '@texnopark_api_base_url';
const TOKEN_KEY = '@texnopark_auth_token';
export { BASE_URL_KEY, TOKEN_KEY };

type AnyObject = Record<string, unknown>;

export interface ApiError {
  status: number | null;
  code?: string;
  message: string;
  userMessage: string;
  raw: unknown;
}

function extractUserMessage(error: AxiosError<{ error?: string; message?: string }>): string {
  const data = error.response?.data;
  if (data && typeof data === 'object') {
    if (typeof data.error === 'string' && data.error.length > 0) return data.error;
    if (typeof data.message === 'string' && data.message.length > 0) return data.message;
  }
  if (!error.response) return "Tarmoq xatosi. Serverga ulanib bo'lmadi.";
  switch (error.response.status) {
    case 401:
      return "Ro'yxatdan o'tilmagan yoki sessiya muddati tugagan.";
    case 403:
      return 'Huquqlar yetarli emas.';
    case 404:
      return 'Manba topilmadi.';
    case 408:
      return 'So‘rov vaqtida bajarilmadi.';
    case 409:
      return 'Malumotlar mozoralashtirilmadi (duplicate).';
    case 413:
      return 'Yuklama hajmi juda katta.';
    case 422:
      return 'Kiritilgan malumotlar tekshiruvdan o‘tmadi.';
    case 429:
      return "Juda ko'p so'rov. Birozdan keyin urinib ko'ring.";
    default:
      if (error.response.status >= 500 && error.response.status < 600) {
        return 'Serverda ichki xato yuz berdi.';
      }
      return 'Noma\'lum xato yuz berdi.';
  }
}

export function toApiError(error: unknown): ApiError {
  if (axios.isAxiosError(error)) {
    const ax = error as AxiosError<{ error?: string; message?: string }>;
    const userMessage = extractUserMessage(ax);
    return {
      status: ax.response?.status ?? null,
      code: ax.code,
      message: ax.message,
      userMessage,
      raw: ax.response?.data ?? error,
    };
  }
  const msg = error instanceof Error ? error.message : String(error ?? '');
  return {
    status: null,
    message: msg,
    userMessage: msg || "Noma'lum xato yuz berdi.",
    raw: error,
  };
}

// --- Base URL helpers ---
export const getApiBaseUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(BASE_URL_KEY);
    return saved && saved.length > 0 ? saved : DEFAULT_BASE_URL;
  } catch {
    return DEFAULT_BASE_URL;
  }
};

export const setApiBaseUrl = async (url: string): Promise<void> => {
  try {
    await AsyncStorage.setItem(BASE_URL_KEY, url.trim());
    apiClient.defaults.baseURL = url.trim();
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[API] Base URL save failed:', e);
  }
};

// --- Token helpers ---
export const getAuthToken = async (): Promise<string | null> => {
  try {
    return await AsyncStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
};

export const setAuthToken = async (token: string | null): Promise<void> => {
  try {
    if (token) {
      await AsyncStorage.setItem(TOKEN_KEY, token);
    } else {
      await AsyncStorage.removeItem(TOKEN_KEY);
    }
  } catch (e) {
    // eslint-disable-next-line no-console
    console.error('[API] Token save failed:', e);
  }
};

// --- Axios instance ---
const apiClient: AxiosInstance = axios.create({
  timeout: 20_000,
  headers: {
    'Accept': 'application/json',
    'Content-Type': 'application/json',
  },
});

// Initialize default baseURL synchronously (as a fallback)
let _lastKnownBase: string | undefined;
getApiBaseUrl()
  .then((url) => {
    _lastKnownBase = url;
    apiClient.defaults.baseURL = url;
  })
  .catch(() => {
    apiClient.defaults.baseURL = DEFAULT_BASE_URL;
  });

// Debounce for AsyncStorage reads to avoid blocking the queue
let _pendingBasePromise: Promise<string> | null = null;
function getBaseUrlCached(): Promise<string> {
  if (_lastKnownBase) return Promise.resolve(_lastKnownBase);
  if (_pendingBasePromise) return _pendingBasePromise;
  _pendingBasePromise = getApiBaseUrl().finally(() => {
    _pendingBasePromise = null;
  });
  return _pendingBasePromise;
}

// Request interceptor: Inject baseURL + auth token
apiClient.interceptors.request.use(
  async (config: AxiosRequestConfig) => {
    const url = await getBaseUrlCached();
    if (!config.baseURL) config.baseURL = url;

    try {
      const token = await getAuthToken();
      if (token && config.headers) {
        if (typeof config.headers.set === 'function') {
          config.headers.set('Authorization', `Bearer ${token}`);
        } else {
          (config.headers as AnyObject).Authorization = `Bearer ${token}`;
        }
      }
    } catch {
      /* ignore token read errors */
    }
    return config;
  },
  (err) => Promise.reject(err),
);

// Response interceptor: Normalize errors + handle 401 globally (event emitter orqali kengaytirish mumkin)
apiClient.interceptors.response.use(
  (response) => response,
  (error) => Promise.reject(toApiError(error)),
);

export default apiClient;
