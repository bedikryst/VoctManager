/**
 * @file Resources.jsx
 * @description Foundation Resources & Wardrobe Regulations Module.
 * Implements a static File Explorer UI pattern for organizational documents,
 * dress code guidelines, and onboarding materials.
 * UI UPGRADE 2026: Glassmorphism containers, antialiased micro-typography, 
 * Editorial Headers, and natural text wrapping for long document titles.
 * @module core/Resources
 * @author Krystian Bugalski
 */

import { motion } from 'framer-motion';
import { FileText, Download, Shirt, BookOpen, Archive } from 'lucide-react';

export default function Resources() {
  
  // Static configuration representing the Foundation's CMS structure
  const documentCategories = [
    {
      id: 'wardrobe',
      title: 'Garderoba i Dress Code',
      icon: <Shirt size={20} className="text-purple-600" />,
      bgColor: 'bg-purple-50/50',
      borderColor: 'border-purple-200/60',
      iconColor: 'text-purple-600',
      description: 'Wytyczne dotyczące ujednoliconego stroju koncertowego oraz zasady dbania o powierzone elementy garderoby.',
      files: [
        { id: 1, title: 'Przewodnik: Suknia Chóralna (Sopran / Alt)', type: 'PDF', size: '2.4 MB' },
        { id: 2, title: 'Wytyczne: Frak i Muszka (Tenor / Bas)', type: 'PDF', size: '1.1 MB' }
      ]
    },
    {
      id: 'regulations',
      title: 'Regulaminy i Statuty',
      icon: <BookOpen size={20} className="text-[#002395]" />,
      bgColor: 'bg-blue-50/50',
      borderColor: 'border-blue-200/60',
      iconColor: 'text-[#002395]',
      description: 'Oficjalne dokumenty fundacji, zasady współpracy, polityka prywatności oraz regulaminy uczestnictwa w próbach.',
      files: [
        { id: 3, title: 'Statut Fundacji (Wersja 2026 - Zaktualizowany po walnym zgromadzeniu zarządu)', type: 'PDF', size: '4.5 MB' },
        { id: 4, title: 'Regulamin Chórzysty i Zasady Obecności', type: 'PDF', size: '850 KB' },
        { id: 5, title: 'Polityka Przetwarzania Danych Osobowych (RODO)', type: 'PDF', size: '1.2 MB' }
      ]
    }
  ];

  const glassCardStyle = "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl relative overflow-hidden";

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto cursor-default">
      
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
          <motion.div initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: "easeOut" }}>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                  <Archive size={12} className="text-[#002395]" />
                  <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                      Baza Wiedzy i Dokumenty
                  </p>
              </div>
              <h1 className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight" style={{ fontFamily: "'Cormorant', serif" }}>
                  Zasoby <span className="italic text-[#002395]">Fundacji</span>.
              </h1>
          </motion.div>
      </header>

      {/* --- CATEGORIES GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {documentCategories.map((category, index) => (
              <motion.div 
                  key={category.id}
                  initial={{ opacity: 0, y: 15 }} 
                  animate={{ opacity: 1, y: 0 }} 
                  transition={{ delay: index * 0.1 }}
                  className={`${glassCardStyle} p-6 md:p-8 flex flex-col h-full`}
              >
                  {/* Background Watermark */}
                  <div className={`absolute -right-8 -top-8 opacity-[0.03] pointer-events-none transition-transform duration-700 ${category.iconColor}`}>
                      {category.icon.type.render({ size: 160, strokeWidth: 1 })}
                  </div>

                  <div className="relative z-10 flex-1 flex flex-col">
                      <div className="flex items-start gap-4 mb-4">
                          <div className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm ${category.bgColor} ${category.borderColor}`}>
                              {category.icon}
                          </div>
                          <div>
                              <h3 className="text-xl font-bold text-stone-900 tracking-tight">{category.title}</h3>
                              <p className="text-xs text-stone-500 mt-1 leading-relaxed max-w-sm">{category.description}</p>
                          </div>
                      </div>

                      <div className="mt-auto pt-6 space-y-3">
                          {category.files.map((file) => (
                              <div 
                                  key={file.id} 
                                  className="group flex items-stretch justify-between p-4 bg-white/60 backdrop-blur-sm border border-stone-200/60 rounded-xl hover:bg-white hover:border-[#002395]/30 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                              >
                                  {/* Align items to start so icon stays up when text wraps */}
                                  <div className="flex items-start gap-4 overflow-hidden pr-4 flex-1">
                                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-colors flex-shrink-0 ${category.bgColor} ${category.borderColor} ${category.iconColor} group-hover:bg-[#002395] group-hover:border-[#001766] group-hover:text-white`}>
                                          <FileText size={16} />
                                      </div>
                                      <div className="min-w-0 flex-1 pt-0.5">
                                          <p 
                                            className="text-sm font-bold text-stone-800 group-hover:text-[#002395] transition-colors tracking-tight leading-snug"
                                            title={file.title}
                                          >
                                              {file.title}
                                          </p>
                                          <div className="flex items-center gap-2 mt-1.5">
                                              <span className="text-[8px] font-bold antialiased uppercase tracking-widest text-stone-500 bg-stone-100/80 px-2 py-0.5 rounded-md border border-stone-200/50">
                                                  {file.type}
                                              </span>
                                              <span className="text-[9px] font-bold antialiased text-stone-400 tracking-widest uppercase">{file.size}</span>
                                          </div>
                                      </div>
                                  </div>
                                  <button className="text-stone-400 group-hover:text-[#002395] bg-white p-2.5 rounded-xl border border-stone-200/60 shadow-sm transition-all active:scale-95 flex-shrink-0 self-center">
                                      <Download size={16} />
                                  </button>
                              </div>
                          ))}
                      </div>
                  </div>
              </motion.div>
          ))}
      </div>

    </div>
  );
}