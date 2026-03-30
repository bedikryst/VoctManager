/**
 * @file api.ts
 * @description Core Axios instance and API client configuration.
 * @architecture
 * ENTERPRISE 2026: Fully delegates JWT transmission to HttpOnly cookies to prevent XSS.
 * Implements concurrent request pausing via Promise Queueing during token rotation.
 * Utilizes `withXSRFToken` strict mode for modern Axios Cross-Origin CSRF protection.
 * @module utils/api
 * @author Krystian Bugalski
 */

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

// Rozszerzamy konfigurację Axios o flagę zapobiegającą pętlom odświeżania
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    // Wymagane dla HttpOnly Cookies (JWT)
    withCredentials: true, 
    // ENTERPRISE FIX: Wymagane w nowoczesnym Axiosie dla ochrony CSRF cross-origin!
    withXSRFToken: true,   
});

// Konfiguracja nazw dla Django
api.defaults.xsrfCookieName = 'csrftoken';
api.defaults.xsrfHeaderName = 'X-CSRFToken';

// --- System kolejkowania zapytań (Token Rotation) ---
let isRefreshing = false;
let failedQueue: Array<{ resolve: () => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve();
        }
    });
    failedQueue = [];
};

// Zostawiamy interceptor requestu czysty - przeglądarka sama dodaje ciastka HttpOnly
api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => config,
    (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        // Jeśli otrzymamy 401 Unauthorized, to znaczy, że Access Token wygasł
        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== '/api/token/refresh/') {
            
            // Jeśli inne zapytanie już odświeża token, to wstrzymujemy (kolejkujemy)
            if (isRefreshing) {
                return new Promise<void>((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                .then(() => {
                    // Po udanym odświeżeniu powtarzamy zapytanie (ciastko będzie już zaktualizowane)
                    return api(originalRequest);
                })
                .catch(err => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                // Wywołujemy endpoint odświeżania. 
                // Django sprawdzi ciastko Refresh i ustawi NOWE ciastko Access.
                await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/token/refresh/`, {}, {
                    withCredentials: true,
                    withXSRFToken: true // Upewniamy się, że tu też działa CSRF
                });

                isRefreshing = false;
                
                // Uwalniamy wstrzymane zapytania
                processQueue(null);
                
                // Powtarzamy pierwotne zapytanie z nowym ciastkiem
                return api(originalRequest);

            } catch (refreshError) {
                // Jeśli odświeżanie zawiedzie (np. Refresh Token wygasł / wylogowano)
                console.warn('[API] Sesja wygasła. Wymagane ponowne logowanie.');
                isRefreshing = false;
                processQueue(refreshError);
                
                // Twarde przekierowanie do logowania
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;