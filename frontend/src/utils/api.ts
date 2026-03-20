/**
 * @file api.ts
 * @description Core Axios instance and API client configuration.
 * Implements JWT injection and automatic, silent token refreshing (Retry Pattern) 
 * with Request Queueing to prevent race conditions during parallel fetching.
 * @architecture Enterprise 2026 Standards
 * @module utils/api
 */

import axios, { AxiosError, InternalAxiosRequestConfig, AxiosResponse } from 'axios';

interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// Zmienne do obsługi kolejki (Mutex)
let isRefreshing = false;
let failedQueue: Array<{ resolve: (value?: unknown) => void; reject: (reason?: any) => void }> = [];

const processQueue = (error: any, token: string | null = null) => {
    failedQueue.forEach(prom => {
        if (error) {
            prom.reject(error);
        } else {
            prom.resolve(token);
        }
    });
    failedQueue = [];
};

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => {
        const token = localStorage.getItem('access_token');
        if (token && config.headers) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
    (response: AxiosResponse) => response,
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        if (error.response?.status === 401 && originalRequest && !originalRequest._retry && originalRequest.url !== '/api/token/refresh/') {
            
            // Jeśli inny request już odświeża token, dodaj to zapytanie do kolejki
            if (isRefreshing) {
                return new Promise(function(resolve, reject) {
                    failedQueue.push({ resolve, reject });
                }).then(token => {
                    if (originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${token}`;
                    }
                    return api(originalRequest);
                }).catch(err => {
                    return Promise.reject(err);
                });
            }

            // Zablokuj kolejkę i rozpocznij odświeżanie
            originalRequest._retry = true;
            isRefreshing = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/token/refresh/`, {
                        refresh: refreshToken
                    });

                    const newAccessToken = response.data.access;
                    localStorage.setItem('access_token', newAccessToken);

                    // Odblokuj kolejkę i puść wstrzymane zapytania
                    isRefreshing = false;
                    processQueue(null, newAccessToken);

                    if (originalRequest.headers) {
                        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    }
                    
                    return api(originalRequest);
                } catch (refreshError) {
                    console.warn('Session termination: Refresh token expired.');
                    isRefreshing = false;
                    processQueue(refreshError, null);
                    
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            } else {
                isRefreshing = false;
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;