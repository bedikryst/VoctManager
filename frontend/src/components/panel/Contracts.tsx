/**
 * @file Contracts.tsx
 * @description Contracts Module (HR & Payroll Dashboard).
 * @architecture Enterprise 2026 (FinTech Standard)
 * BUGFIX: Safely extracts data to bypass DRF pagination arrays.
 * FEATURE: Smart Context Resolution automatically selects the active project.
 * UX UPGRADE: "FinTech" aesthetic with tabular numerals for financial inputs, 
 * OLED-black KPI highlight cards, and strictly localized Save mutations.
 * @module hr/Contracts
 * @author Krystian Bugalski
 */

import React, { useState, useMemo, useEffect } from 'react';
import { useQueries, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { 
  Calculator, Wallet, FileSignature, 
  FileText, Users, Wrench, Sparkles, Receipt, Loader2, ChevronDown, CheckCircle2 
} from 'lucide-react';

import api from '../../utils/api'; 
import { downloadFile } from '../../utils/downloadFile';
import { ExportContractButton } from '../ui/ExportContractButton';

import type { Project, Participation, CrewAssignment, Collaborator } from '../../types';

// --- Safe Data Extractor ---
const extractData = (payload: any): any[] => {
    if (!payload) return [];
    if (Array.isArray(payload)) return payload;
    if (payload.results && Array.isArray(payload.results)) return payload.results;
    return [];
};

// --- Extended Interfaces ---
interface EnrichedParticipation extends Participation {
  artist_name?: string;
  artist_voice_type_display?: string;
}

interface EnrichedCrewAssignment extends CrewAssignment {
  artist_name?: string;
  artist_voice_type_display?: string;
}

// --- Static Styles ---
const STYLE_PREMIUM_GLASS = "bg-white/70 backdrop-blur-2xl border border-white/80 shadow-[0_8px_30px_rgb(0,0,0,0.04)] shadow-[inset_0_1px_0_rgba(255,255,255,1)] rounded-[2rem]";
const STYLE_DARK_GLASS_INPUT = "w-full px-5 py-4 text-sm text-white bg-white/5 backdrop-blur-md border border-white/10 rounded-xl focus:outline-none focus:ring-2 focus:ring-blue-500/50 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.2)] font-bold appearance-none cursor-pointer hover:bg-white/10";
const STYLE_GLASS_INPUT = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

export default function Contracts(): React.JSX.Element {
  const queryClient = useQueryClient();

  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [globalFee, setGlobalFee] = useState<string>('');
  const [isApplyingGlobal, setIsApplyingGlobal] = useState<boolean>(false);

  const results = useQueries({
    queries: [
      { queryKey: ['projects'], queryFn: async () => (await api.get('/api/projects/')).data },
      { queryKey: ['participations'], queryFn: async () => (await api.get('/api/participations/')).data },
      { queryKey: ['crewAssignments'], queryFn: async () => (await api.get('/api/crew-assignments/')).data },
      { queryKey: ['collaborators'], queryFn: async () => (await api.get('/api/collaborators/')).data }
    ]
  });

  const isLoading = results.some(q => q.isLoading);

  const data = useMemo(() => ({
    projects: extractData(results[0].data) as Project[],
    participations: extractData(results[1].data) as EnrichedParticipation[],
    crewAssignments: extractData(results[2].data) as CrewAssignment[],
    crew: extractData(results[3].data) as Collaborator[]
  }), [results]);

  // --- SMART CONTEXT RESOLUTION ---
  useEffect(() => {
      if (!selectedProjectId && data.projects.length > 0) {
          const now = new Date();
          const activeProjects = data.projects.filter(p => p.status === 'ACTIVE' || p.status === 'DRAFT');
          const upcoming = activeProjects
              .filter(p => new Date(p.date_time) >= new Date(now.getTime() - 24 * 60 * 60 * 1000))
              .sort((a, b) => new Date(a.date_time).getTime() - new Date(b.date_time).getTime());

          if (upcoming.length > 0) {
              setSelectedProjectId(String(upcoming[0].id));
          } else {
              const past = [...data.projects].sort((a, b) => new Date(b.date_time).getTime() - new Date(a.date_time).getTime());
              if(past.length > 0) setSelectedProjectId(String(past[0].id));
          }
      }
  }, [data.projects, selectedProjectId]);

  // --- Contextual Scoping & Data Enrichment ---
  const currentCast = useMemo<EnrichedParticipation[]>(() => {
    if (!selectedProjectId) return [];
    return data.participations
      .filter(p => String(p.project) === String(selectedProjectId) && p.status !== 'DEC')
      .sort((a, b) => (a.artist_name || '').localeCompare(b.artist_name || ''));
  }, [data.participations, selectedProjectId]);

  const currentCrew = useMemo<EnrichedCrewAssignment[]>(() => {
    if (!selectedProjectId) return [];
    return data.crewAssignments
      .filter(c => String(c.project) === String(selectedProjectId))
      .map(assignment => {
        const person = data.crew.find(c => String(c.id) === String(assignment.collaborator));
        return {
          ...assignment,
          artist_name: person ? `${person.first_name} ${person.last_name}` : 'Nieznany',
          artist_voice_type_display: assignment.role_description || person?.specialty || 'Ekipa'
        };
      });
  }, [data.crewAssignments, data.crew, selectedProjectId]);

  // --- Financial KPIs ---
  const allContracts = [...currentCast, ...currentCrew];
  const totalBudget = useMemo(() => allContracts.reduce((sum, p) => sum + (parseFloat(String(p.fee)) || 0), 0), [allContracts]);
  const pricedContractsCount = useMemo(() => allContracts.filter(p => parseFloat(String(p.fee)) > 0).length, [allContracts]);
  const missingContractsCount = allContracts.length - pricedContractsCount;

  const globalStats = useMemo(() => {
      const totalPartFee = data.participations.reduce((sum, p) => sum + (parseFloat(String(p.fee)) || 0), 0);
      const totalCrewFee = data.crewAssignments.reduce((sum, c) => sum + (parseFloat(String(c.fee)) || 0), 0);
      return {
          totalBudget: totalPartFee + totalCrewFee,
          totalContracts: data.participations.length + data.crewAssignments.length,
          totalPriced: data.participations.filter(p => parseFloat(String(p.fee)) > 0).length + data.crewAssignments.filter(c => parseFloat(String(c.fee)) > 0).length
      };
  }, [data.participations, data.crewAssignments]);

  // --- Mutation Handlers ---
  const handleApplyGlobalFee = async (): Promise<void> => {
    if (!globalFee) return;
    setIsApplyingGlobal(true);
    const toastId = toast.loading('Trwa nadpisywanie stawek w bazie danych...');
    
    try {
      const res = await api.patch('/api/participations/bulk-fee/', { 
        project_id: selectedProjectId,
        fee: parseFloat(globalFee) 
      });
      
      await queryClient.invalidateQueries({ queryKey: ['participations'] });
      toast.success(`Pomyślnie zaktualizowano stawki dla ${res.data.updated_count} chórzystów.`, { id: toastId });
      setGlobalFee(''); 
    } catch (e) { 
      toast.error('Wystąpił błąd serwera podczas masowego zapisu.', { id: toastId });
    } finally {
      setIsApplyingGlobal(false);
    }
  };

  const handleDownloadSingle = async (recordId: string | number, personName: string, type: 'CAST' | 'CREW'): Promise<void> => {
    const toastId = toast.loading(`Generowanie pliku PDF dla: ${personName}...`);
    try {
      const endpoint = type === 'CAST' ? `/api/participations/${recordId}/contract/` : `/api/crew-assignments/${recordId}/contract/`;
      await downloadFile(endpoint, `Umowa_${personName.replace(/ /g, '_')}.pdf`);
      toast.success(`Dokument dla ${personName} został wygenerowany pomyślnie.`, { id: toastId });
    } catch (err: any) { 
      toast.error(`Błąd generowania dokumentu: ${err.message}`, { id: toastId }); 
    }
  };

  // --- Render ---
  if (isLoading && !data.projects.length) {
    return (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
            <Loader2 size={32} className="animate-spin text-[#002395]/40" />
            <span className="text-[10px] uppercase font-bold tracking-[0.2em] text-[#002395]/60">Ładowanie ksiąg...</span>
        </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in pb-24 max-w-7xl mx-auto cursor-default px-4 sm:px-6 lg:px-8">
      
      {/* HEADER */}
      <header className="relative pt-8 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Wallet size={12} className="text-[#002395]" aria-hidden="true" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">Zarządzanie Finansami</p>
              </div>
              <h1 className="text-4xl md:text-5xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Kadry i <span className="italic text-[#002395] font-bold">Płace</span>.
              </h1>
              <p className="text-stone-500 mt-3 font-medium tracking-wide text-sm max-w-xl">
                  Rozliczaj artystów i ekipę, kontroluj całkowity budżet projektu i generuj umowy.
              </p>
          </motion.div>
      </header>

      {/* OLED CONTEXT SWITCHER */}
      <div className="bg-[#0a0a0a] p-6 md:p-8 rounded-[2rem] shadow-[0_20px_40px_rgba(0,0,0,0.2)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col md:flex-row md:items-center gap-6 relative overflow-hidden group border border-stone-800">
        <div className="absolute -top-32 -right-32 w-80 h-80 bg-[#002395] rounded-full blur-[100px] opacity-40 pointer-events-none group-hover:opacity-60 transition-opacity duration-1000"></div>
        <div className="absolute inset-0 opacity-[0.05] pointer-events-none" style={{ backgroundImage: 'radial-gradient(circle at 2px 2px, white 1px, transparent 0)', backgroundSize: '24px 24px' }}></div>
        
        <div className="relative z-10 w-full flex flex-col sm:flex-row gap-5 items-center">
            <div className="w-14 h-14 bg-white/10 border border-white/20 rounded-2xl flex items-center justify-center flex-shrink-0 text-blue-300">
                <Receipt size={24} aria-hidden="true" />
            </div>
            <div className="flex-1 w-full">
                <label className="block text-[10px] font-bold antialiased uppercase tracking-[0.2em] text-stone-400 mb-2 ml-1">
                    Wybierz wydarzenie (Kontekst Rozliczeniowy)
                </label>
                <div className="relative">
                    <select 
                        value={selectedProjectId} 
                        onChange={e => setSelectedProjectId(e.target.value)} 
                        className={STYLE_DARK_GLASS_INPUT}
                    >
                        <option value="" className="text-stone-900">— Brak wybranego wydarzenia —</option>
                        {data.projects.filter(p => p.status !== 'CANC').map(p => (
                            <option key={p.id} value={p.id} className="text-stone-900">{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
                        ))}
                    </select>
                    <div className="absolute inset-y-0 right-5 flex items-center pointer-events-none text-stone-400">
                        <ChevronDown size={18} />
                    </div>
                </div>
            </div>
        </div>
      </div>

      {/* EMPTY STATE (Brak jakiegokolwiek projektu w bazie) */}
      {!selectedProjectId && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className={`${STYLE_PREMIUM_GLASS} p-8 lg:col-span-2 flex flex-col justify-center items-start overflow-hidden relative`}>
             <div className="absolute -right-12 -top-12 text-stone-200 opacity-20 pointer-events-none">
                 <Receipt size={250} strokeWidth={1} aria-hidden="true" />
             </div>
             <Wallet size={40} className="text-[#002395] mb-5 relative z-10" aria-hidden="true" />
             <h2 className="text-2xl font-bold text-stone-800 tracking-tight mb-2 relative z-10" style={{ fontFamily: "'Cormorant', serif" }}>Gotowy do rozliczeń</h2>
             <p className="text-sm text-stone-500 max-w-md leading-relaxed relative z-10">Wybierz wydarzenie z przełącznika kontekstu powyżej, aby zarządzać stawkami i w pełni kontrolować budżet produkcyjny.</p>
          </div>

          <div className={`${STYLE_PREMIUM_GLASS} p-8 flex flex-col justify-between bg-gradient-to-b from-stone-50/50 to-white/30`}>
             <div>
                 <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">Globalny Budżet Systemu</p>
                 <p className="text-3xl font-black text-stone-800 tracking-tight">{globalStats.totalBudget.toLocaleString('pl-PL')} PLN</p>
             </div>
             <div className="pt-6 border-t border-stone-200/60 mt-6">
                 <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">Umowy w Bazie</p>
                 <p className="text-xl font-bold text-stone-700">{globalStats.totalPriced} <span className="text-sm font-medium text-stone-400">/ {globalStats.totalContracts} wyceniono</span></p>
             </div>
          </div>
        </motion.div>
      )}

      {/* PROJECT CONTEXT DASHBOARD */}
      {selectedProjectId && allContracts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 relative z-10">
          
          {/* ACCOUNTANT DASHBOARD (BENTO) */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className={`${STYLE_PREMIUM_GLASS} p-6 flex flex-col justify-center items-center relative group overflow-hidden hover:-translate-y-0.5 transition-transform`}>
                  <div className="absolute -right-4 -bottom-4 text-emerald-900 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700"><FileSignature size={100} aria-hidden="true" /></div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Wycenione Umowy</p>
                  <p className="text-3xl font-black text-stone-800 tracking-tight relative z-10">{pricedContractsCount} <span className="text-base font-bold text-stone-400">/ {allContracts.length}</span></p>
              </div>

              <div className={`p-6 flex flex-col justify-center items-center rounded-[2rem] relative overflow-hidden transition-all duration-300 ${missingContractsCount > 0 ? 'bg-orange-50/80 backdrop-blur-xl border border-orange-200 shadow-[0_4px_20px_rgba(249,115,22,0.05)]' : STYLE_PREMIUM_GLASS}`}>
                  <div className={`absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none ${missingContractsCount > 0 ? 'text-orange-900' : 'text-stone-900'}`}><Calculator size={100} aria-hidden="true" /></div>
                  <p className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-2 relative z-10 ${missingContractsCount > 0 ? 'text-orange-600' : 'text-stone-400'}`}>Braki w wycenie</p>
                  <p className={`text-3xl font-black tracking-tight relative z-10 ${missingContractsCount > 0 ? 'text-orange-600' : 'text-stone-800'}`}>{missingContractsCount}</p>
              </div>

              <div className="bg-[#0a0a0a] border border-stone-800 p-6 rounded-[2rem] shadow-[0_10px_30px_rgba(0,0,0,0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.15)] flex flex-col justify-center items-center text-white relative overflow-hidden group hover:-translate-y-0.5 transition-transform">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/30 rounded-full blur-[80px] -translate-y-1/2 translate-x-1/4 group-hover:scale-125 transition-transform duration-700"></div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-300 mb-2 relative z-10 flex items-center gap-1.5"><Sparkles size={12} aria-hidden="true" /> Budżet Personelu</p>
                  <p className="text-3xl font-bold tracking-tight relative z-10">{totalBudget.toLocaleString('pl-PL')} PLN</p>
              </div>
          </div>

          {/* MASS ACTIONS BAR */}
          <div className={`${STYLE_PREMIUM_GLASS} p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6`}>
            <div className="w-full lg:flex-1">
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">Masowe uzupełnianie stawek (Tylko Chór)</label>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full">
                <div className="relative sm:max-w-[200px] w-full">
                    <input 
                    type="number" 
                    value={globalFee} 
                    onChange={e => setGlobalFee(e.target.value)} 
                    placeholder="Wartość..." 
                    className={`${STYLE_GLASS_INPUT} pr-12 font-mono`} 
                    />
                    <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-stone-400 text-xs font-bold">PLN</div>
                </div>
                
                <button 
                  onClick={handleApplyGlobalFee} 
                  disabled={isApplyingGlobal || !globalFee} 
                  className="bg-stone-900 hover:bg-[#002395] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3 px-8 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] active:scale-95 w-full sm:w-auto flex items-center justify-center gap-2"
                >
                  {isApplyingGlobal ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Calculator size={14} />}
                  Zastosuj Wycenę
                </button>
              </div>
            </div>
            <div className="w-full lg:w-auto border-t lg:border-t-0 border-stone-200/60 pt-5 lg:pt-0">
              <ExportContractButton projectId={selectedProjectId} />
            </div>
          </div>
          
          {/* TABLE 1: CAST */}
          {currentCast.length > 0 && (
              <div className={`${STYLE_PREMIUM_GLASS} overflow-hidden`}>
                  <div className="p-5 bg-stone-50/50 border-b border-stone-200/60 flex items-center gap-2.5 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm"><Users size={14} className="text-[#002395]" aria-hidden="true" /></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">Obsada Wokalna (Chór / Soliści)</h3>
                  </div>
                  <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left text-sm text-stone-600">
                      <thead className="bg-stone-50/30 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/50">
                      <tr>
                          <th className="px-6 py-4">Wykonawca</th>
                          <th className="px-6 py-4 hidden sm:table-cell">Głos</th>
                          <th className="px-6 py-4 hidden md:table-cell">Status Aktu</th>
                          <th className="px-6 py-4 w-64 text-right">Kwota Brutto</th>
                          <th className="px-6 py-4 text-right w-32">Dokumenty</th>
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
              </div>
          )}

          {/* TABLE 2: CREW */}
          {currentCrew.length > 0 && (
              <div className={`${STYLE_PREMIUM_GLASS} overflow-hidden`}>
                  <div className="p-5 bg-stone-50/50 border-b border-stone-200/60 flex items-center gap-2.5 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14} className="text-stone-600" aria-hidden="true" /></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">Ekipa Techniczna i Logistyka</h3>
                  </div>
                  <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left text-sm text-stone-600">
                      <thead className="bg-stone-50/30 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/50">
                      <tr>
                          <th className="px-6 py-4">Wykonawca / Firma</th>
                          <th className="px-6 py-4 hidden sm:table-cell">Rola</th>
                          <th className="px-6 py-4 hidden md:table-cell">Status Aktu</th>
                          <th className="px-6 py-4 w-64 text-right">Kwota Brutto</th>
                          <th className="px-6 py-4 text-right w-32">Dokumenty</th>
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
              </div>
          )}

        </motion.div>
      )}

      {/* EMPTY STATE (Project Selected, but no personnel) */}
      {selectedProjectId && allContracts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${STYLE_PREMIUM_GLASS} p-16 flex flex-col items-center justify-center text-center mt-8`}>
              <Users size={48} className="mx-auto mb-4 text-stone-300 opacity-50" aria-hidden="true" />
              <p className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak przypisanego personelu</p>
              <p className="text-xs text-stone-400 max-w-sm">Przejdź do zakładki "Zarządzanie Projektami", aby zatrudnić obsadę lub ekipę do tego projektu.</p>
          </motion.div>
      )}
    </div>
  );
}

// ============================================================================
// SUB-COMPONENT: ROW MANAGER
// ============================================================================

interface ContractRowProps {
  record: any; 
  type: 'CAST' | 'CREW';
  onDownload: (id: string | number, name: string, type: 'CAST' | 'CREW') => void;
}

function ContractRow({ record, type, onDownload }: ContractRowProps): React.JSX.Element {
  const queryClient = useQueryClient();
  const [fee, setFee] = useState<string>(record.fee ? String(record.fee) : '');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccess, setSaveSuccess] = useState<boolean>(false);

  const personName = record.artist_name || '-';
  const roleDisplay = record.artist_voice_type_display || '-'; 

  const handleSaveFee = async (): Promise<void> => {
    setIsSaving(true); 
    setSaveSuccess(false);
    
    try {
      const numericFee = fee === '' ? null : parseFloat(fee);
      const endpoint = type === 'CAST' ? `/api/participations/${record.id}/` : `/api/crew-assignments/${record.id}/`;
      
      const res = await api.patch(endpoint, { fee: numericFee });
      
      if (res.status === 200 || res.status === 204) {
        setSaveSuccess(true);
        await queryClient.invalidateQueries({ queryKey: type === 'CAST' ? ['participations'] : ['crewAssignments'] });
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) { 
      toast.error(`Nie udało się zapisać kwoty dla ${personName}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const isMissingFee = !fee || parseFloat(fee) === 0;

  return (
    <tr className={`transition-colors group ${isMissingFee ? 'bg-orange-50/10 hover:bg-orange-50/30' : 'hover:bg-stone-50/50'}`}>
      <td className="px-6 py-5">
          <p className="font-bold text-stone-800 whitespace-nowrap tracking-tight">{personName}</p>
          {isMissingFee && <p className="text-[9px] font-bold text-orange-500 uppercase tracking-widest mt-1 md:hidden">Brak wyceny!</p>}
      </td>
      <td className="px-6 py-5 hidden sm:table-cell text-[9px] uppercase font-bold antialiased text-stone-500 tracking-widest">{roleDisplay}</td>
      <td className="px-6 py-5 hidden md:table-cell text-[9px] uppercase font-bold antialiased tracking-widest text-stone-400">{record.status}</td>
      
      <td className="px-6 py-5">
        <div className="flex items-center justify-end space-x-2">
          <div className="relative">
            <input 
                type="number" 
                value={fee} 
                onChange={e => setFee(e.target.value)} 
                placeholder="0.00"
                disabled={isSaving}
                className={`w-28 pl-3 pr-10 py-2.5 text-sm text-right font-mono font-bold border rounded-xl outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] ${isMissingFee ? 'border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white text-orange-900' : 'border-stone-200/80 focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 bg-white/50 backdrop-blur-sm text-stone-800'}`} 
            />
            <div className="absolute inset-y-0 right-3 flex items-center pointer-events-none text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400">PLN</div>
          </div>
          <button 
            onClick={handleSaveFee} 
            disabled={isSaving || parseFloat(fee || '0') === parseFloat(String(record.fee || '0'))} 
            className={`px-4 py-2.5 text-[9px] uppercase tracking-widest font-bold antialiased rounded-xl transition-all active:scale-95 shadow-sm min-w-[70px] flex items-center justify-center ${saveSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : (parseFloat(fee || '0') !== parseFloat(String(record.fee || '0')) && fee !== '') ? 'bg-[#002395] text-white hover:bg-[#001766] shadow-[0_4px_10px_rgba(0,35,149,0.3)]' : 'bg-stone-100 text-stone-400 border border-stone-200 disabled:opacity-50 disabled:shadow-none'}`}
          >
            {isSaving ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : saveSuccess ? <CheckCircle2 size={14}/> : 'Zapisz'}
          </button>
        </div>
      </td>
      
      <td className="px-6 py-5 text-right">
        <button 
          onClick={() => onDownload(record.id, personName, type)} 
          disabled={isMissingFee}
          className="inline-flex items-center gap-2 justify-center w-full sm:w-auto text-[9px] font-bold antialiased uppercase tracking-widest bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 hover:shadow-md disabled:opacity-50 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <FileText size={14} aria-hidden="true" /> PDF
        </button>
      </td>
    </tr>
  );
}