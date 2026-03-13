/**
 * ExportContractButton Component
 * Author: Krystian Bugalski
 * * A highly interactive UI component for triggering and polling asynchronous 
 * background tasks (Celery). It provides real-time visual feedback to the user 
 * during the PDF/ZIP generation process using Framer Motion animations.
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useExportProject } from '../../hooks/useExportProject';

// Animated SVG Spinner for the processing state
const SpinnerIcon = () => (
    <motion.svg 
        animate={{ rotate: 360 }} 
        transition={{ repeat: Infinity, duration: 1, ease: "linear" }} 
        className="w-5 h-5 text-white" 
        fill="none" 
        viewBox="0 0 24 24"
    >
        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
    </motion.svg>
);

export const ExportContractButton = ({ projectId, token }) => {
    // Custom hook managing the Celery polling logic and API calls
    const { startExport, status, downloadUrl, error, reset } = useExportProject(token);

    const handleExport = () => {
        startExport(projectId);
    };

    return (
        <div className="relative flex items-center justify-center min-h-[60px]">
            <AnimatePresence mode="wait">
                {status === 'idle' && (
                    <motion.button
                        key="idle"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        onClick={handleExport}
                        className="px-6 py-2 bg-slate-900 text-white font-medium rounded-lg hover:bg-slate-800 transition-colors shadow-lg"
                    >
                        Generuj paczkę ZIP z umowami
                    </motion.button>
                )}

                {status === 'processing' && (
                    <motion.div
                        key="processing"
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center space-x-3 px-6 py-2 bg-blue-600 text-white font-medium rounded-full shadow-lg"
                    >
                        <SpinnerIcon />
                        <span>Trwa generowanie w tle...</span>
                    </motion.div>
                )}

                {status === 'success' && (
                    <motion.div
                        key="success"
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center space-x-4"
                    >
                        <a
                            href={downloadUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-6 py-2 bg-green-600 text-white font-medium rounded-lg hover:bg-green-500 transition-colors shadow-lg"
                        >
                            Pobierz gotowy plik ZIP
                        </a>
                        <button 
                            onClick={reset} 
                            className="text-sm text-slate-500 hover:text-slate-700 underline"
                        >
                            Zamknij
                        </button>
                    </motion.div>
                )}

                {status === 'error' && (
                    <motion.div
                        key="error"
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        className="flex items-center space-x-3 text-red-600"
                    >
                        <span className="font-medium">{error}</span>
                        <button 
                            onClick={reset} 
                            className="px-4 py-1 border border-red-600 rounded hover:bg-red-50 transition-colors"
                        >
                            Spróbuj ponownie
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};