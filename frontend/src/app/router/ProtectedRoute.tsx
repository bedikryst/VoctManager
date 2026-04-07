/**
 * @file ProtectedRoute.tsx
 * @description Higher-Order Component for securing private routes.
 * Intercepts unauthorized access attempts and redirects to the authentication gateway,
 * preserving the intended destination via navigation state.
 * @architecture Enterprise 2026 Standards
 * @author Krystian Bugalski
 */

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "../providers/AuthProvider";
import Preloader from "../../shared/ui/Preloader";

export default function ProtectedRoute(): React.JSX.Element {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Intercept render tree while authenticating session token via backend
  if (isLoading) {
    return <Preloader />;
  }

  // Redirect unauthorized traffic to login, persisting target path for post-login redirection
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Authentication confirmed, render the requested secure view
  return <Outlet />;
}
