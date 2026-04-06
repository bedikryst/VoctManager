/**
 * @file Contracts.tsx
 * @description Master view for the HR & Payroll Module.
 * Integrates contextual state hooks, localized components, and the core UI kit.
 * @module features/contracts/Contracts
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import { 
    Calculator, Wallet, FileSignature, 
    Users, Wrench, Sparkles, Receipt, Loader2, ChevronDown 
} from 'lucide-react';

import { downloadFile } from '../../shared/lib/downloadFile';
import { useContractsData } from './hooks/useContractsData';
import { useBulkUpdateFee } from './api/contracts.queries'; 

import { GlassCard } from '../../shared/ui/GlassCard';
import { Input } from '../../shared/ui/Input';
import { Button } from '../../shared/ui/Button';
import { ExportContractButton } from '../../shared/ui/ExportContractButton';
import { ContractRow } from './components/ContractRow';

export default function Contracts(): React.JSX.Element {
    const { 
        isLoading, projects, selectedProjectId, setSelectedProjectId, 
        currentCast, currentCrew, globalStats, projectStats 
    } = useContractsData();

    const [globalFee, setGlobalFee] = useState<string>('');
    const bulkUpdateMutation = useBulkUpdateFee();
    
    const handleApplyGlobalFee = async (): Promise<void> => {
        if (!globalFee) return;
        const toastId = toast.loading('Applying bulk fee overrides...');
        
        try {
            const res = await bulkUpdateMutation.mutateAsync({ 
                projectId: selectedProjectId,
                fee: parseFloat(globalFee) 
            });
            toast.success(`Successfully updated fees for ${res.updated_count} members.`, { id: toastId });
            setGlobalFee(''); 
        } catch (e) { 
            toast.error('Server error during bulk operation.', { id: toastId });
        }
    };

    const handleDownloadSingle = async (recordId: string | number, personName: string, type: 'CAST' | 'CREW'): Promise<void> => {
        const toastId = toast.loading(`Generating PDF for ${personName}...`);
        try {
            const endpoint = type === 'CAST' ? `/api/participations/${recordId}/contract/` : `/api/crew-assignments/${recordId}/contract/`;
            await downloadFile(endpoint, `Contract_${personName.replace(/ /g, '_')}.pdf`);
            toast.success(`Document generated successfully.`, { id: toastId });
        } catch (err: any) { 
            toast.error(`Generation error: ${err.message}`, { id: toastId }); 
        }
    };

    if (isLoading && projects.length === 0) {
        return (
            <div className="flex flex-col items-center justify-center py-20 space-y-4">
                <Loader2 size={32} className="animate-spin text-[#002395]/40" />
                <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Loading Ledgers...</span>
            </div>
        );
    }

    return (
        <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto cursor-default px-4 sm:px-6 lg:px-8">
            
            <header className="relative pt-8 mb-8">
                <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
                    <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                        <Wallet size={12} className="text-[#002395]" aria-hidden="true" />
                        <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Financial Management</p>
                    </div>
                    <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                        HR & <span className="italic text-[#002395] font-bold">Payroll</span>.
                    </h1>
                    <p className="text-stone-500 mt-3 font-medium tracking-wide text-sm max-w-xl">
                        Manage artist and crew remuneration, control production budgets, and generate PDF contracts.
                    </p>
                </motion.div>
            </header>

            <GlassCard variant="dark" className="flex flex-col md:flex-row md:items-center gap-6">
                <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity duration-1000"></div>
                <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
                
                <div className="relative z-10 w-full flex flex-col sm:flex-row gap-5 items-center">
                    <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-300">
                        <Receipt size={24} aria-hidden="true" />
                    </div>
                    <div className="flex-1 w-full">
                        <label className="block text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400 mb-2 ml-1">
                            Select Event (Billing Context)
                        </label>
                        <div className="relative">
                            <select 
                                value={selectedProjectId} 
                                onChange={e => setSelectedProjectId(e.target.value)} 
                                className="w-full px-5 py-4 text-sm text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all font-bold appearance-none cursor-pointer hover:bg-white/10"
                            >
                                <option value="" className="text-stone-900">— No Event Selected —</option>
                                {projects.filter(p => p.status !== 'CANC').map(p => (
                                    <option key={p.id} value={p.id} className="text-stone-900">{p.title} {p.status === 'DONE' ? '(Archived)' : ''}</option>
                                ))}
                            </select>
                            <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-stone-400">
                                <ChevronDown size={18} />
                            </div>
                        </div>
                    </div>
                </div>
            </GlassCard>

            {!selectedProjectId && (
                <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
                    <GlassCard variant="premium" className="lg:col-span-2 flex flex-col justify-center items-start">
                        <div className="absolute -right-12 -top-12 text-stone-200 opacity-20 pointer-events-none">
                            <Receipt size={250} strokeWidth={1} aria-hidden="true" />
                        </div>
                        <Wallet size={40} className="text-[#002395] mb-5 relative z-10" aria-hidden="true" />
                        <h2 className="text-2xl font-bold text-stone-800 tracking-tight mb-2 relative z-10" style={{ fontFamily: "'Cormorant', serif" }}>Ready for Settlement</h2>
                        <p className="text-sm text-stone-500 max-w-md leading-relaxed relative z-10">Select an event from the context switcher above to manage rates and control the production budget.</p>
                    </GlassCard>

                    <GlassCard variant="premium" className="flex flex-col justify-between bg-gradient-to-b from-stone-50/50 to-white/30">
                        <div>
                            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">Global System Budget</p>
                            <p className="text-3xl font-black text-stone-800 tracking-tight">{globalStats.totalBudget.toLocaleString('en-US')} PLN</p>
                        </div>
                        <div className="pt-6 border-t border-stone-200/60 mt-6">
                            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">Contracts Issued</p>
                            <p className="text-xl font-bold text-stone-700">{globalStats.totalPriced} <span className="text-sm font-medium text-stone-400">/ {globalStats.totalContracts} valued</span></p>
                        </div>
                    </GlassCard>
                </motion.div>
            )}

            {selectedProjectId && projectStats.totalContracts > 0 && (
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 relative z-10">
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                        <GlassCard variant="premium" className="flex flex-col justify-center items-center hover:-translate-y-0.5">
                            <div className="absolute -right-4 -bottom-4 text-emerald-900 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700"><FileSignature size={100} aria-hidden="true" /></div>
                            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Priced Contracts</p>
                            <p className="text-3xl font-black text-stone-800 tracking-tight relative z-10">{projectStats.pricedContractsCount} <span className="text-base font-bold text-stone-400">/ {projectStats.totalContracts}</span></p>
                        </GlassCard>

                        <GlassCard variant={projectStats.missingContractsCount > 0 ? 'warning' : 'premium'} className="flex flex-col justify-center items-center">
                            <div className={`absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none ${projectStats.missingContractsCount > 0 ? 'text-orange-900' : 'text-stone-900'}`}><Calculator size={100} aria-hidden="true" /></div>
                            <p className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-2 relative z-10 ${projectStats.missingContractsCount > 0 ? 'text-orange-600' : 'text-stone-400'}`}>Missing Appraisals</p>
                            <p className={`text-3xl font-black tracking-tight relative z-10 ${projectStats.missingContractsCount > 0 ? 'text-orange-600' : 'text-stone-800'}`}>{projectStats.missingContractsCount}</p>
                        </GlassCard>

                        <GlassCard variant="dark" className="flex flex-col justify-center items-center hover:-translate-y-0.5">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 group-hover:scale-125 transition-transform duration-700"></div>
                            <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-2 relative z-10 flex items-center gap-1.5"><Sparkles size={12} aria-hidden="true" /> Personnel Budget</p>
                            <p className="text-3xl font-bold tracking-tight relative z-10">{projectStats.totalBudget.toLocaleString('en-US')} PLN</p>
                        </GlassCard>
                    </div>

                    <GlassCard variant="premium" className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6">
                        <div className="w-full lg:flex-1">
                            <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">Mass Fee Injection (Choir Only)</label>
                            <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full">
                                <Input 
                                    type="number" 
                                    value={globalFee} 
                                    onChange={e => setGlobalFee(e.target.value)} 
                                    placeholder="Value..." 
                                    rightElement="PLN"
                                    className="font-mono sm:max-w-[200px]" 
                                />
                                <Button 
                                    variant="secondary"
                                    onClick={handleApplyGlobalFee} 
                                    disabled={bulkUpdateMutation.isPending || !globalFee}
                                    isLoading={bulkUpdateMutation.isPending}
                                    leftIcon={!bulkUpdateMutation.isPending ? <Calculator size={14} /> : undefined}
                                    className="w-full sm:w-auto"
                                >
                                    Apply Valuation
                                </Button>
                            </div>
                        </div>
                        <div className="w-full lg:w-auto border-t lg:border-t-0 border-stone-200/60 pt-5 lg:pt-0">
                            <ExportContractButton projectId={selectedProjectId} />
                        </div>
                    </GlassCard>
                    
                    {currentCast.length > 0 && (
                        <GlassCard variant="premium" noPadding className="overflow-hidden">
                            <div className="p-5 bg-stone-50/50 border-b border-stone-200/60 flex items-center gap-2.5 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm"><Users size={14} className="text-[#002395]" aria-hidden="true" /></div>
                                <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">Vocal Cast (Choir / Soloists)</h3>
                            </div>
                            <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left text-sm text-stone-600">
                                <thead className="bg-stone-50/30 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/50">
                                <tr>
                                    <th className="px-6 py-4">Performer</th>
                                    <th className="px-6 py-4 hidden sm:table-cell">Voice</th>
                                    <th className="px-6 py-4 hidden md:table-cell">Status</th>
                                    <th className="px-6 py-4 w-64 text-right">Gross Amount</th>
                                    <th className="px-6 py-4 text-right w-32">Documents</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100/50">
                                {currentCast.map(participation => (
                                    <ContractRow 
                                        key={`cast-${participation.id}`} 
                                        record={participation} 
                                        type="CAST"
                                        onDownload={handleDownloadSingle} 
                                    />
                                ))}
                                </tbody>
                            </table>
                            </div>
                        </GlassCard>
                    )}

                    {currentCrew.length > 0 && (
                        <GlassCard variant="premium" noPadding className="overflow-hidden">
                            <div className="p-5 bg-stone-50/50 border-b border-stone-200/60 flex items-center gap-2.5 relative z-10">
                                <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14} className="text-stone-600" aria-hidden="true" /></div>
                                <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">Technical & Logistics Crew</h3>
                            </div>
                            <div className="overflow-x-auto scrollbar-hide">
                            <table className="w-full text-left text-sm text-stone-600">
                                <thead className="bg-stone-50/30 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/50">
                                <tr>
                                    <th className="px-6 py-4">Contractor / Firm</th>
                                    <th className="px-6 py-4 hidden sm:table-cell">Role</th>
                                    <th className="px-6 py-4 hidden md:table-cell">Status</th>
                                    <th className="px-6 py-4 w-64 text-right">Gross Amount</th>
                                    <th className="px-6 py-4 text-right w-32">Documents</th>
                                </tr>
                                </thead>
                                <tbody className="divide-y divide-stone-100/50">
                                {currentCrew.map(assignment => (
                                    <ContractRow 
                                        key={`crew-${assignment.id}`} 
                                        record={assignment} 
                                        type="CREW"
                                        onDownload={handleDownloadSingle} 
                                    />
                                ))}
                                </tbody>
                            </table>
                            </div>
                        </GlassCard>
                    )}

                </motion.div>
            )}

            {selectedProjectId && projectStats.totalContracts === 0 && (
                <GlassCard variant="premium" className="flex flex-col items-center justify-center text-center mt-8">
                    <Users size={48} className="mx-auto mb-4 text-stone-300 opacity-50" aria-hidden="true" />
                    <p className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">No Personnel Assigned</p>
                    <p className="text-xs text-stone-400 max-w-sm">Navigate to the "Projects Management" tab to hire cast or crew for this event.</p>
                </GlassCard>
            )}
        </div>
    );
}
