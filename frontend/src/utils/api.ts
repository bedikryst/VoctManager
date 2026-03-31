/**
 * @file api.ts
 * @description Core Axios instance and API client configuration for the VoctManager application.
 * Fully delegates JWT transmission to HttpOnly cookies for strict XSS prevention.
 * Implements a concurrent request queueing mechanism during token rotation 
 * and automatically normalizes paginated responses from Django REST Framework.
 * @module utils/api
 */

import axios, { 
    AxiosError, 
    InternalAxiosRequestConfig, 
    AxiosResponse 
} from 'axios';

/**
 * Extended Axios request configuration to support retry logic during token rotation.
 */
interface CustomAxiosRequestConfig extends InternalAxiosRequestConfig {
    _retry?: boolean;
}

/**
 * Queue item definition for paused requests during authentication refresh.
 */
interface QueuedPromise {
    resolve: (value?: unknown) => void;
    reject: (reason?: AxiosError | Error | unknown) => void;
}

const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
    },
    withCredentials: true,
    withXSRFToken: true,
});

api.defaults.xsrfCookieName = 'csrftoken';
api.defaults.xsrfHeaderName = 'X-CSRFToken';

let isRefreshing = false;
let failedQueue: QueuedPromise[] = [];

/**
 * Resolves or rejects all pending requests in the queue.
 * @param {AxiosError | Error | unknown | null} error - The error to reject with, if the refresh failed.
 */
const processQueue = (error: AxiosError | Error | unknown | null = null): void => {
    failedQueue.forEach((promise) => {
        if (error) {
            promise.reject(error);
        } else {
            promise.resolve();
        }
    });
    failedQueue = [];
};

api.interceptors.request.use(
    (config: InternalAxiosRequestConfig) => config,
    (error: AxiosError) => Promise.reject(error)
);

api.interceptors.response.use(
    (response: AxiosResponse) => {
        // Automatically unwrap Django REST Framework paginated responses
        if (
            response.data && 
            typeof response.data === 'object' && 
            'results' in response.data && 
            Array.isArray(response.data.results)
        ) {
            response.data = response.data.results;
        }
        return response;
    },
    async (error: AxiosError) => {
        const originalRequest = error.config as CustomAxiosRequestConfig;

        if (
            error.response?.status === 401 && 
            originalRequest && 
            !originalRequest._retry && 
            originalRequest.url !== '/api/token/refresh/'
        ) {
            if (isRefreshing) {
                return new Promise((resolve, reject) => {
                    failedQueue.push({ resolve, reject });
                })
                .then(() => api(originalRequest))
                .catch((err) => Promise.reject(err));
            }

            originalRequest._retry = true;
            isRefreshing = true;

            try {
                await axios.post(
                    `${import.meta.env.VITE_API_URL || ''}/api/token/refresh/`, 
                    {}, 
                    {
                        withCredentials: true,
                        withXSRFToken: true,
                    }
                );

                isRefreshing = false;
                processQueue(null);
                
                return api(originalRequest);
            } catch (refreshError) {
                isRefreshing = false;
                processQueue(refreshError);
                
                window.location.href = '/login';
                return Promise.reject(refreshError);
            }
        }

        return Promise.reject(error);
    }
);

export default api;