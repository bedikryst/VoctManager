/**
 * @file AuthContext.tsx
 * @description Authentication Context Provider.
 * Manages global authentication state, JWT lifecycle, and user profile data.
 * Exposes a custom hook (useAuth) to protect routes and conditionally render UI.
 * @architecture Enterprise 2026 Standards
 * @module context/AuthContext
 */

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import api from '../utils/api';

export interface AuthUser {
    id: string | number;
    username: string;
    email: string;
    first_name?: string;
    last_name?: string;
    is_admin?: boolean;
    artist_profile_id?: string | number;
    voice_type_display?: string;
}

export interface LoginResponse {
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

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: ReactNode }): React.JSX.Element => {
    const [user, setUser] = useState<AuthUser | null>(null);
    const [isLoading, setIsLoading] = useState<boolean>(true);

    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    const response = await api.get('/api/artists/me/');
                    setUser(response.data as AuthUser);
                } catch (error) {
                    console.error('Session validation failed.', error);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                }
            }
            setIsLoading(false);
        };

        checkAuth();
    }, []);

    const login = async (username: string, password: string): Promise<LoginResponse> => {
        try {
            const response = await api.post('/api/token/', { username, password });
            
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);

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

    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        window.location.href = '/login';
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

export const useAuth = (): AuthContextType => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};