/**
 * Program Builder (Setlist Creator) Module
 * Author: Krystian Bugalski
 * * Pozwala dyrygentowi na dynamiczne budowanie programu koncertowego.
 * Ulepszony o Drag & Drop za pomocą Framer Motion - pełna swoboda układania!
 */

import { useState, useEffect } from 'react';
import { Reorder, AnimatePresence } from 'framer-motion';
import { ListOrdered, Music, Plus, Trash2, GripVertical } from 'lucide-react';
import api from '../../utils/api';

export default function ProgramBuilder() {
  const [projects, setProjects] = useState([]);
  const [pieces, setPieces] = useState([]);
  const [programItems, setProgramItems] = useState([]);
  
  const [selectedProjectId, setSelectedProjectId] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [statusMsg, setStatusMsg] = useState({ type: '', text: '' });

  // Formularz dodawania nowego utworu do programu
  const [newPieceId, setNewPieceId] = useState('');
  const [isEncore, setIsEncore] = useState(false);

  // 1. Pobieranie list Projektów i Repertuaru
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [projRes, piecesRes] = await Promise.all([
          api.get('/api/projects/'),
          api.get('/api/pieces/')
        ]);
        setProjects(projRes.data);
        setPieces(piecesRes.data);
      } catch (err) {
        console.error("Błąd ładowania danych:", err);
      }
    };
    fetchInitialData();
  }, []);

  // 2. Pobieranie Programu dla Projektu
  useEffect(() => {
    if (!selectedProjectId) {
      setProgramItems([]);
      return;
    }

    const fetchProgram = async () => {
      setIsLoading(true);
      try {
        const res = await api.get(`/api/program-items/?project=${selectedProjectId}`);
        // Upewniamy się, że po pobraniu lista jest posortowana po 'order'
        const sorted = res.data.sort((a, b) => a.order - b.order);
        setProgramItems(sorted);
      } catch (err) {
        console.error("Błąd ładowania programu:", err);
      }
      setIsLoading(false);
    };

    fetchProgram();
  }, [selectedProjectId]);

  // 3. Dodawanie utworu (zawsze na sam koniec listy!)
  const handleAddItem = async (e) => {
    e.preventDefault();
    if (!newPieceId) return;
    setStatusMsg({ type: '', text: '' });

    try {
      // Automatycznie przypisujemy ostatni numer + 1
      const nextOrder = programItems.length > 0 ? programItems[programItems.length - 1].order + 1 : 1;

      const payload = {
        project: selectedProjectId,
        piece: newPieceId,
        order: nextOrder,
        is_encore: isEncore
      };

      const res = await api.post('/api/program-items/', payload);
      
      setProgramItems([...programItems, res.data]);
      
      setNewPieceId('');
      setIsEncore(false);
      setStatusMsg({ type: 'success', text: 'Utwór dodany na koniec setlisty!' });
      setTimeout(() => setStatusMsg({ type: '', text: '' }), 2000);
    } catch (err) {
      console.error(err);
      setStatusMsg({ type: 'error', text: 'Błąd dodawania utworu.' });
    }
  };

  // 4. Usuwanie utworu
  const handleDeleteItem = async (itemId) => {
    try {
      await api.delete(`/api/program-items/${itemId}/`);
      setProgramItems(programItems.filter(item => item.id !== itemId));
    } catch (err) {
      console.error("Błąd usuwania:", err);
      setStatusMsg({ type: 'error', text: 'Nie udało się usunąć utworu.' });
    }
  };

  // 5. DRAG & DROP: Aktualizacja kolejności
  const handleReorder = async (newOrderList) => {
    // 1. Natychmiastowo aktualizujemy stan lokalny (płynność dla użytkownika)
    setProgramItems(newOrderList);

    // 2. Szukamy, które elementy faktycznie zmieniły swój numer 'order'
    const updates = newOrderList.map((item, index) => {
      const expectedOrder = index + 1;
      if (item.order !== expectedOrder) {
        // Zwracamy obiekt z uaktualnionym order, żeby zaktualizować też stan lokalny
        item.order = expectedOrder; 
        // Generujemy request do backendu (częściowy update za pomocą PATCH)
        return api.patch(`/api/program-items/${item.id}/`, { order: expectedOrder });
      }
      return null;
    }).filter(Boolean); // odrzucamy nulle

    // 3. Wysyłamy do backendu tylko to, co się zmieniło
    if (updates.length > 0) {
      try {
        await Promise.all(updates);
        setStatusMsg({ type: 'success', text: 'Zapisano nową kolejność!' });
        setTimeout(() => setStatusMsg({ type: '', text: '' }), 1500);
      } catch (err) {
        console.error("Błąd podczas zapisywania kolejności:", err);
        setStatusMsg({ type: 'error', text: 'Błąd podczas synchronizacji kolejności z serwerem.' });
      }
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex justify-between items-end border-b border-stone-200 pb-2 mb-6">
        <h2 className="text-xl font-serif font-bold text-stone-800">Kreator Programu Koncertu</h2>
      </div>

      {statusMsg.text && (
        <div className={`p-4 rounded-sm text-sm font-medium mb-6 border transition-colors ${statusMsg.type === 'success' ? 'bg-green-50 text-green-800 border-green-200' : 'bg-red-50 text-red-800 border-red-200'}`}>
          {statusMsg.text}
        </div>
      )}

      <div className="bg-white p-6 rounded-xl border border-stone-200 shadow-sm">
        
        {/* WYBÓR PROJEKTU */}
        <div className="mb-8 max-w-md">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-2">Wybierz wydarzenie (Projekt)</label>
          <select 
            value={selectedProjectId} 
            onChange={(e) => { setSelectedProjectId(e.target.value); setStatusMsg({ type: '', text: '' }); }} 
            className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:border-stone-500 focus:ring-1 focus:ring-stone-500 outline-none bg-stone-50 font-medium transition-all"
          >
            <option value="">-- Wybierz z listy --</option>
            {projects.map(p => <option key={p.id} value={p.id}>{p.title}</option>)}
          </select>
        </div>

        {selectedProjectId && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 border-t border-stone-100 pt-8">
            
            {/* LEWA KOLUMNA: Aktualna Setlista (DRAG & DROP) */}
            <div>
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2 mb-4">
                <ListOrdered size={16} className="text-[#002395]" /> Aktualna Setlista (Przeciągnij by zmienić)
              </h3>
              
              {isLoading ? (
                <p className="text-sm text-stone-400">Ładowanie programu...</p>
              ) : programItems.length > 0 ? (
                <Reorder.Group 
                  axis="y" 
                  values={programItems} 
                  onReorder={handleReorder} 
                  className="space-y-2"
                >
                  <AnimatePresence>
                    {programItems.map((item, index) => (
                      <Reorder.Item 
                        key={item.id}
                        value={item}
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="flex items-center justify-between p-3 bg-white border border-stone-200 rounded-lg shadow-sm hover:border-stone-300 hover:shadow-md transition-all cursor-grab active:cursor-grabbing group"
                      >
                        <div className="flex items-center gap-3 w-full">
                          {/* Ikona do chwytania (Grip) */}
                          <div className="text-stone-300 group-hover:text-[#002395] transition-colors cursor-grab">
                            <GripVertical size={18} />
                          </div>
                          
                          <span className="flex items-center justify-center w-6 h-6 rounded-full bg-stone-100 text-stone-500 font-bold text-xs flex-shrink-0">
                            {index + 1}
                          </span>
                          
                          <div className="flex-1">
                            <p className={`font-bold text-sm ${item.is_encore ? 'text-[#002395] italic' : 'text-stone-800'}`}>
                              {item.piece_title} {item.is_encore && '(BIS)'}
                            </p>
                          </div>
                        </div>
                        
                        <button 
                          onClick={() => handleDeleteItem(item.id)}
                          className="p-2 text-stone-400 hover:text-red-500 transition-colors rounded-md hover:bg-red-50 cursor-pointer z-10"
                          title="Usuń z programu"
                        >
                          <Trash2 size={16} />
                        </button>
                      </Reorder.Item>
                    ))}
                  </AnimatePresence>
                </Reorder.Group>
              ) : (
                <div className="p-8 border-2 border-dashed border-stone-200 rounded-xl text-center bg-stone-50">
                  <Music size={32} className="mx-auto text-stone-300 mb-2" />
                  <p className="text-sm text-stone-500">Program jest pusty.</p>
                  <p className="text-xs text-stone-400">Użyj formularza obok, aby dodać utwory.</p>
                </div>
              )}
            </div>

            {/* PRAWA KOLUMNA: Uproszczony Formularz Dodawania */}
            <div className="bg-stone-50 p-6 rounded-xl border border-stone-200 h-max sticky top-24">
              <h3 className="text-xs font-bold uppercase tracking-wider text-stone-800 flex items-center gap-2 mb-6">
                <Plus size={16} className="text-[#002395]" /> Dodaj do programu
              </h3>

              <form onSubmit={handleAddItem} className="space-y-4">
                {/* Wybór utworu z archiwum */}
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-widest text-stone-500 mb-1">Utwór z Archiwum</label>
                  <select 
                    required
                    value={newPieceId}
                    onChange={(e) => setNewPieceId(e.target.value)}
                    className="w-full px-3 py-2 text-sm border border-stone-300 rounded-md focus:border-[#002395] outline-none transition-all bg-white"
                  >
                    <option value="">Wybierz utwór...</option>
                    {pieces.map(piece => (
                      <option key={piece.id} value={piece.id}>
                        {piece.title} {piece.composer ? `(${typeof piece.composer === 'object' ? piece.composer.last_name : piece.composer})` : ''}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-4">
                  {/* Flaga BIS */}
                  <div className="flex-1 flex flex-col justify-end">
                    <label className="flex items-center gap-2 cursor-pointer p-3 border border-stone-300 rounded-md bg-white hover:bg-stone-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={isEncore}
                        onChange={(e) => setIsEncore(e.target.checked)}
                        className="w-4 h-4 text-[#002395] focus:ring-[#002395] border-stone-300 rounded"
                      />
                      <span className="text-xs font-bold uppercase tracking-widest text-stone-600">Czy to BIS?</span>
                    </label>
                  </div>
                </div>

                <button 
                  type="submit"
                  className="w-full mt-4 flex items-center justify-center gap-2 bg-stone-900 hover:bg-[#002395] text-white py-2.5 rounded-md text-xs font-bold uppercase tracking-widest transition-colors shadow-md"
                >
                  <Plus size={16} />
                  Wrzuć na koniec listy
                </button>
              </form>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}