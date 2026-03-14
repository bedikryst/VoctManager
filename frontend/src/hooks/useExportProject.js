/**
 * @file useExportProject.js
 * @description Custom React Hook for managing asynchronous ZIP export tasks.
 * Implements polling logic to check Celery task status, automatically handling 
 * timeouts, state transitions, and memory cleanup.
 * @author Krystian Bugalski
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import api from '../utils/api';

export const useExportProject = () => { 
    const [status, setStatus] = useState('idle'); 
    const [downloadUrl, setDownloadUrl] = useState(null);
    const [error, setError] = useState(null);
    const timeoutRef = useRef(null);

    // Cleanup timeout on component unmount to prevent memory leaks
    useEffect(() => {
        return () => {
            if (timeoutRef.current) clearTimeout(timeoutRef.current);
        };
    }, []);

    const checkStatus = useCallback(async (taskId) => {
        try {
            // JWT token is automatically injected by the Axios interceptor
            const response = await api.get(`/api/participations/check_zip_status/?task_id=${taskId}`);
            const data = response.data;

            if (data.state === 'SUCCESS') {
                setStatus('success');
                const fullUrl = data.download_url.startsWith('http') 
                    ? data.download_url 
                    : `${api.defaults.baseURL}${data.download_url}`;
                setDownloadUrl(fullUrl);
            } else if (data.state === 'FAILURE' || data.state === 'FAILED') {
                setStatus('error');
                setError(data.error || 'Wystąpił błąd na serwerze podczas generowania paczki.');
            } else {
                // Task is still processing, poll again in 2 seconds
                timeoutRef.current = setTimeout(() => checkStatus(taskId), 2000);
            }
        } catch (err) {
            setStatus('error');
            setError('Błąd połączenia z serwerem. Spróbuj ponownie.');
        }
    }, []);

    const startExport = async (projectId) => {
        setStatus('processing');
        setError(null);
        setDownloadUrl(null);

        try {
            const response = await api.post('/api/participations/request_project_zip/', { 
                project_id: projectId 
            });

            if (response.data.task_id) {
                // Start polling 1.5 seconds after the initial request
                timeoutRef.current = setTimeout(() => checkStatus(response.data.task_id), 1500);
            }
        } catch (err) {
            setStatus('error');
            setError(err.response?.data?.error || 'Nie udało się rozpocząć zadania.');
        }
    };

    const reset = () => {
        setStatus('idle');
        setDownloadUrl(null);
        setError(null);
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };

    return { startExport, status, downloadUrl, error, reset };
};