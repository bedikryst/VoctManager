/**
 * @file Resources.tsx
 * @description Foundation resources and wardrobe regulations module.
 * @architecture
 * Implements role-based access control. Regular users see a read-only view,
 * while administrators get CMS management actions.
 * @module core/Resources
 */

import React, { useMemo } from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
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
import { isManager } from "@/shared/auth/rbac";

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

const STYLE_GLASS_CARD =
  "bg-white/70 backdrop-blur-xl border border-white/60 shadow-[0_4px_20px_rgb(0,0,0,0.03)] shadow-[inset_0_1px_0_rgba(255,255,255,0.8)] rounded-2xl relative overflow-hidden";

export default function Resources(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = isManager(user);

  const documentCategories = useMemo<ResourceCategory[]>(
    () => [
      {
        id: "wardrobe",
        title: t(
          "resources.categories.wardrobe.title",
          "Garderoba i Dress Code",
        ),
        icon: (
          <Shirt size={20} className="text-purple-600" aria-hidden="true" />
        ),
        bgColor: "bg-purple-50/50",
        borderColor: "border-purple-200/60",
        iconColor: "text-purple-600",
        description: t(
          "resources.categories.wardrobe.description",
          "Wytyczne dotyczące ujednoliconego stroju koncertowego oraz zasady dbania o powierzone elementy garderoby.",
        ),
        files: [
          {
            id: 1,
            title: t(
              "resources.categories.wardrobe.files.dress_guide",
              "Przewodnik: Suknia Chóralna (Sopran / Alt)",
            ),
            type: "PDF",
            size: "2.4 MB",
          },
          {
            id: 2,
            title: t(
              "resources.categories.wardrobe.files.tuxedo_guide",
              "Wytyczne: Frak i Muszka (Tenor / Bas)",
            ),
            type: "PDF",
            size: "1.1 MB",
          },
        ],
      },
      {
        id: "regulations",
        title: t(
          "resources.categories.regulations.title",
          "Regulaminy i Statuty",
        ),
        icon: <BookOpen size={20} className="text-brand" aria-hidden="true" />,
        bgColor: "bg-blue-50/50",
        borderColor: "border-blue-200/60",
        iconColor: "text-brand",
        description: t(
          "resources.categories.regulations.description",
          "Oficjalne dokumenty fundacji, zasady współpracy, polityka prywatności oraz regulaminy uczestnictwa w próbach.",
        ),
        files: [
          {
            id: 3,
            title: t(
              "resources.categories.regulations.files.statute",
              "Statut Fundacji (Wersja 2026 - Zaktualizowany po walnym zgromadzeniu zarządu)",
            ),
            type: "PDF",
            size: "4.5 MB",
          },
          {
            id: 4,
            title: t(
              "resources.categories.regulations.files.choir_rules",
              "Regulamin Chórzysty i Zasady Obecności",
            ),
            type: "PDF",
            size: "850 KB",
          },
          {
            id: 5,
            title: t(
              "resources.categories.regulations.files.gdpr",
              "Polityka Przetwarzania Danych Osobowych (RODO)",
            ),
            type: "PDF",
            size: "1.2 MB",
          },
        ],
      },
    ],
    [t],
  );

  const handleAdminAction = () => {
    toast.info(t("resources.cms.title", "Moduł CMS w przygotowaniu"), {
      description: t(
        "resources.cms.description",
        "Możliwość wgrywania i edycji plików na serwerze zostanie aktywowana po podpięciu docelowego API.",
      ),
    });
  };

  return (
    <div className="space-y-8 animate-fade-in pb-12 max-w-5xl mx-auto cursor-default">
      <header className="relative pt-2 mb-8">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, ease: "easeOut" }}
        >
          <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/80 backdrop-blur-md border border-white/60 shadow-sm mb-4">
                <Archive size={12} className="text-brand" aria-hidden="true" />
                <p className="text-[9px] uppercase tracking-widest font-bold antialiased text-brand/80">
                  {t("resources.dashboard.badge", "Baza wiedzy i dokumenty")}
                </p>
              </div>
              <h1
                className="text-3xl md:text-4xl font-medium text-stone-900 leading-tight tracking-tight"
                style={{ fontFamily: "'Cormorant', serif" }}
              >
                {t("resources.dashboard.title", "Zasoby")}{" "}
                <span className="italic text-brand">
                  {t("resources.dashboard.title_highlight", "Fundacji")}
                </span>
                .
              </h1>
            </div>

            {isAdmin && (
              <button
                onClick={handleAdminAction}
                className="flex items-center gap-2 bg-brand hover:bg-brand-dark text-white text-[10px] uppercase tracking-widest font-bold antialiased py-3 px-6 rounded-xl transition-all shadow-[0_4px_14px_rgba(0,35,149,0.3)] hover:shadow-[0_6px_20px_rgba(0,35,149,0.4)] hover:-translate-y-0.5 active:scale-95"
              >
                <Plus size={16} aria-hidden="true" />{" "}
                {t("resources.actions.add_category", "Dodaj kategorię")}
              </button>
            )}
          </div>
        </motion.div>
      </header>

      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="bg-blue-50/80 backdrop-blur-md border border-blue-200/80 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4 shadow-sm"
      >
        <div className="w-10 h-10 rounded-full bg-white flex items-center justify-center flex-shrink-0 shadow-sm border border-blue-100 text-brand">
          <Info size={20} aria-hidden="true" />
        </div>
        <div>
          <h4 className="text-[11px] font-bold antialiased uppercase tracking-widest text-brand mb-1">
            {t("resources.banner.title", "Sekcja poglądowa (wersja demo)")}
          </h4>
          <p className="text-sm text-stone-600 font-medium leading-relaxed">
            {t(
              "resources.banner.description",
              "Widoczna poniżej struktura plików ma charakter makiety. Prawdziwe, docelowe dokumenty, umowy i regulaminy fundacji zostaną wgrane w późniejszym etapie wdrożenia CMS.",
            )}
          </p>
        </div>
      </motion.div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {documentCategories.map((category, index) => (
          <motion.div
            key={category.id}
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 + index * 0.1 }}
            className={`${STYLE_GLASS_CARD} p-6 md:p-8 flex flex-col h-full group`}
          >
            <div
              className={`absolute -right-8 -top-8 opacity-[0.03] pointer-events-none transition-transform duration-700 ${category.iconColor}`}
              aria-hidden="true"
            >
              {React.isValidElement(category.icon) &&
                React.cloneElement(
                  category.icon as React.ReactElement,
                  {
                    size: 160,
                    strokeWidth: 1,
                  } as React.SVGProps<SVGSVGElement>,
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

                {isAdmin && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={handleAdminAction}
                      className="p-2 text-stone-400 hover:text-brand hover:bg-blue-50 rounded-lg transition-colors"
                      aria-label={t(
                        "resources.actions.edit_category",
                        "Edytuj kategorię",
                      )}
                    >
                      <Edit2 size={14} aria-hidden="true" />
                    </button>
                    <button
                      onClick={handleAdminAction}
                      className="p-2 text-stone-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                      aria-label={t(
                        "resources.actions.delete_category",
                        "Usuń kategorię",
                      )}
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
                    className="group/file flex items-stretch justify-between p-4 bg-white/60 backdrop-blur-sm border border-stone-200/60 rounded-xl hover:bg-white hover:border-brand/30 hover:shadow-md transition-all cursor-pointer active:scale-[0.98]"
                  >
                    <div className="flex items-start gap-4 overflow-hidden pr-4 flex-1">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center border shadow-[inset_0_1px_2px_rgba(0,0,0,0.02)] transition-colors flex-shrink-0 ${category.bgColor} ${category.borderColor} ${category.iconColor} group-hover/file:bg-brand group-hover/file:border-brand-dark group-hover/file:text-white`}
                      >
                        <FileText size={16} aria-hidden="true" />
                      </div>
                      <div className="min-w-0 flex-1 pt-0.5">
                        <p
                          className="text-sm font-bold text-stone-800 group-hover/file:text-brand transition-colors tracking-tight leading-snug"
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
                      {isAdmin && (
                        <button
                          onClick={(event) => {
                            event.stopPropagation();
                            handleAdminAction();
                          }}
                          className="text-stone-300 hover:text-red-600 bg-white p-2.5 rounded-xl border border-stone-200/60 shadow-sm transition-all active:scale-95 opacity-0 group-hover/file:opacity-100"
                          aria-label={t(
                            "resources.actions.delete_file",
                            "Usuń plik",
                          )}
                        >
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      )}
                      <button
                        className="text-stone-400 group-hover/file:text-brand bg-white p-2.5 rounded-xl border border-stone-200/60 shadow-sm transition-all active:scale-95"
                        aria-label={t(
                          "resources.actions.download_file",
                          "Pobierz {{title}}",
                          { title: file.title },
                        )}
                      >
                        <Download size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                ))}

                {isAdmin && (
                  <button
                    onClick={handleAdminAction}
                    className="w-full py-3 mt-2 border-2 border-dashed border-stone-300 text-stone-400 hover:text-brand hover:border-brand/40 hover:bg-blue-50/50 rounded-xl text-[10px] uppercase font-bold antialiased tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95"
                  >
                    <Plus size={14} aria-hidden="true" />{" "}
                    {t("resources.actions.add_document", "Dodaj nowy dokument")}
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
