/**
 * @file DashboardHome.tsx
 * @description Dashboard View Router.
 * @architecture Enterprise 2026
 * Delegates rendering to specialized Role-Based Dashboards to optimize 
 * bundle size, separate concerns, and strictly isolate API queries.
 * @module core/DashboardHome
 */

import React from 'react';
import { useAuth } from '../../../context/AuthContext';
import { Loader2 } from 'lucide-react';

import AdminDashboard from './AdminDashboard';
import ArtistDashboard from './ArtistDashboard';

export default function DashboardHome(): React.JSX.Element {
    const { user, isLoading } = useAuth();

    if (isLoading) {
        return (
            <div className="flex h-[60vh] flex-col items-center justify-center space-y-5">
                <div className="relative flex items-center justify-center">
                    <div className="absolute w-16 h-16 border-4 border-[#002395]/20 rounded-full"></div>
                    <div className="w-16 h-16 border-4 border-[#002395] rounded-full border-t-transparent animate-spin"></div>
                </div>
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Autoryzacja...</span>
            </div>
        );
    }

    // Role-based routing
    if (user?.is_admin) {
        return <AdminDashboard />;
    }

    return <ArtistDashboard />;
}