/**
 * @file DashboardLayout.tsx
 * @description Main authenticated shell for the dashboard experience.
 * Orchestrates the Smart Sidebar, Mobile Nav, and Main Content area.
 * @architecture Enterprise SaaS 2026
 */

import React, { useEffect } from "react";
import { Outlet } from "react-router-dom";

import { useAuth } from "../../../app/providers/AuthProvider";
import { DesktopSidebar } from "./components/DesktopSidebar";
import { MobileNavigation } from "./components/MobileNavigation";

export default function DashboardLayout(): React.JSX.Element {
  const { user, logout } = useAuth();

  // Global styling for the app zone
  useEffect(() => {
    document.body.classList.add("admin-mode");
    document.body.style.backgroundColor = "#f4f2ee";

    return () => {
      document.body.classList.remove("admin-mode");
      document.body.style.backgroundColor = "";
    };
  }, []);

  return (
    <div className="relative flex min-h-screen bg-[#f4f2ee] font-sans">
      {/* Background Decorators */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden z-0">
        <div className="absolute left-[-12rem] top-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(15,75,216,0.10),rgba(15,75,216,0))]" />
        <div className="absolute bottom-[-18rem] right-[-10rem] h-[32rem] w-[32rem] rounded-full bg-[radial-gradient(circle_at_center,rgba(217,119,6,0.10),rgba(217,119,6,0))]" />
      </div>

      {/* Enterprise Modular Navigation Components */}
      <DesktopSidebar user={user} logout={logout} />
      <MobileNavigation user={user} logout={logout} />

      {/* Main Content Area - Zwróć uwagę na md:pl-[120px]! */}
      <main className="relative z-10 min-w-0 flex-1 px-4 pb-12 pt-24 transition-all sm:px-6 md:pl-[120px] md:pr-8 md:pt-8 lg:pr-12">
        <div className="mx-auto h-full w-full max-w-7xl">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
