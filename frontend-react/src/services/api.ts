import axios from 'axios';
import type { AuthRequestConfig } from '../types/auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE;

const refreshClient = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

let refreshAccessTokenPromise: Promise<string> | null = null;

export const refreshAccessToken = async (): Promise<string> => {
  const { data } = await refreshClient.post<{ access_token: string; token_type: string }>('/v1/auth/refresh');
  localStorage.setItem('token', data.access_token);
  return data.access_token;
};

const refreshAccessTokenOnce = (): Promise<string> => {
  if (!refreshAccessTokenPromise) {
    refreshAccessTokenPromise = refreshAccessToken().finally(() => {
      refreshAccessTokenPromise = null;
    });
  }

  return refreshAccessTokenPromise;
};

export const api = axios.create({
  baseURL: API_BASE_URL,
  withCredentials: true,
  timeout: 15000,
  headers: {
    'Content-Type': 'application/json'
  }
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  // Let the browser generate the multipart boundary for image uploads.
  if (config.data instanceof FormData && config.headers) {
    config.headers.delete?.('Content-Type');
    delete config.headers['Content-Type'];
  }
  return config;
}, (error) => {
  return Promise.reject(error);
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config as AuthRequestConfig | undefined;
    const status = error.response?.status;
    const requestUrl = originalRequest?.url ?? '';
    const isAuthEndpoint = requestUrl.includes('/v1/auth/login') || requestUrl.includes('/v1/auth/refresh');

    if (status === 401 && originalRequest && !originalRequest._retry && !isAuthEndpoint) {
      originalRequest._retry = true;

      try {
        const newToken = await refreshAccessTokenOnce();
        originalRequest.headers = originalRequest.headers ?? {};
        originalRequest.headers.Authorization = `Bearer ${newToken}`;
        return api(originalRequest as never);
      } catch {
        localStorage.removeItem('token');
        window.dispatchEvent(new Event('auth:logout'));
        if (error.response?.data) {
          error.response.data.detail = 'Phiên đăng nhập đã hết hạn. Vui lòng đăng nhập lại.';
        }
        return Promise.reject(error);
      }
    }

    return Promise.reject(error);
  }
);

