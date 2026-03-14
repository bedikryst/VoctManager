/**
 * Authentication Context Provider
 * Author: Krystian Bugalski
 * * Manages the global authentication state, JWT token storage, and user profile data.
 * Exposes a custom hook (useAuth) to easily protect routes and conditionally render UI
 * based on the user's role (Admin vs. Regular Artist).
 */

import React, { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

// 1. Utworzenie pustego kontekstu
const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    // Stan przechowujący dane artysty (np. { first_name: "Jan", is_admin: false, voice_type: "TEN" })
    const [user, setUser] = useState(null);
    
    // Stan ładowania (aby nie wyrzucić usera na stronę logowania, zanim sprawdzimy jego token)
    const [isLoading, setIsLoading] = useState(true);

    // --- SPRAWDZANIE SESJI (Przy każdym odświeżeniu strony) ---
    useEffect(() => {
        const checkAuth = async () => {
            const token = localStorage.getItem('access_token');
            if (token) {
                try {
                    // Axios sam doklei token (dzięki api.js), więc od razu pytamy o profil
                    const response = await api.get('/api/artists/me/');
                    setUser(response.data);
                } catch (error) {
                    console.error('Sesja wygasła lub błąd weryfikacji.', error);
                    localStorage.removeItem('access_token');
                    localStorage.removeItem('refresh_token');
                }
            }
            setIsLoading(false); // Kończymy ładowanie niezależnie od wyniku
        };

        checkAuth();
    }, []);

    // --- FUNKCJA LOGOWANIA ---
    const login = async (username, password) => {
        try {
            // 1. Uderzamy do endpointu SimpleJWT po tokeny
            const response = await api.post('/api/token/', { username, password });
            
            // 2. Zapisujemy tokeny do pamięci przeglądarki
            localStorage.setItem('access_token', response.data.access);
            localStorage.setItem('refresh_token', response.data.refresh);

            // 3. Natychmiast pobieramy profil zalogowanego użytkownika
            const userResponse = await api.get('/api/artists/me/');
            setUser(userResponse.data);
            
            return { success: true };
        } catch (error) {
            // Wyłapywanie błędów z Django (np. błędne hasło)
            return { 
                success: false, 
                error: error.response?.data?.detail || 'Błąd logowania. Sprawdź dane wejściowe.' 
            };
        }
    };

    // --- FUNKCJA WYLOGOWANIA ---
    const logout = () => {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        setUser(null);
        window.location.href = '/login'; // Twarde przekierowanie, aby wyczyścić stan aplikacji
    };

    // --- DOSTARCZANIE DANYCH DO APLIKACJI ---
    const value = {
        user,
        isAuthenticated: !!user, // Zamienia obiekt usera na true/false
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

// 2. Custom Hook (Żeby nie pisać wszędzie useContext(AuthContext))
export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error("useAuth must be used within an AuthProvider");
    }
    return context;
};