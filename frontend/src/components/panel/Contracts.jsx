/**
 * @file Contracts.jsx
 * @description Contracts Module (HR & Payroll Dashboard).
 * Implements dual-tables for Cast and Crew with dynamic conditional PDF generation.
 * ENTERPRISE UPGRADE 2026: Added a Global "Zero Data State" dashboard that displays
 * aggregate financial metrics before a specific project context is selected.
 * @module hr/Contracts
 * @author Krystian Bugalski
 */

import { useState, useEffect, useCallback, useMemo } from 'react';
import { Calculator, Wallet, FileSignature, AlertCircle, FileText, Users, Wrench, Sparkles, Receipt } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../utils/api'; 
import { downloadFile } from '../../utils/downloadFile';
import { ExportContractButton } from '../ui/ExportContractButton';

export default function Contracts() {
  const [projects, setProjects] = useState([]);
  
  // Relational Data States
  const [participations, setParticipations] = useState([]);
  const [crewAssignments, setCrewAssignments] = useState([]);
  const [crew, setCrew] = useState([]);

  // UI States
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [status, setStatus] = useState({ type: '', message: '' });
  
  const [globalFee, setGlobalFee] = useState('');
  const [isApplyingGlobal, setIsApplyingGlobal] = useState(false);

  const fetchFinancialData = useCallback(async () => {
    try {
      const [partRes, assignRes, crewRes] = await Promise.all([
          api.get('/api/participations/'),
          api.get('/api/crew-assignments/'),
          api.get('/api/collaborators/')
      ]);
      setParticipations(Array.isArray(partRes.data) ? partRes.data : []);
      setCrewAssignments(Array.isArray(assignRes.data) ? assignRes.data : []);
      setCrew(Array.isArray(crewRes.data) ? crewRes.data : []);
    } catch (err) {
      console.error("Error fetching financial data:", err);
    }
  }, []);

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const response = await api.get('/api/projects/');
        setProjects(Array.isArray(response.data) ? response.data : []);
      } catch (err) {
        console.error("Error fetching projects:", err);
      }
    };
    fetchProjects();
    fetchFinancialData();
  }, [fetchFinancialData]);

  // Contextual Scoping
  const currentCast = participations
    .filter(p => String(p.project) === String(selectedProjectId))
    .sort((a, b) => (a.artist_name || '').localeCompare(b.artist_name || ''));

  const currentCrew = crewAssignments
    .filter(c => String(c.project) === String(selectedProjectId));

  // Project Financial KPIs
  const allContracts = [...currentCast, ...currentCrew];
  const totalBudget = allContracts.reduce((sum, p) => sum + (parseFloat(p.fee) || 0), 0);
  const pricedContractsCount = allContracts.filter(p => parseFloat(p.fee) > 0).length;
  const missingContractsCount = allContracts.length - pricedContractsCount;

  // Global Financial KPIs (For the Empty State Dashboard)
  const globalStats = useMemo(() => {
      const totalPartFee = participations.reduce((sum, p) => sum + (parseFloat(p.fee) || 0), 0);
      const totalCrewFee = crewAssignments.reduce((sum, c) => sum + (parseFloat(c.fee) || 0), 0);
      return {
          totalBudget: totalPartFee + totalCrewFee,
          totalContracts: participations.length + crewAssignments.length,
          totalPriced: participations.filter(p => parseFloat(p.fee) > 0).length + crewAssignments.filter(c => parseFloat(c.fee) > 0).length
      };
  }, [participations, crewAssignments]);

  // Mutation Handlers
  const handleUpdateSingleFee = (id, newFee, type) => {
    if (type === 'CAST') {
        setParticipations(prev => prev.map(p => String(p.id) === String(id) ? { ...p, fee: newFee } : p));
    } else {
        setCrewAssignments(prev => prev.map(c => String(c.id) === String(id) ? { ...c, fee: newFee } : c));
    }
  };

  const handleApplyGlobalFee = async () => {
    if (!globalFee) return;
    setIsApplyingGlobal(true);
    setStatus({ type: 'info', message: 'Trwa nadpisywanie stawek w bazie danych...' });
    
    try {
      const res = await api.patch('/api/participations/bulk-fee/', { 
        project_id: selectedProjectId,
        fee: parseFloat(globalFee) 
      });
      await fetchFinancialData();
      setStatus({ type: 'success', message: `Pomyślnie zaktualizowano stawki dla ${res.data.updated_count} chórzystów.` });
      setGlobalFee(''); 
    } catch (e) { 
      setStatus({ type: 'error', message: 'Wystąpił błąd serwera podczas masowego zapisu.' });
    } finally {
      setIsApplyingGlobal(false);
    }
  };

  const handleDownloadSingle = async (recordId, personName, type) => {
    setStatus({ type: 'info', message: `Generowanie pliku PDF dla: ${personName}...` });
    try {
      const endpoint = type === 'CAST' ? `/api/participations/${recordId}/contract/` : `/api/crew-assignments/${recordId}/contract/`;
      await downloadFile(endpoint, `Umowa_${personName.replace(' ', '_')}.pdf`);
      setStatus({ type: 'success', message: `Dokument dla ${personName} został wygenerowany pomyślnie.` });
    } catch (err) { 
      setStatus({ type: 'error', message: `Błąd generowania dokumentu: ${err.message}` }); 
    }
  };

  // UI Shared Classes
  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl";
  const glassInputStyle = "w-full px-4 py-3 text-sm text-stone-800 bg-white/50 backdrop-blur-sm border border-stone-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)]";

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-6xl mx-auto cursor-default">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Wallet size={12} className="text-[#002395]" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Zarządzanie Finansami
                  </p>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Kadry i <span className="italic text-[#002395]">Płace</span>.
              </h1>
          </motion.div>
      </header>

      {/* --- STATUS BANNER --- */}
      <AnimatePresence>
        {status.message && (
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className={`p-4 rounded-xl text-[10px] font-bold antialiased uppercase tracking-widest border shadow-sm flex items-center gap-3 ${status.type === 'success' ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700' : status.type === 'info' ? 'bg-blue-50/80 border-blue-200 text-[#002395]' : 'bg-red-50/80 border-red-200 text-red-700'}`}>
            {status.type === 'error' ? <AlertCircle size={16}/> : status.type === 'info' ? <Loader2 size={16} className="animate-spin" /> : <FileSignature size={16}/>}
            {status.message}
          </motion.div>
        )}
      </AnimatePresence>

      {/* --- PROJECT SELECTOR --- */}
      <div className={`${glassCardStyle} p-6 md:p-8 flex flex-col md:flex-row items-end gap-6 relative z-20`}>
        <div className="w-full md:flex-1">
          <label className="block text-[10px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">Wybierz wydarzenie (Kontekst Rozliczeniowy)</label>
          <select 
            value={selectedProjectId} 
            onChange={e => { setSelectedProjectId(e.target.value); setStatus({ type: '', message: '' }); }} 
            className={`${glassInputStyle} font-medium appearance-none`}
          >
            <option value="">— Wybierz wydarzenie —</option>
            {projects.filter(p => p.status !== 'CANC').map(p => (
                <option key={p.id} value={p.id}>{p.title} {p.status === 'DONE' ? '(Archiwum)' : ''}</option>
            ))}
          </select>
        </div>
      </div>

      {/* --- INITIAL EMPTY STATE (Global System Overview) --- */}
      {!selectedProjectId && (
        <motion.div initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} className="grid grid-cols-1 lg:grid-cols-3 gap-6 pt-4">
          <div className={`${glassCardStyle} p-8 lg:col-span-2 flex flex-col justify-center items-start overflow-hidden relative`}>
             <div className="absolute -right-12 -top-12 text-stone-200 opacity-20 pointer-events-none">
                 <Receipt size={250} strokeWidth={1} />
             </div>
             <Wallet size={40} className="text-[#002395] mb-5 relative z-10" />
             <h2 className="text-2xl font-bold text-stone-800 tracking-tight mb-2 relative z-10" style={{ fontFamily: "'Cormorant', serif" }}>Gotowy do rozliczeń</h2>
             <p className="text-sm text-stone-500 max-w-md leading-relaxed relative z-10">Wybierz wydarzenie z rozwijanej listy powyżej, aby zarządzać stawkami artystów, generować umowy w formacie PDF i w pełni kontrolować budżet produkcyjny.</p>
          </div>

          <div className={`${glassCardStyle} p-8 flex flex-col justify-between bg-gradient-to-b from-stone-50/50 to-white/30`}>
             <div>
                 <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">Globalny Obrót (System)</p>
                 <p className="text-3xl font-black text-stone-800 tracking-tight">{globalStats.totalBudget.toLocaleString('pl-PL')} PLN</p>
             </div>
             <div className="pt-6 border-t border-stone-200/60 mt-6">
                 <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2">Umowy w Bazie</p>
                 <p className="text-xl font-bold text-stone-700">{globalStats.totalPriced} <span className="text-sm font-medium text-stone-400">/ {globalStats.totalContracts} wyceniono</span></p>
             </div>
          </div>
        </motion.div>
      )}

      {/* --- PROJECT CONTEXT DASHBOARD --- */}
      {selectedProjectId && allContracts.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-8 relative z-10">
          
          {/* --- ACCOUNTANT DASHBOARD (BENTO) --- */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <div className={`${glassCardStyle} p-6 flex flex-col justify-center items-center relative group overflow-hidden hover:-translate-y-0.5 transition-transform`}>
                  <div className="absolute -right-4 -bottom-4 text-emerald-900 opacity-[0.03] pointer-events-none group-hover:scale-110 transition-transform duration-700"><FileSignature size={100}/></div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-stone-400 mb-2 relative z-10">Wycenione Umowy</p>
                  <p className="text-3xl font-black text-stone-800 tracking-tight relative z-10">{pricedContractsCount} <span className="text-base font-bold text-stone-400">/ {allContracts.length}</span></p>
              </div>

              <div className={`p-6 flex flex-col justify-center items-center rounded-2xl relative overflow-hidden transition-all duration-300 ${missingContractsCount > 0 ? 'bg-orange-50/80 backdrop-blur-xl border border-orange-200 shadow-sm' : glassCardStyle}`}>
                  <div className={`absolute -right-4 -bottom-4 opacity-[0.03] pointer-events-none ${missingContractsCount > 0 ? 'text-orange-900' : 'text-stone-900'}`}><Calculator size={100}/></div>
                  <p className={`text-[9px] font-bold antialiased uppercase tracking-widest mb-2 relative z-10 ${missingContractsCount > 0 ? 'text-orange-600' : 'text-stone-400'}`}>Braki w wycenie</p>
                  <p className={`text-3xl font-black tracking-tight relative z-10 ${missingContractsCount > 0 ? 'text-orange-600' : 'text-stone-800'}`}>{missingContractsCount}</p>
              </div>

              <div className="bg-gradient-to-br from-[#002395] via-[#001766] to-[#000a33] p-6 rounded-2xl shadow-[0_10px_30px_rgba(0,35,149,0.15)] shadow-[inset_0_1px_0_rgba(255,255,255,0.2)] flex flex-col justify-center items-center text-white relative overflow-hidden group hover:-translate-y-0.5 transition-transform">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-blue-400/20 rounded-full blur-2xl -translate-y-1/2 translate-x-1/4"></div>
                  <p className="text-[9px] font-bold antialiased uppercase tracking-widest text-blue-200 mb-2 relative z-10 flex items-center gap-1.5"><Sparkles size={12}/> Całkowity Budżet</p>
                  <p className="text-3xl font-bold tracking-tight relative z-10">{totalBudget.toLocaleString('pl-PL')} PLN</p>
              </div>
          </div>

          {/* --- MASS ACTIONS BAR --- */}
          <div className={`${glassCardStyle} p-6 flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6`}>
            <div className="w-full lg:flex-1">
              <label className="block text-[9px] font-bold antialiased uppercase tracking-widest text-stone-500 mb-3 ml-1">Masowe uzupełnianie stawek (Tylko Chór)</label>
              <div className="flex flex-col sm:flex-row space-y-3 sm:space-y-0 sm:space-x-3 w-full">
                <input type="number" value={globalFee} onChange={e => setGlobalFee(e.target.value)} placeholder="Wartość w PLN..." className={`${glassInputStyle} sm:max-w-[200px]`} />
                <button onClick={handleApplyGlobalFee} disabled={isApplyingGlobal || !globalFee} className="bg-stone-900 hover:bg-[#002395] disabled:bg-stone-300 disabled:text-stone-500 text-white text-[10px] uppercase tracking-[0.15em] font-bold antialiased py-3 px-8 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,0,0,0.15)] active:scale-95 w-full sm:w-auto">
                  Zastosuj Stawkę
                </button>
              </div>
            </div>
            <div className="w-full lg:w-auto border-t lg:border-t-0 border-stone-200/60 pt-5 lg:pt-0">
              <ExportContractButton projectId={selectedProjectId} />
            </div>
          </div>
          
          {/* --- TABLE 1: CAST --- */}
          {currentCast.length > 0 && (
              <div className={`${glassCardStyle} overflow-hidden`}>
                  <div className="p-5 bg-white/40 border-b border-white/60 flex items-center gap-2.5 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-blue-50 flex items-center justify-center border border-blue-100 shadow-sm"><Users size={14} className="text-[#002395]" /></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">Obsada Wokalna (Chór / Soliści)</h3>
                  </div>
                  <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left text-sm text-stone-600">
                      <thead className="bg-stone-50/50 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/60">
                      <tr>
                          <th className="px-5 py-4">Wykonawca</th>
                          <th className="px-5 py-4 hidden sm:table-cell">Głos</th>
                          <th className="px-5 py-4 hidden md:table-cell">Status Aktu</th>
                          <th className="px-5 py-4 w-56 text-right pr-14">Kwota Brutto</th>
                          <th className="px-5 py-4 text-right">Opcje</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100/50">
                      {currentCast.map(participation => (
                          <ContractRow 
                              key={`cast-${participation.id}`} 
                              record={participation} 
                              type="CAST"
                              onDownload={handleDownloadSingle} 
                              onUpdateFee={handleUpdateSingleFee}
                          />
                      ))}
                      </tbody>
                  </table>
                  </div>
              </div>
          )}

          {/* --- TABLE 2: CREW --- */}
          {currentCrew.length > 0 && (
              <div className={`${glassCardStyle} overflow-hidden`}>
                  <div className="p-5 bg-white/40 border-b border-white/60 flex items-center gap-2.5 relative z-10">
                    <div className="w-8 h-8 rounded-xl bg-stone-100 flex items-center justify-center border border-stone-200 shadow-sm"><Wrench size={14} className="text-stone-600" /></div>
                    <h3 className="text-[10px] font-bold antialiased uppercase tracking-[0.15em] text-stone-700">Ekipa Techniczna i Logistyka</h3>
                  </div>
                  <div className="overflow-x-auto scrollbar-hide">
                  <table className="w-full text-left text-sm text-stone-600">
                      <thead className="bg-stone-50/50 backdrop-blur-md text-[9px] antialiased uppercase font-bold tracking-widest text-stone-400 border-b border-stone-200/60">
                      <tr>
                          <th className="px-5 py-4">Wykonawca</th>
                          <th className="px-5 py-4 hidden sm:table-cell">Rola</th>
                          <th className="px-5 py-4 hidden md:table-cell">Status Aktu</th>
                          <th className="px-5 py-4 w-56 text-right pr-14">Kwota Brutto</th>
                          <th className="px-5 py-4 text-right">Opcje</th>
                      </tr>
                      </thead>
                      <tbody className="divide-y divide-stone-100/50">
                      {currentCrew.map(assignment => {
                          const person = crew.find(c => String(c.id) === String(assignment.collaborator));
                          if (!person) return null;
                          const enrichedRecord = {
                              ...assignment,
                              artist_name: `${person.first_name} ${person.last_name}`,
                              artist_voice_type_display: assignment.role_description || person.specialty
                          };
                          return (
                              <ContractRow 
                                  key={`crew-${assignment.id}`} 
                                  record={enrichedRecord} 
                                  type="CREW"
                                  onDownload={handleDownloadSingle} 
                                  onUpdateFee={handleUpdateSingleFee}
                              />
                          );
                      })}
                      </tbody>
                  </table>
                  </div>
              </div>
          )}

        </motion.div>
      )}

      {/* --- EMPTY STATE (Project Selected, but no cast) --- */}
      {selectedProjectId && allContracts.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className={`${glassCardStyle} p-16 flex flex-col items-center justify-center text-center mt-8`}>
              <Users size={48} className="mx-auto mb-4 text-stone-300 opacity-50" />
              <p className="text-[11px] font-bold antialiased text-stone-500 uppercase tracking-widest mb-2">Brak przypisanego personelu</p>
              <p className="text-xs text-stone-400 max-w-sm">Przejdź do zakładki "Wydarzenia", aby zatrudnić obsadę lub ekipę do tego projektu.</p>
          </motion.div>
      )}
    </div>
  );
}

