/**
 * @file BudgetTab.tsx
 * @description Financial estimation and fee assignment widget.
 * Features Unified Floating Action Bar (FAB) for state commits and instant rollbacks.
 * Delegates caching and dirty-state mutation to useBudgetTab hook.
 * @module panel/projects/ProjectEditorPanel/tabs/BudgetTab
 */

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Loader2, Banknote, Users, Wrench, Sparkles, Save, AlertCircle } from 'lucide-react';

import { useBudgetTab } from '../hooks/useBudgetTab';
import { GlassCard } from '../../../../shared/ui/GlassCard';
import { Button } from '../../../../shared/ui/Button';
import { Input } from '../../../../shared/ui/Input';

interface BudgetTabProps {
    projectId: string;
}

export default function BudgetTab({ projectId }: BudgetTabProps): React.JSX.Element | null {
    const {
        isLoading, isSaving, isDirty, enrichedCast, enrichedCrew,
        dirtyFees, kpi, handleFeeChange, handleReset, handleBulkSave
    } = useBudgetTab(projectId);

    if (isLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20 bg-white/40 rounded-[2rem] border border-stone-200/60">
                <Loader2 size={32} className="animate-spin text-[#002395] mb-4" aria-hidden="true" />
                <span className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500">Przeliczanie ksiąg...</span>
            </div>
        );
    }

    if (enrichedCast.length === 0 && enrichedCrew.length === 0) {
        return (
            <div className="text-center py-20 bg-white/40 rounded-[2rem] border border-dashed border-stone-300/60">
                <Banknote size={48} className="mx-auto mb-4 opacity-30 text-stone-400" aria-hidden="true" />
                <span className="text-[11px] font-bold antialiased uppercase tracking-widest text-stone-500 block mb-2">Brak personelu do wyceny</span>
                <span className="text-xs text-stone-400 max-w-sm mx-auto block leading-relaxed">Dodaj najpierw wykonawców w zakładkach "Obsada" lub "Ekipa Techniczna", aby móc przydzielać stawki.</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-24">
            {/* KPI DASHBOARD */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                <GlassCard variant="dark" className="p-6 relative overflow-hidden group">
                    <div className="absolute -top-16 -right-16 w-48 h-48 bg-[#002395] rounded-full blur-[60px] opacity-50 pointer-events-none transition-transform duration-1000 group-hover:scale-125"></div>
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-1.5 relative z-10 flex items-center gap-1.5"><Sparkles size={12} aria-hidden="true" /> Budżet Produkcji</p>
                    <p className="text-3xl font-black tracking-tight relative z-10">{kpi.grandTotal.toLocaleString('pl-PL')} PLN</p>
                </GlassCard>
                <GlassCard className="p-6 flex flex-col justify-center">
                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-[#002395]/70 mb-1.5 flex items-center gap-1.5"><Users size={12} aria-hidden="true" /> Koszty Artystyczne</p>
                    <p className="text-2xl font-black text-[#002395] tracking-tight">{kpi.castTotal.toLocaleString('pl-PL')} PLN</p>
                </GlassCard>
                <GlassCard className="p-6 flex flex-col justify-center relative overflow-hidden">
                    <p className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-1.5 flex items-center gap-1.5 ${kpi.missingCount > 0 ? 'text-orange-600' : 'text-stone-400'}`}>
                        {kpi.missingCount > 0 ? <AlertCircle size={12} aria-hidden="true" /> : <Wrench size={12} aria-hidden="true" />} Koszty Logistyczne
                    </p>
                    <div className="flex items-end justify-between">
                        <p className="text-2xl font-black text-stone-800 tracking-tight">{kpi.crewTotal.toLocaleString('pl-PL')} PLN</p>
                        {kpi.missingCount > 0 && <span className="text-[10px] font-bold text-orange-500 bg-orange-50 px-2 py-1 rounded-md border border-orange-100">Braki: {kpi.missingCount}</span>}
                    </div>
                </GlassCard>
            </div>

            {/* DOUBLE TABLES */}
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-8">
                
                {/* CAST TABLE */}
                <div className="bg-white/60 backdrop-blur-xl border border-stone-200/80 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
                    <div className="p-5 border-b border-stone-200/60 bg-stone-50/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-blue-50 text-[#002395] flex items-center justify-center border border-blue-100 shadow-sm"><Users size={14} aria-hidden="true" /></div>
                        <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Obsada Artystyczna</h3>
                    </div>
                    <div className="overflow-auto flex-1 max-h-[60vh] scrollbar-hide">
                        <table className="w-full text-left border-collapse min-w-[400px]">
                            <tbody className="divide-y divide-stone-100/80">
                                {enrichedCast.map(part => {
                                    const person = part.artistData!;
                                    const isCellDirty = dirtyFees[String(part.id)] !== undefined;
                                    const currentFeeValue = isCellDirty ? dirtyFees[String(part.id)].value : String(part.fee || '');
                                    
                                    return (
                                        <tr key={part.id} className={`transition-colors ${isCellDirty ? 'bg-orange-50/30' : 'hover:bg-white/50'}`}>
                                            <td className="p-4">
                                                <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                                                <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{person.voice_type_display || person.voice_type}</p>
                                            </td>
                                            <td className="p-4 text-right">
                                                <div className="flex items-center justify-end gap-2.5">
                                                    <Input 
                                                        type="number" min={0} step={50} placeholder="0" 
                                                        value={currentFeeValue || ''} 
                                                        onChange={(e) => handleFeeChange(String(part.id), e.target.value, 'cast')}
                                                        className={`w-28 !px-3 !py-2 text-right font-bold transition-all ${isCellDirty ? 'border-orange-300 text-orange-700 focus:ring-orange-500/20 focus:border-orange-400 bg-white' : ''}`} 
                                                    />
                                                    <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isCellDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

                {/* CREW TABLE */}
                <div className="bg-white/60 backdrop-blur-xl border border-stone-200/80 rounded-[2rem] overflow-hidden shadow-sm flex flex-col">
                    <div className="p-5 border-b border-stone-200/60 bg-stone-50/50 flex items-center gap-3">
                        <div className="w-8 h-8 rounded-xl bg-stone-100 text-stone-600 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14} aria-hidden="true" /></div>
                        <h3 className="text-[10px] font-bold antialiased uppercase tracking-widest text-stone-800">Ekipa i Logistyka</h3>
                    </div>
                    <div className="overflow-auto flex-1 max-h-[60vh] scrollbar-hide">
                        {enrichedCrew.length === 0 ? (
                            <div className="p-10 text-center text-stone-400 text-xs italic">Brak przypisanej ekipy technicznej.</div>
                        ) : (
                            <table className="w-full text-left border-collapse min-w-[400px]">
                                <tbody className="divide-y divide-stone-100/80">
                                    {enrichedCrew.map(assign => {
                                        const person = assign.crewData!;
                                        const isCellDirty = dirtyFees[String(assign.id)] !== undefined;
                                        const currentFeeValue = isCellDirty ? dirtyFees[String(assign.id)].value : String(assign.fee || '');
                                        
                                        return (
                                            <tr key={assign.id} className={`transition-colors ${isCellDirty ? 'bg-orange-50/30' : 'hover:bg-white/50'}`}>
                                                <td className="p-4">
                                                    <p className="font-bold text-stone-900 text-sm tracking-tight">{person.first_name} {person.last_name}</p>
                                                    <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mt-0.5">{assign.role_description || person.specialty}</p>
                                                </td>
                                                <td className="p-4 text-right">
                                                    <div className="flex items-center justify-end gap-2.5">
                                                        <Input 
                                                            type="number" min={0} step={50} placeholder="0" 
                                                            value={currentFeeValue || ''} 
                                                            onChange={(e) => handleFeeChange(String(assign.id), e.target.value, 'crew')}
                                                            className={`w-28 !px-3 !py-2 text-right font-bold transition-all ${isCellDirty ? 'border-orange-300 text-orange-700 focus:ring-orange-500/20 focus:border-orange-400 bg-white' : ''}`} 
                                                        />
                                                        <span className={`text-[10px] font-bold antialiased uppercase tracking-widest ${isCellDirty ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
                                                    </div>
                                                </td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>

            </div>

            {/* FLOATING ACTION BAR (FAB) */}
            <AnimatePresence>
                {isDirty && (
                    <motion.div 
                        initial={{ opacity: 0, y: 20, scale: 0.95 }} 
                        animate={{ opacity: 1, y: 0, scale: 1 }} 
                        exit={{ opacity: 0, y: 20, scale: 0.95 }}
                        className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 p-3 bg-white/90 backdrop-blur-xl border border-stone-200 shadow-[0_10px_40px_rgba(0,0,0,0.1)] rounded-2xl"
                    >
                        <div className="px-3 flex items-center gap-2 text-orange-600">
                            <AlertCircle size={16} aria-hidden="true" />
                            <span className="text-[10px] font-bold uppercase tracking-widest">Niezapisane zmiany</span>
                        </div>
                        <div className="w-px h-8 bg-stone-200/80"></div>
                        <Button 
                            variant="outline"
                            onClick={handleReset}
                            disabled={isSaving}
                            className="!border-transparent hover:!bg-stone-100 !text-stone-500 hover:!text-stone-800"
                        >
                            Odrzuć
                        </Button>
                        <Button 
                            variant="primary"
                            onClick={handleBulkSave}
                            disabled={isSaving}
                            isLoading={isSaving}
                            leftIcon={!isSaving ? <Save size={14} aria-hidden="true" /> : undefined}
                        >
                            Zapisz do bazy
                        </Button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}