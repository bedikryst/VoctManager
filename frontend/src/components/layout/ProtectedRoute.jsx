/**
 * Protected Route Wrapper
 * Author: Krystian Bugalski
 * * Zabezpiecza ścieżki w React Routerze. Jeśli użytkownik nie ma tokena (nie jest zalogowany),
 * automatycznie przekierowuje go na stronę /login, zapamiętując, gdzie chciał wejść.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import Preloader from '../ui/Preloader';

export default function ProtectedRoute() {
    const { isAuthenticated, isLoading } = useAuth();
    const location = useLocation();

    // 1. Aplikacja pyta Django kim jesteś. Wyświetlamy piękny preloader.
    if (isLoading) {
        return <Preloader />;
    }

    // 2. Django mówi: "Ten gość nie ma ważnego tokena!". 
    // Wyrzucamy go na logowanie, ale zapisujemy w 'state', że chciał wejść do panelu.
    if (!isAuthenticated) {
        return <Navigate to="/login" state={{ from: location }} replace />;
    }

    // 3. Wszystko OK, wpuszczamy użytkownika do ukrytych ścieżek!
    // <Outlet /> to miejsce, w którym wyrenderują się "dzieci" tego komponentu (np. /panel).
    return <Outlet />;
}