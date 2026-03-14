/**
 * @file api.js
 * @description Core Axios instance and API client configuration.
 * Implements JWT injection and automatic, silent token refreshing (Retry Pattern) 
 * to ensure seamless user experience without abrupt logouts.
 * @author Krystian Bugalski
 */

import axios from 'axios';

// 1. Initialize the core Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. Request Interceptor: Attach Access Token
api.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('access_token');
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => Promise.reject(error)
);

// 3. Response Interceptor: Silent Token Refresh Logic
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;

        // If the error is 401, we haven't retried yet, and we aren't currently trying to refresh the token
        if (error.response && error.response.status === 401 && !originalRequest._retry && originalRequest.url !== '/api/token/refresh/') {
            originalRequest._retry = true;
            const refreshToken = localStorage.getItem('refresh_token');

            if (refreshToken) {
                try {
                    // Attempt to get a new access token using the pure axios instance to avoid infinite interceptor loops
                    const response = await axios.post(`${import.meta.env.VITE_API_URL || ''}/api/token/refresh/`, {
                        refresh: refreshToken
                    });

                    // Save the new access token
                    const newAccessToken = response.data.access;
                    localStorage.setItem('access_token', newAccessToken);

                    // Update the failed request header and retry it seamlessly
                    originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
                    return api(originalRequest);
                } catch (refreshError) {
                    // Refresh token is invalid/expired. Hard logout is required.
                    console.warn('Refresh token expired. Forcing logout...');
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                    window.location.href = '/login';
                    return Promise.reject(refreshError);
                }
            } else {
                // No refresh token available, redirect to login
                localStorage.removeItem('access_token');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

export default api;