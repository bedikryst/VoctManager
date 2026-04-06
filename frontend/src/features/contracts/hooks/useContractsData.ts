/**
 * @file useContractsData.ts
 * @description View Controller for the Contracts module.
 * Aggregates and calculates financial data across Projects, Cast, and Crew.
 * @architecture Enterprise SaaS 2026
 * @module panel/contracts/hooks
 */

import { useState, useMemo } from 'react';
import { useContractLedgers } from '../api/contracts.queries';

export const useContractsData = () => {
    // Server State
    const { projects, participations, crewAssignments, isLoading, isError } = useContractLedgers();

    // Client State
    const [selectedProjectId, setSelectedProjectId] = useState<string>('');

    // Derived State: Global Stats (All projects combined)
    const globalStats = useMemo(() => {
        const pricedCast = participations.filter(p => p.fee != null);
        const pricedCrew = crewAssignments.filter(c => c.fee != null);
        
        const totalBudget = [...pricedCast, ...pricedCrew].reduce((sum, item) => sum + parseFloat(String(item.fee)), 0);
        
        return {
            totalBudget,
            totalPriced: pricedCast.length + pricedCrew.length,
            totalContracts: participations.length + crewAssignments.length
        };
    }, [participations, crewAssignments]);

    // Derived State: Local Project Data
    const currentCast = useMemo(() => {
        return participations.filter(p => p.project === selectedProjectId);
    }, [participations, selectedProjectId]);

    const currentCrew = useMemo(() => {
        return crewAssignments.filter(c => c.project === selectedProjectId);
    }, [crewAssignments, selectedProjectId]);

    // Derived State: Project Stats
    const projectStats = useMemo(() => {
        const totalContracts = currentCast.length + currentCrew.length;
        const pricedCast = currentCast.filter(p => p.fee != null);
        const pricedCrew = currentCrew.filter(c => c.fee != null);
        
        const pricedContractsCount = pricedCast.length + pricedCrew.length;
        const missingContractsCount = totalContracts - pricedContractsCount;
        
        const totalBudget = [...pricedCast, ...pricedCrew].reduce((sum, item) => sum + parseFloat(String(item.fee)), 0);

        return {
            totalContracts,
            pricedContractsCount,
            missingContractsCount,
            totalBudget
        };
    }, [currentCast, currentCrew]);

    return {
        isLoading,
        isError,
        projects,
        selectedProjectId,
        setSelectedProjectId,
        currentCast,
        currentCrew,
        globalStats,
        projectStats
    };
};