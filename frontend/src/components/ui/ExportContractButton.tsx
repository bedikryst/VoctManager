/**
 * @file ExportContractButton.tsx
 * @description Triggers and polls asynchronous background tasks (Celery).
 * Provides real-time visual feedback during PDF/ZIP generation process.
 * @module ui/ExportContractButton
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExportProject } from '../../hooks/useExportProject';
import { Loader2, Download, AlertCircle } from 'lucide-react';

interface ExportContractButtonProps {
    projectId: string | number;
}

export const ExportContractButton = ({ projectId }: ExportContractButtonProps): React.JSX.Element => {
    const { startExport, status, downloadUrl, error, reset } = useExportProject();

    const handleExport = () => {
        startExport(projectId);
    };

    return (
        <div className="relative flex items-center justify-center min-h-[40px]">
            <AnimatePresence mode="wait">
                {status === 'idle' && (
                    <motion.button
                        key="idle"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -5 }}
                        onClick={handleExport}
                        className="bg-stone-900 hover:bg-[#002395] text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-sm transition-colors shadow-sm"
                    >
                        Generuj paczkę ZIP
                    </motion.button>
                )}

                {status === 'processing' && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className="flex items-center space-x-2 px-5 py-2.5 bg-stone-100 border border-stone-200 text-[#002395] font-bold text-[10px] uppercase tracking-widest rounded-sm"
                    >
                        <Loader2 className="w-4 h-4 animate-spin" aria-hidden="true" />
                        <span>Przetwarzanie w tle...</span>
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, y: 5 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center space-x-4"
                    >
                        <a
                            href={downloadUrl || '#'}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] uppercase tracking-widest font-bold py-2.5 px-5 rounded-sm transition-colors shadow-sm"
                        >
                            <Download size={14} aria-hidden="true" /> Pobierz ZIP
                        </a>
                        <button 
                            onClick={reset} 
                            className="text-[10px] uppercase tracking-widest font-bold text-stone-400 hover:text-stone-800 transition-colors"
                        >
                            Zamknij
                        </button>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, x: -5 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center space-x-3"
                    >
                        <span className="flex items-center gap-1.5 text-[10px] uppercase tracking-widest font-bold text-red-600">
                            <AlertCircle size={14} aria-hidden="true" /> {error || 'Wystąpił błąd'}
                        </span>
                        <button 
                            onClick={reset} 
                            className="px-4 py-2 border border-red-200 text-red-600 rounded-sm text-[10px] uppercase tracking-widest font-bold hover:bg-red-50 transition-colors"
                        >
                            Spróbuj ponownie
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};