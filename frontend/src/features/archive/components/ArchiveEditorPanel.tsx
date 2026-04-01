/**
 * @file ArchiveEditorPanel.tsx
 * @description Slide-over panel for editing repertoire metadata and managing audio tracks.
 * Integrates dirty-state interception to prevent accidental data loss during active editing.
 * @module panel/archive/components/ArchiveEditorPanel
 */

import React, { useState, useEffect, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Headphones } from 'lucide-react';

import PieceDetailsForm from './PieceDetailsForm';
import TrackUploadManager from './TrackUploadManager';
import ConfirmModal from '../../../shared/ui/ConfirmModal';

import type { Piece, Composer, VoiceLineOption } from '../../../shared/types';
import { ArchiveTabId } from '../constants/archiveDomain';

interface ArchiveEditorPanelProps {
    isOpen: boolean;
    onClose: () => void;
    piece: Piece | null;
    activeTab: ArchiveTabId;
    onTabChange: (tabId: ArchiveTabId) => void;
    composers: Composer[];
    voiceLines: VoiceLineOption[];
    initialSearchContext?: string;
}

export default function ArchiveEditorPanel({ 
    isOpen, onClose, piece, activeTab, onTabChange, composers, voiceLines, initialSearchContext 
}: ArchiveEditorPanelProps): React.ReactPortal | null {
    
    const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
    const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);
    const [mounted, setMounted] = useState<boolean>(false);

    useEffect(() => { setMounted(true); }, []);

    const handleAttemptClose = useCallback(() => {
        if (isFormDirty) setShowExitConfirm(true);
        else onClose();
    }, [isFormDirty, onClose]);

    const forceClose = useCallback(() => {
        setIsFormDirty(false);
        setShowExitConfirm(false);
        onClose();
    }, [onClose]);

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape' && isOpen) {
                if (showExitConfirm) setShowExitConfirm(false);
                else handleAttemptClose();
            }
        };
        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
    }, [isOpen, showExitConfirm, handleAttemptClose]);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            {isOpen && (
                <React.Fragment key="archive-panel-wrapper">
                    <motion.div 
                        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
                        onClick={handleAttemptClose} 
                        className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-[90]" 
                        aria-hidden="true"
                    />
                    
                    <motion.div 
                        initial={{ right: '-100%' }} animate={{ right: 0 }} exit={{ right: '-100%' }} 
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
                        className="fixed inset-y-0 right-0 w-full md:w-[600px] lg:w-[800px] xl:w-[900px] bg-[#f4f2ee] shadow-2xl z-[100] flex flex-col border-l border-white/60"
                        role="dialog" aria-modal="true"
                    >
                        <div className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-10 pb-6 flex-shrink-0 z-20">
                            <h3 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
                                {piece ? piece.title : 'Nowy Utwór'}
                            </h3>
                            <button 
                                onClick={handleAttemptClose} 
                                className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95"
                            >
                                <X size={20} aria-hidden="true" />
                            </button>
                        </div>

                        {piece && (
                            <div className="px-6 md:px-10 pb-6 flex-shrink-0 relative z-30">
                                <div className="inline-flex items-center p-1.5 bg-stone-200/40 backdrop-blur-xl border border-stone-200/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]">
                                    <button onClick={() => onTabChange('DETAILS')} className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'DETAILS' ? 'bg-white text-[#002395] shadow-sm border border-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}>
                                        <FileText size={14} aria-hidden="true" /> Metadane
                                    </button>
                                    <button onClick={() => onTabChange('TRACKS')} className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TRACKS' ? 'bg-white text-[#002395] shadow-sm border border-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}>
                                        <Headphones size={14} aria-hidden="true" /> Ścieżki MP3
                                    </button>
                                </div>
                            </div>
                        )}

                        <div className="flex-1 overflow-y-auto p-4 md:px-10 md:pb-10 relative">
                            <div className="max-w-4xl mx-auto">
                                {activeTab === 'DETAILS' && (
                                    <PieceDetailsForm 
                                        piece={piece} 
                                        composers={composers} 
                                        voiceLines={voiceLines} 
                                        initialSearchContext={initialSearchContext}
                                        onDirtyStateChange={setIsFormDirty}
                                        onSuccess={(_updatedPiece: Piece, actionType: 'SAVE_AND_ADD' | 'SAVE_AND_CLOSE') => { 
                                            setIsFormDirty(false); 
                                            if (actionType === 'SAVE_AND_CLOSE') onClose(); 
                                        }} 
                                    />
                                )}
                                {activeTab === 'TRACKS' && piece && (
                                    <TrackUploadManager 
                                        pieceId={piece.id} 
                                        voiceLines={voiceLines} 
                                    />
                                )}
                            </div>
                        </div>

                        <ConfirmModal 
                            isOpen={showExitConfirm}
                            title="Masz niezapisane zmiany!"
                            description="Wprowadziłeś zmiany w formularzu, które nie zostały jeszcze zapisane w bazie. Czy na pewno chcesz zamknąć panel? Niezapisane dane przepadną."
                            onConfirm={forceClose}
                            onCancel={() => setShowExitConfirm(false)}
                        />
                    </motion.div>
                </React.Fragment>
            )}
        </AnimatePresence>,
        document.body
    );
}