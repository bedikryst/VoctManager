// frontend/src/utils/api.js
import axios from 'axios';

// 1. Tworzymy główną instancję. Definiujemy bazowy URL tylko raz!
const api = axios.create({
    baseURL: import.meta.env.VITE_API_URL || '',
    headers: {
        'Content-Type': 'application/json',
    },
});

// 2. REQUEST INTERCEPTOR (Przechwytywacz Zapytań)
// Ten kod uruchomi się AUTOMATYCZNIE przed każdym api.get(), api.post() itd.
api.interceptors.request.use(
    (config) => {
        // Pobieramy token z localStorage (lub z cookies, jeśli kiedyś zmienisz mechanizm)
        const token = localStorage.getItem('access_token');
        
        // Jeśli token istnieje, doklejamy go do nagłówka
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// 3. RESPONSE INTERCEPTOR (Przechwytywacz Odpowiedzi) - Opcjonalnie, ale bardzo Enterprise!
// Ten kod wyłapuje błędy z backendu ZANIM dotrą do Twojego komponentu.
api.interceptors.response.use(
    (response) => response,
    (error) => {
        // Jeśli backend zwróci 401 (Brak autoryzacji / Token wygasł)
        if (error.response && error.response.status === 401) {
            console.warn('Sesja wygasła. Wylogowywanie...');
            localStorage.removeItem('access_token');
            // Brutalne, ale skuteczne przekierowanie na login (można to zrobić łagodniej przez React Router)
            window.location.href = '/login'; 
        }
        return Promise.reject(error);
    }
);

export default api;