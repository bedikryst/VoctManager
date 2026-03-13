/**
 * Core Axios instance and API client configuration.
 * Author: Krystian Bugalski
 * * This module establishes the base connection to the Django backend.
 * It uses interceptors to automatically attach JWT tokens to every request
 * and globally handle authentication errors (e.g., expired sessions).
 */

import axios from 'axios';

// 1. Initialize the core Axios instance
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. Request Interceptor: Attach JWT Token
api.interceptors.request.use(
    (config) => {
        // Retrieve the access token from local storage
        const token = localStorage.getItem('access_token');
        
        // Inject the token into the Authorization header if it exists
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 3. Response Interceptor: Global Error Handling
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Intercept 401 Unauthorized errors (e.g., token expiration)
        if (error.response && error.response.status === 401) {
            console.warn('Session expired. Logging out...');
            localStorage.removeItem('access_token');
            
            // Hard redirect to login page to protect authenticated routes
            window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default api;