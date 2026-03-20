/**
 * @file useProjectData.ts
 * @description Centralny punkt dostępu do danych serwerowych dla widoków projektu.
 * Wykorzystuje React Query do współdzielenia cache'u między wieloma zakładkami/widgetami.
 * Eliminuje problem "God Fetch" z globalnego Contextu.
 */

import { useQueries, QueryClient } from '@tanstack/react-query';
import api from '../utils/api';

// Zaimportuj swoje typy (dostosuj ścieżkę do struktury projektu)
import type { 
    Participation, Rehearsal, CrewAssignment, 
    PieceCasting, Artist, Collaborator, Piece 
} from '../types';

export function useProjectData(projectId: string | undefined) {
    const results = useQueries({
        queries: [
            // --- DANE SPECYFICZNE DLA PROJEKTU (Cache: 5 minut) ---
            { 
                queryKey: ['participations', projectId], 
                queryFn: async () => (await api.get(`/api/participations/?project=${projectId}`)).data as Participation[],
                staleTime: 1000 * 60 * 5,
                enabled: !!projectId
            },
            { 
                queryKey: ['rehearsals', projectId], 
                queryFn: async () => (await api.get(`/api/rehearsals/?project=${projectId}`)).data as Rehearsal[],
                staleTime: 1000 * 60 * 5,
                enabled: !!projectId
            },
            { 
                queryKey: ['crewAssignments', projectId], 
                queryFn: async () => (await api.get(`/api/crew-assignments/?project=${projectId}`)).data as CrewAssignment[],
                staleTime: 1000 * 60 * 5,
                enabled: !!projectId
            },
            { 
                queryKey: ['pieceCastings', projectId], 
                queryFn: async () => (await api.get(`/api/piece-castings/?project=${projectId}`)).data as PieceCasting[],
                staleTime: 1000 * 60 * 5,
                enabled: !!projectId
            },
            
            // --- GLOBALNE SŁOWNIKI (Cache: Nieskończony na sesję) ---
            { 
                queryKey: ['artists'], 
                queryFn: async () => {
                    const res = await api.get('/api/artists/');
                    return res.data.results || res.data; // <--- FIX PAGINACJI
                },
                staleTime: Infinity 
            },
            { 
                queryKey: ['crew'], 
                queryFn: async () => {
                    const res = await api.get('/api/collaborators/'); // Upewnij się, że to dobry endpoint!
                    return res.data.results || res.data; // <--- FIX PAGINACJI
                },
                staleTime: Infinity 
            },
            { 
                queryKey: ['pieces'], 
                queryFn: async () => (await api.get('/api/pieces/')).data as Piece[],
                staleTime: Infinity 
            }
        ]
    });

    const isLoading = results.some(r => r.isLoading);
    const isError = results.some(r => r.isError);

    return {
        participations: Array.isArray(results[0].data) ? results[0].data : [],
        rehearsals: Array.isArray(results[1].data) ? results[1].data : [],
        crewAssignments: Array.isArray(results[2].data) ? results[2].data : [],
        pieceCastings: Array.isArray(results[3].data) ? results[3].data : [],
        artists: Array.isArray(results[4].data) ? results[4].data : [],
        crew: Array.isArray(results[5].data) ? results[5].data : [],
        pieces: Array.isArray(results[6].data) ? results[6].data : [],
        isLoading,
        isError
    };
}

export const prefetchProjectData = (queryClient: QueryClient, projectId: string) => {
    // Odpalamy zapytania w tle. Jeśli już są w cache, React Query je zignoruje.
    queryClient.prefetchQuery({
        queryKey: ['participations', projectId],
        queryFn: async () => (await api.get(`/api/participations/?project=${projectId}`)).data,
        staleTime: 1000 * 60 * 5
    });
    
    queryClient.prefetchQuery({
        queryKey: ['rehearsals', projectId],
        queryFn: async () => (await api.get(`/api/rehearsals/?project=${projectId}`)).data,
        staleTime: 1000 * 60 * 5
    });
    
    queryClient.prefetchQuery({
        queryKey: ['crewAssignments', projectId],
        queryFn: async () => (await api.get(`/api/crew-assignments/?project=${projectId}`)).data,
        staleTime: 1000 * 60 * 5
    });
    
    // Słowniki (jeśli nie zostały pobrane wcześniej przez inną część aplikacji)
    queryClient.prefetchQuery({ queryKey: ['artists'], queryFn: async () => (await api.get('/api/artists/')).data, staleTime: Infinity });
    queryClient.prefetchQuery({ queryKey: ['pieces'], queryFn: async () => (await api.get('/api/pieces/')).data, staleTime: Infinity });
};