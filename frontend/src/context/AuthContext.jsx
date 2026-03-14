/**
 * @file AuthContext.jsx
 * @description Authentication Context Provider.
 * Manages global authentication state, JWT lifecycle, and user profile data.
 * Exposes a custom hook (useAuth) to protect routes and conditionally render UI.
 * @author Krystian Bugalski
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [isLoading, setIsLoading] = useState(true);

    // --- SESSION VALIDATION (On initial load) ---
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    // Axios interceptors automatically attach the token and handle potential refreshes
                    const response = await api.get('/api/artists/me/');
                    setUser(response.data);
                } catch (error) {
                    console.error('Session expired or validation failed.', error);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                }
            }
            setIsLoading(false); // Conclude the loading state regardless of the outcome
        };

        checkAuth();
    }, []);

    // --- LOGIN FUNCTION ---
    const login = async (username, password) => {
        try {
            // 1. Request JWT tokens from the Django backend
            const response = await api.post('/api/token/', { username, password });
            
            // 2. Persist tokens in local storage
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);

            // 3. Immediately fetch and store the authenticated user's profile
            const userResponse = await api.get('/api/artists/me/');
            setUser(userResponse.data);
            
            return { success: true };
        } catch (error) {
            return { 
                success: false, 
                error: error.response?.data?.detail || 'Błąd logowania. Sprawdź dane wejściowe.' 
            };
        }
    };

    // --- LOGOUT FUNCTION ---
    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        window.location.href = '/login'; // Hard redirect to clear application state
    };

    const value = {
        user,
        isAuthenticated: !!user,
        isLoading,
        login,
        logout
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};

// Custom Hook shortcut
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};