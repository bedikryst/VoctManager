/**
 * @file AuthContext.tsx
 * @description Authentication Context Provider.
 * @architecture
 * Enterprise Standard: Fully typed with TypeScript interfaces.
 * Manages global authentication state, JWT lifecycle, and user profile data.
 * Exposes a custom hook (useAuth) to protect routes and conditionally render UI.
 * @author Krystian Bugalski
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';

// --- ŚCISŁE TYPOWANIE DLA OBIEKTU AUTORYZACJI ---
export interface AuthUser {
    id: string | number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    is_admin?: boolean;
    artist_profile_id?: string | number;
    // Możesz tu dopisać inne pola, które zwraca /api/artists/me/
}

interface LoginResponse {
    success: boolean;
    error?: string;
}

interface AuthContextType {
    user: AuthUser | null;
    isAuthenticated: boolean;
    isLoading: boolean;
    login: (username: string, password: string) => Promise<LoginResponse>;
    logout: () => void;
}

// Inicjalizacja kontekstu (domyślnie null, dopóki Provider go nie nadpisze)
const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }) => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    // --- SESSION VALIDATION (On initial load) ---
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    // Axios interceptors automatically attach the token and handle potential refreshes
                    const response = await api.get('/api/artists/me/');
                    setUser(response.data as AuthUser);
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
    const login = async (username: string, password: string): Promise<LoginResponse> => {
        try {
            // 1. Obtain JWT Tokens
            const response = await api.post('/api/token/', { username, password });
            
            // 2. Persist tokens in local storage
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);

            // 3. Immediately fetch and store the authenticated user's profile
            const userResponse = await api.get('/api/artists/me/');
            setUser(userResponse.data as AuthUser);
            
            return { success: true };
        } catch (error: any) {
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

    const value: AuthContextType = {
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
export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};