/**
 * @file DashboardFilterMenu.tsx
 * @description Navigation pill menu for filtering projects by status.
 * Extracted to prevent UI bloat in the main dashboard controller.
 * @module panel/projects/components/DashboardFilterMenu
 */

import React from 'react';

export type FilterStatus = 'ACTIVE' | 'DONE' | 'ALL';

interface FilterOption {
    id: FilterStatus;
    label: string;
}

const FILTER_OPTIONS: FilterOption[] = [
    { id: 'ACTIVE', label: 'W przygotowaniu' }, 
    { id: 'DONE', label: 'Archiwum' }, 
    { id: 'ALL', label: 'Wszystkie' }
];

interface DashboardFilterMenuProps {
    currentFilter: FilterStatus;
    onFilterChange: (filter: FilterStatus) => void;
}

export const DashboardFilterMenu: React.FC<DashboardFilterMenuProps> = ({ 
    currentFilter, 
    onFilterChange 
}) => {
    return (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6">
            <div 
                className="inline-flex items-center p-1.5 bg-white/60 backdrop-blur-xl border border-white/60 shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-xl overflow-x-auto max-w-full scrollbar-hide"
                role="tablist"
                aria-label="Project status filters"
            >
                {FILTER_OPTIONS.map((filter) => {
                    const isActive = currentFilter === filter.id;
                    return (
                        <button 
                            key={filter.id} 
                            role="tab"
                            aria-selected={isActive}
                            onClick={() => onFilterChange(filter.id)} 
                            className={`px-5 py-2 text-[9px] font-bold antialiased uppercase tracking-widest rounded-lg transition-all whitespace-nowrap ${
                                isActive 
                                    ? 'bg-white text-[#002395] shadow-sm border border-stone-100' 
                                    : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'
                            }`}
                        >
                            {filter.label}
                        </button>
                    );
                })}
            </div>
        </div>
    );
};