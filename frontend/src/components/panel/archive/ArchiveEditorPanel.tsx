/**
 * @file ArchiveEditorPanel.tsx
 * @description Slide-over panel for editing repertoire metadata and managing audio tracks.
 * @architecture
 * Fully encapsulates complex UI states (tabs, slide animations) keeping the parent clean.
 * Implements Dirty State interception to prevent accidental data loss.
 * @module archive/ArchiveEditorPanel
 * @author Krystian Bugalski
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Headphones } from 'lucide-react';

import PieceDetailsForm from './PieceDetailsForm';
import TrackUploadManager from './TrackUploadManager';
import ConfirmModal from '../../../components/ui/ConfirmModal'; // Nasz bezpieczny modal

import type { Piece, Composer, VoiceLineOption } from '../../../types';

interface ArchiveEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  piece: Piece | null;
  activeTab: 'DETAILS' | 'TRACKS';
  onTabChange: (tabId: 'DETAILS' | 'TRACKS') => void;
  composers: Composer[];
  voiceLines: VoiceLineOption[];
  refreshGlobal: () => Promise<void>;
}

export default function ArchiveEditorPanel({ 
  isOpen, onClose, piece, activeTab, onTabChange, composers, voiceLines, refreshGlobal 
}: ArchiveEditorPanelProps): React.JSX.Element {
  
  // Stan śledzący niezapisane zmiany w formularzu
  const [isFormDirty, setIsFormDirty] = useState<boolean>(false);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  // Funkcja przechwytująca próbę zamknięcia panelu
  const handleCloseRequest = () => {
    if (isFormDirty) {
      setShowExitConfirm(true); // Blokuje wyjście i pokazuje ostrzeżenie
    } else {
      onClose(); // Bezpieczne wyjście
    }
  };

  // Funkcja wymuszająca zamknięcie panelu (gdy użytkownik potwierdzi utratę zmian)
  const forceClose = () => {
    setShowExitConfirm(false);
    setIsFormDirty(false);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Tło - Kliknięcie w tło też jest przechwytywane! */}
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} 
            onClick={handleCloseRequest} 
            className="fixed inset-0 bg-stone-900/20 backdrop-blur-sm z-40" 
            aria-hidden="true"
          />
          
          <motion.div 
            initial={{ x: '100%' }} animate={{ x: 0 }} exit={{ x: '100%' }} 
            transition={{ type: 'spring', damping: 25, stiffness: 200 }} 
            className="fixed inset-y-0 right-0 w-full max-w-3xl bg-[#f4f2ee] shadow-2xl z-50 flex flex-col border-l border-white/60"
            role="dialog"
            aria-modal="true"
          >
            {/* Panel Header */}
            <div className="flex justify-between items-center px-6 md:px-10 pt-6 md:pt-10 pb-6 flex-shrink-0 z-20 bg-white/80 backdrop-blur-xl border-b border-stone-200/50">
              <h3 className="font-serif text-3xl md:text-4xl font-bold text-stone-900 tracking-tight">
                {piece ? 'Edycja Utworu' : 'Nowy Utwór'}
              </h3>
              <button 
                onClick={handleCloseRequest} 
                className="text-stone-400 hover:text-stone-900 bg-white hover:bg-stone-100 border border-stone-200/60 shadow-sm transition-all p-3 rounded-2xl active:scale-95"
                aria-label="Zamknij panel"
              >
                <X size={20} aria-hidden="true" />
              </button>
            </div>

            {/* Navigation Tabs */}
            {piece && (
              <div className="flex-shrink-0 relative z-30 px-6 md:px-10 pb-6 bg-white/80 backdrop-blur-xl border-b border-stone-200/50">
                  <div className="inline-flex items-center p-1.5 bg-stone-200/40 backdrop-blur-xl border border-stone-200/60 rounded-2xl shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] overflow-x-auto scrollbar-hide max-w-full">
                      <button 
                          onClick={() => onTabChange('DETAILS')} 
                          className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'DETAILS' ? 'bg-white text-[#002395] shadow-sm border border-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
                      >
                          <FileText size={14} aria-hidden="true" /> Dane i Nuty
                      </button>
                      <button 
                          onClick={() => onTabChange('TRACKS')} 
                          className={`px-5 py-2.5 text-[9px] font-bold antialiased uppercase tracking-widest rounded-xl transition-all whitespace-nowrap flex items-center gap-2 ${activeTab === 'TRACKS' ? 'bg-white text-[#002395] shadow-sm border border-white' : 'text-stone-500 hover:text-stone-800 hover:bg-white/40 border border-transparent'}`}
                      >
                          <Headphones size={14} aria-hidden="true" /> Ścieżki Audio
                      </button>
                  </div>
              </div>
            )}

            {/* Content Injection Area */}
            <div className="flex-1 overflow-y-auto relative scroll-smooth">
              <div className="p-4 md:p-10">
                {activeTab === 'DETAILS' && (
                  <PieceDetailsForm 
                    key={piece ? piece.id : 'new-piece'} 
                    piece={piece} 
                    composers={composers} 
                    voiceLines={voiceLines} 
                    refreshGlobal={refreshGlobal}
                    onDirtyStateChange={setIsFormDirty} // Przekazujemy funkcję nasłuchującą
                    onSuccess={(updatedPiece: Piece, actionType: 'SAVE_AND_ADD' | 'SAVE_AND_CLOSE') => { 
                        refreshGlobal(); 
                        setIsFormDirty(false); // Reset po sukcesie zapisu
                        if (actionType === 'SAVE_AND_CLOSE') onClose(); 
                    }} 
                  />
                )}
                {activeTab === 'TRACKS' && piece && (
                  <TrackUploadManager 
                    pieceId={piece.id} 
                    fetchGlobal={refreshGlobal} 
                    voiceLines={voiceLines} 
                  />
                )}
              </div>
            </div>

            {/* Modal bezpieczeństwa: Niezapisane zmiany */}
            <ConfirmModal 
              isOpen={showExitConfirm}
              title="Masz niezapisane zmiany!"
              description="Wprowadziłeś zmiany w formularzu, które nie zostały jeszcze zapisane w bazie. Czy na pewno chcesz zamknąć panel? Niezapisane dane przepadną."
              onConfirm={forceClose}
              onCancel={() => setShowExitConfirm(false)}
            />

          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}