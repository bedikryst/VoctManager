import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { AlertTriangle, X } from 'lucide-react';

interface ConfirmModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  onConfirm: () => void;
  onCancel: () => void;
  isLoading?: boolean;
}

export default function ConfirmModal({ 
  isOpen, title, description, onConfirm, onCancel, isLoading = false 
}: ConfirmModalProps) {
  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div 
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-stone-900/40 backdrop-blur-sm z-[100]"
            onClick={!isLoading ? onCancel : undefined}
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.95, y: 20 }} 
            animate={{ opacity: 1, scale: 1, y: 0 }} 
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-md bg-white rounded-2xl shadow-2xl z-[101] overflow-hidden border border-stone-200"
          >
            <div className="p-6">
              <div className="flex gap-4 items-start">
                <div className="p-3 bg-red-50 text-red-600 rounded-full flex-shrink-0">
                  <AlertTriangle size={24} />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-stone-900">{title}</h3>
                  <p className="text-sm text-stone-500 mt-2 leading-relaxed">{description}</p>
                </div>
              </div>
            </div>
            <div className="bg-stone-50 px-6 py-4 flex justify-end gap-3 border-t border-stone-100">
              <button 
                disabled={isLoading}
                onClick={onCancel}
                className="px-4 py-2 text-sm font-bold text-stone-600 hover:bg-stone-200 rounded-xl transition-colors disabled:opacity-50"
              >
                Anuluj
              </button>
              <button 
                disabled={isLoading}
                onClick={onConfirm}
                className="px-4 py-2 text-sm font-bold text-white bg-red-600 hover:bg-red-700 rounded-xl transition-colors shadow-sm disabled:opacity-50 flex items-center gap-2"
              >
                {isLoading ? 'Usuwanie...' : 'Tak, usuń bezpowrotnie'}
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}