/**
 * @file ManagerRoute.tsx
 * @description Route guard restricting privileged dashboard modules to managers.
 * @module app/router/ManagerRoute
 */

import React from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";

import { useAuth } from "@/app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";

export default function ManagerRoute(): React.JSX.Element {
  const { user, isLoading } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return <EtherealLoader />;
  }

  if (!isManager(user)) {
    return <Navigate to="/panel" state={{ from: location }} replace />;
  }

  return <Outlet />;
}
