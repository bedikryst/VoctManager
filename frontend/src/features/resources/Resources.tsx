/**
 * @file Resources.tsx
 * @description Foundation Resources & Wardrobe Regulations Module.
 * @architecture
 * Implements Role-Based Access Control (RBAC). Regular users see a read-only view,
 * while Administrators get CMS management tools.
 * ENTERPRISE UPGRADE 2026: TypeScript interfaces prepared for future CMS integration.
 * @module core/Resources
 * @author Krystian Bugalski
 */

import React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import {
  FileText,
  Download,
  Shirt,
  BookOpen,
  Archive,
  Info,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";

import { useAuth } from "../../app/providers/AuthProvider";

// --- Interfaces for Future CMS Integration ---
interface ResourceFile {
  id: number;
  title: string;
  type: string;
  size: string;
}

interface ResourceCategory {
  id: string;
  title: string;
  icon: React.ReactNode;
  bgColor: string;
  borderColor: string;
  iconColor: string;
  description: string;
  files: ResourceFile[];
}

// --- Static Mock Data ---
const DOCUMENT_CATEGORIES: ResourceCategory[] = [
  {
    id: "wardrobe",
    title: "Garderoba i Dress Code",
    icon: <Shirt size={20} className="text-purple-600" aria-hidden="true" />,
    bgColor: "bg-purple-50/50",
    borderColor: "border-purple-200/60",
    iconColor: "text-purple-600",
    description:
      "Wytyczne dotyczące ujednoliconego stroju koncertowego oraz zasady dbania o powierzone elementy garderoby.",
    files: [
      {
        id: 1,
        title: "Przewodnik: Suknia Chóralna (Sopran / Alt)",
        type: "PDF",
        size: "2.4 MB",
      },
      {
        id: 2,
        title: "Wytyczne: Frak i Muszka (Tenor / Bas)",
        type: "PDF",
        size: "1.1 MB",
      },
    ],
  },
  {
    id: "regulations",
    title: "Regulaminy i Statuty",
    icon: <BookOpen size={20} className="text-[#002395]" aria-hidden="true" />,
    bgColor: "bg-blue-50/50",
    borderColor: "border-blue-200/60",
    iconColor: "text-[#002395]",
    description:
      "Oficjalne dokumenty fundacji, zasady współpracy, polityka prywatności oraz regulaminy uczestnictwa w próbach.",
    files: [
      {
        id: 3,
        title:
          "Statut Fundacji (Wersja 2026 - Zaktualizowany po walnym zgromadzeniu zarządu)",
        type: "PDF",
        size: "4.5 MB",
      },
      {
        id: 4,
        title: "Regulamin Chórzysty i Zasady Obecności",
        type: "PDF",
        size: "850 KB",
      },
      {
        id: 5,
        title: "Polityka Przetwarzania Danych Osobowych (RODO)",
        type: "PDF",
        size: "1.2 MB",
      },
    ],
  },
];

// --- Static Styles ---
const STYLE_GLASS_CARD =
  "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl relative overflow-hidden";

/**
 * Resources Component
 * @returns {React.JSX.Element}
 */
export default function Resources(): React.JSX.Element {
  const { user } = useAuth();
  const isAdmin = user?.is_admin;

  // Placeholder handler for Admin actions
  const handleAdminAction = () => {
    toast.info("Moduł CMS w przygotowaniu", {
      description:
        "Możliwość wgrywania i edycji plików na serwerze zostanie aktywowana po podpięciu docelowego API.",
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto cursor-default">
      {/* --- EDITORIAL HEADER --- */}
      <header className="relative pt-2 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                <Archive
                  size={12}
                  className="text-[#002395]"
                  aria-hidden="true"
                />
                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-[#002395]/80">
                  Baza Wiedzy i Dokumenty
                </p>
              </div>
              <h1
                className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                Zasoby <span className="italic text-[#002395]">Fundacji</span>.
              </h1>
            </div>

            {/* ADMIN ACTION: Add Category */}
            {isAdmin && (
              <button
                onClick={handleAdminAction}
                className="flex items-center gap-2 bg-[#002395] hover:bg-[#001766] text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95"
              >
                <Plus size={16} aria-hidden="true" /> Dodaj Kategorię
              </button>
            )}
          </div>
        </motion.div>
      </header>

      {/* --- PLACEHOLDER INFO BANNER --- */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-blue-50/80 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm"
      >
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-100 text-[#002395]">
          <Info size={20} aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold antialiased uppercase tracking-widest text-[#002395] mb-1">
            Sekcja Poglądowa (Wersja Demo)
          </h4>
          <p className="text-sm text-stone-600 font-medium leading-relaxed">
            Widoczna poniżej struktura plików ma charakter makiety. Prawdziwe,
            docelowe dokumenty, umowy i regulaminy fundacji zostaną wgrane w
            późniejszym etapie wdrożenia CMS.
          </p>
        </div>
      </motion.div>

      {/* --- CATEGORIES GRID --- */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {DOCUMENT_CATEGORIES.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className={`${STYLE_GLASS_CARD} p-6 md:p-8 flex flex-col h-full group`}
          >
            {/* Background Watermark */}
            <div
              className={`absolute -right-8 -top-8 opacity-[0.03] pointer-events-none transition-transform duration-700 ${category.iconColor}`}
              aria-hidden="true"
            >
              {React.isValidElement(category.icon) &&
                React.cloneElement(
                  category.icon as React.ReactElement,
                  { size: 160, strokeWidth: 1 } as any,
                )}
            </div>

            <div className="relative z-10 flex-1 flex flex-col">
              <div className="flex justify-between items-start mb-4">
                <div className="flex items-start gap-4">
                  <div
                    className={`w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm ${category.bgColor} ${category.borderColor}`}
                  >
                    {category.icon}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-stone-900 tracking-tight">
                      {category.title}
                    </h3>
                    <p className="text-xs text-stone-500 mt-1 leading-relaxed max-w-sm">
                      {category.description}
                    </p>
                  </div>
                </div>

                {/* ADMIN ACTION: Edit/Delete Category */}
                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handleAdminAction}
                      className="p-2 text-stone-400 hover:text-[#002395] hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label="Edytuj kategorię"
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <button
                      onClick={handleAdminAction}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label="Usuń kategorię"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-auto pt-6 space-y-3">
                {category.files.map((file) => (
                  <div
                    key={file.id}
                    className="group/file flex items-stretch justify-between p-4 bg-white/60 backdrop-blur-sm border border-stone-200/60 rounded-xl hover:bg-white hover:border-[#002395]/30 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex items-start gap-4 overflow-hidden pr-4 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-colors flex-shrink-0 ${category.bgColor} ${category.borderColor} ${category.iconColor} group-hover/file:bg-[#002395] group-hover/file:border-[#001766] group-hover/file:text-white`}
                      >
                        <FileText size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p
                          className="text-sm font-bold text-stone-800 group-hover/file:text-[#002395] transition-colors tracking-tight leading-snug"
                          title={file.title}
                        >
                          {file.title}
                        </p>
                        <div className="flex items-center gap-2 mt-1.5">
                          <span className="text-[8px] font-bold antialiased uppercase tracking-widest text-stone-500 bg-stone-100/80 px-2 py-0.5 rounded-md border border-stone-200/50">
                            {file.type}
                          </span>
                          <span className="text-[9px] font-bold antialiased text-stone-400 tracking-widest uppercase">
                            {file.size}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 self-center flex-shrink-0">
                      {/* ADMIN ACTION: Delete File */}
                      {isAdmin && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleAdminAction();
                          }}
                          className="text-stone-300 hover:text-red-600 bg-white p-2.5 rounded-xl border border-stone-200/60 shadow-sm transition-all active:scale-95 opacity-0 group-hover/file:opacity-100"
                          aria-label="Usuń plik"
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                      {/* STANDARD ACTION: Download */}
                      <button
                        className="text-stone-400 group-hover/file:text-[#002395] bg-white p-2.5 rounded-xl border border-stone-200/60 shadow-sm transition-all active:scale-95"
                        aria-label={`Pobierz ${file.title}`}
                      >
                        <Download size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}

                {/* ADMIN ACTION: Add File to Category */}
                {isAdmin && (
                  <button
                    onClick={handleAdminAction}
                    className="w-full py-3 mt-2 border-2 border-dashed border-stone-300 text-stone-400 hover:text-[#002395] hover:border-[#002395]/40 hover:bg-blue-50/50 rounded-xl text-[10px] uppercase font-bold antialiased tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Plus size={14} aria-hidden="true" /> Dodaj nowy dokument
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    </div>
  );
}
