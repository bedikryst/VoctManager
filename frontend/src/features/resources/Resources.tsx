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
  Info,
  Plus,
  Edit2,
  Trash2,
} from "lucide-react";

import { useAuth } from "../../app/providers/AuthProvider";
import { isManager } from "@/shared/auth/rbac";

// UI Primitives & Composites
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Eyebrow, Text, Heading } from "@/shared/ui/primitives/typography";
import { cn } from "@/shared/lib/utils";

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
  accentClass: string;
  description: string;
  files: ResourceFile[];
}

export default function Resources(): React.JSX.Element {
  const { t } = useTranslation();
  const { user } = useAuth();
  const isAdmin = isManager(user);

  // TODO: Tech Debt - W przyszłości przenieś to do useResourcesData() hook
  const documentCategories = useMemo<ResourceCategory[]>(
    () => [
      {
        id: "wardrobe",
        title: t(
          "resources.categories.wardrobe.title",
          "Garderoba i Dress Code",
        ),
        icon: <Shirt size={20} aria-hidden="true" />,
        accentClass:
          "text-ethereal-amethyst border-ethereal-amethyst/30 bg-ethereal-amethyst/10",
        description: t(
          "resources.categories.wardrobe.description",
          "Wytyczne dotyczące ujednoliconego stroju koncertowego oraz zasady dbania o powierzone elementy.",
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
        icon: <BookOpen size={20} aria-hidden="true" />,
        accentClass:
          "text-ethereal-ink border-ethereal-ink/20 bg-ethereal-ink/5",
        description: t(
          "resources.categories.regulations.description",
          "Oficjalne dokumenty fundacji, zasady współpracy oraz regulaminy uczestnictwa w próbach.",
        ),
        files: [
          {
            id: 3,
            title: t(
              "resources.categories.regulations.files.statute",
              "Statut Fundacji (Wersja 2026)",
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
        "Możliwość wgrywania i edycji plików zostanie aktywowana po podpięciu API.",
      ),
    });
  };

  return (
    <PageTransition>
      <div className="max-w-5xl mx-auto px-4 md:px-6 pb-24 cursor-default space-y-8">
        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="pt-6 flex flex-col md:flex-row justify-between items-start md:items-end gap-5">
          <div>
            <PageHeader
              size="standard"
              roleText={t(
                "resources.dashboard.badge",
                "Baza wiedzy i dokumenty",
              )}
              title={t("resources.dashboard.title", "Zasoby")}
              titleHighlight={t(
                "resources.dashboard.title_highlight",
                "Fundacji.",
              )}
            />
            <Text color="muted" size="sm" className="mt-2 ml-1 max-w-lg">
              {t(
                "resources.dashboard.description",
                "Przeglądaj oficjalne dokumenty, regulaminy i wytyczne niezbędne do funkcjonowania w zespole.",
              )}
            </Text>
          </div>

          {isAdmin && (
            <button
              onClick={handleAdminAction}
              className="flex items-center gap-2 bg-ethereal-ink text-white text-[10px] uppercase tracking-widest font-bold antialiased py-2.5 px-5 rounded-xl transition-all shadow-glass-solid hover:-translate-y-0.5 active:scale-95"
            >
              <Plus size={16} aria-hidden="true" />
              {t("resources.actions.add_category", "Dodaj kategorię")}
            </button>
          )}
        </div>

        {/* ── Demo Banner ──────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
        >
          <GlassCard
            variant="ethereal"
            className="flex flex-col sm:flex-row items-start sm:items-center gap-4 p-5"
          >
            <div className="w-10 h-10 rounded-full bg-ethereal-alabaster flex items-center justify-center flex-shrink-0 shadow-glass-soft border border-ethereal-marble text-ethereal-graphite">
              <Info size={20} aria-hidden="true" />
            </div>
            <div>
              <Eyebrow color="default" className="mb-1 text-[11px]">
                {t("resources.banner.title", "Sekcja poglądowa (wersja demo)")}
              </Eyebrow>
              <Text size="sm" color="graphite">
                {t(
                  "resources.banner.description",
                  "Widoczna poniżej struktura plików ma charakter makiety. Docelowe dokumenty i umowy zostaną wgrane po wdrożeniu pełnego modułu CMS.",
                )}
              </Text>
            </div>
          </GlassCard>
        </motion.div>

        {/* ── Categories Grid ──────────────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {documentCategories.map((category, index) => (
            <motion.div
              key={category.id}
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 + index * 0.1 }}
              className="h-full"
            >
              <GlassCard
                variant="ethereal"
                padding="lg"
                className="flex flex-col h-full group relative overflow-hidden"
              >
                {/* Dekoracyjna ikona w tle */}
                <div
                  className="absolute -right-8 -top-8 opacity-[0.03] pointer-events-none transition-transform duration-700 text-ethereal-ink"
                  aria-hidden="true"
                >
                  {React.isValidElement(category.icon) &&
                    React.cloneElement(category.icon as React.ReactElement, {})}
                </div>

                <div className="relative z-10 flex-1 flex flex-col">
                  {/* Category Header */}
                  <div className="flex justify-between items-start mb-6">
                    <div className="flex items-start gap-4">
                      <div
                        className={cn(
                          "w-12 h-12 rounded-2xl flex items-center justify-center flex-shrink-0 border shadow-sm",
                          category.accentClass,
                        )}
                      >
                        {category.icon}
                      </div>
                      <div>
                        <Heading
                          size="lg"
                          className="tracking-tight text-ethereal-ink"
                        >
                          {category.title}
                        </Heading>
                        <Text
                          size="xs"
                          color="muted"
                          className="mt-1 leading-relaxed max-w-[280px]"
                        >
                          {category.description}
                        </Text>
                      </div>
                    </div>

                    {isAdmin && (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={handleAdminAction}
                          className="p-2 text-ethereal-graphite/50 hover:text-ethereal-ink hover:bg-white/50 rounded-lg transition-colors"
                          aria-label={t(
                            "resources.actions.edit_category",
                            "Edytuj kategorię",
                          )}
                        >
                          <Edit2 size={14} aria-hidden="true" />
                        </button>
                        <button
                          onClick={handleAdminAction}
                          className="p-2 text-ethereal-graphite/50 hover:text-red-500 hover:bg-red-50/50 rounded-lg transition-colors"
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

                  {/* File List */}
                  <div className="mt-auto pt-4 space-y-3">
                    {category.files.map((file) => (
                      <div
                        key={file.id}
                        className="group/file flex items-stretch justify-between p-4 bg-white/40 backdrop-blur-md border border-ethereal-incense/20 rounded-xl hover:bg-white/80 hover:border-ethereal-gold/30 hover:shadow-glass-soft transition-all cursor-pointer active:scale-[0.99]"
                      >
                        <div className="flex items-start gap-4 overflow-hidden pr-4 flex-1">
                          <div
                            className={cn(
                              "w-10 h-10 rounded-xl flex items-center justify-center border shadow-sm transition-colors flex-shrink-0 group-hover/file:bg-ethereal-ink group-hover/file:text-white group-hover/file:border-transparent",
                              category.accentClass,
                            )}
                          >
                            <FileText size={16} aria-hidden="true" />
                          </div>
                          <div className="min-w-0 flex-1 pt-0.5">
                            <Text
                              size="sm"
                              weight="semibold"
                              className="text-ethereal-ink truncate group-hover/file:text-ethereal-ink/80 transition-colors"
                              title={file.title}
                            >
                              {file.title}
                            </Text>
                            <div className="flex items-center gap-2 mt-1">
                              <span className="text-[9px] font-bold antialiased uppercase tracking-widest text-ethereal-graphite/70">
                                {file.type}
                              </span>
                              <span className="w-1 h-1 rounded-full bg-ethereal-incense/30" />
                              <span className="text-[9px] font-bold antialiased text-ethereal-graphite/50 tracking-widest uppercase">
                                {file.size}
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 self-center flex-shrink-0">
                          {isAdmin && (
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAdminAction();
                              }}
                              className="text-ethereal-graphite/40 hover:text-red-500 bg-white/50 p-2.5 rounded-lg border border-ethereal-incense/10 shadow-sm transition-all active:scale-95 opacity-0 group-hover/file:opacity-100"
                              aria-label={t(
                                "resources.actions.delete_file",
                                "Usuń plik",
                              )}
                            >
                              <Trash2 size={16} aria-hidden="true" />
                            </button>
                          )}
                          <button
                            className="text-ethereal-graphite/60 group-hover/file:text-ethereal-ink bg-white/50 p-2.5 rounded-lg border border-ethereal-incense/10 shadow-sm transition-all active:scale-95"
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
                        className="w-full py-3 mt-2 border border-dashed border-ethereal-incense/30 text-ethereal-graphite/50 hover:text-ethereal-ink hover:border-ethereal-ink/30 hover:bg-white/40 rounded-xl text-[10px] uppercase font-bold antialiased tracking-widest transition-all flex items-center justify-center gap-2 active:scale-95"
                      >
                        <Plus size={14} aria-hidden="true" />
                        {t(
                          "resources.actions.add_document",
                          "Dodaj nowy dokument",
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </GlassCard>
            </motion.div>
          ))}
        </div>
      </div>
    </PageTransition>
  );
}