/**
 * @description Internal component representing a single row in the financial matrix.
 */
function ContractRow({ record, type, onDownload, onUpdateFee }) {
  const [fee, setFee] = useState(record.fee || '');
  const [isSaving, setIsSaving] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  useEffect(() => { setFee(record.fee || ''); }, [record.fee]);

  const personName = record.artist_name || '-';
  const roleDisplay = record.artist_voice_type_display || '-'; 

  const handleSaveFee = async () => {
    setIsSaving(true); 
    setSaveSuccess(false);
    
    try {
      const numericFee = fee === '' ? null : parseFloat(fee);
      const endpoint = type === 'CAST' ? `/api/participations/${record.id}/` : `/api/crew-assignments/${record.id}/`;
      
      const res = await api.patch(endpoint, { fee: numericFee });
      
      if (res.status === 200 || res.status === 204) {
        setSaveSuccess(true);
        if (onUpdateFee) onUpdateFee(record.id, res.data?.fee !== undefined ? res.data.fee : numericFee, type);
        setTimeout(() => setSaveSuccess(false), 2000);
      }
    } catch (err) { 
      alert(`Nie udało się zapisać kwoty dla ${personName}.`);
    } finally {
      setIsSaving(false);
    }
  };

  const isMissingFee = !fee || parseFloat(fee) === 0;

  return (
    <tr className={`hover:bg-white/60 transition-colors group ${isMissingFee ? 'bg-orange-50/20' : 'bg-transparent'}`}>
      <td className="px-5 py-4 font-bold text-stone-800 whitespace-nowrap tracking-tight">{personName}</td>
      <td className="px-5 py-4 hidden sm:table-cell text-[9px] uppercase font-bold antialiased text-stone-500 tracking-widest">{roleDisplay}</td>
      <td className="px-5 py-4 hidden md:table-cell text-[9px] uppercase font-bold antialiased tracking-widest text-stone-400">{record.status}</td>
      
      <td className="px-5 py-4">
        <div className="flex items-center justify-end space-x-3">
          <div className="flex items-center gap-2">
            <input 
                type="number" value={fee} onChange={e => setFee(e.target.value)} placeholder="0.00"
                className={`w-28 px-3 py-2 text-sm text-right font-bold border rounded-xl outline-none transition-all shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] ${isMissingFee ? 'border-orange-300 focus:ring-2 focus:ring-orange-500/20 focus:border-orange-400 bg-white' : 'border-stone-200/80 focus:ring-2 focus:ring-[#002395]/20 focus:border-[#002395]/40 bg-white/50 backdrop-blur-sm'}`} 
            />
            <span className={`text-[9px] font-bold antialiased uppercase tracking-widest ${isMissingFee ? 'text-orange-500' : 'text-stone-400'}`}>PLN</span>
          </div>
          <button 
            onClick={handleSaveFee} disabled={isSaving || parseFloat(fee || 0) === parseFloat(record.fee || 0)} 
            className={`px-4 py-2.5 text-[9px] uppercase tracking-widest font-bold antialiased rounded-xl transition-all active:scale-95 shadow-sm ${saveSuccess ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : (parseFloat(fee || 0) !== parseFloat(record.fee || 0) && fee !== '') ? 'bg-[#002395] text-white hover:bg-[#001766] shadow-[0_4px_10px_rgba(0,35,149,0.3)]' : 'bg-stone-100 text-stone-400 border border-stone-200 disabled:opacity-50 disabled:shadow-none'}`}
          >
            {saveSuccess ? 'Zapisano' : 'Zapisz'}
          </button>
        </div>
      </td>
      
      <td className="px-5 py-4 text-right">
        <button 
          onClick={() => onDownload(record.id, personName, type)} disabled={isMissingFee}
          className="inline-flex items-center gap-2 justify-center w-full sm:w-auto text-[9px] font-bold antialiased uppercase tracking-widest bg-white border border-stone-200/80 text-stone-600 hover:text-[#002395] hover:border-[#002395]/40 hover:shadow-md disabled:opacity-50 px-4 py-2.5 rounded-xl transition-all shadow-sm active:scale-95"
        >
          <FileText size={14}/> PDF
        </button>
      </td>
    </tr>
  );
}