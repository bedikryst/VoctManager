/**
 * @file InvitationDetailModal.tsx
 * @description Full-detail participation list modal, grouped by status.
 * Lazy-fetches data on open; reuses React Query artist/project cache.
 * @architecture Enterprise SaaS 2026
 * @module panel/dashboard/components/InvitationDetailModal
 */

import React, { useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Users, X, UserX, Clock, UserCheck, Mail, Phone } from "lucide-react";

import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import { Button } from "@/shared/ui/primitives/Button";
import {
  Eyebrow,
  Heading,
  Label,
  Text,
} from "@/shared/ui/primitives/typography";
import { useInvitationDetails } from "../hooks/useInvitationDetails";
import type { InvitationDetailRow } from "../hooks/useInvitationDetails";

interface InvitationDetailModalProps {
  isOpen: boolean;
  onClose: () => void;
}

interface StatusSectionProps {
  rows: InvitationDetailRow[];
  labelKey: string;
  labelFallback: string;
  color: "crimson" | "muted" | "gold";
  icon: React.ReactNode;
}

const StatusSection = ({
  rows,
  labelKey,
  labelFallback,
  color,
  icon,
}: StatusSectionProps): React.JSX.Element | null => {
  const { t } = useTranslation();

  if (rows.length === 0) return null;

  const sectionBg =
    color === "crimson"
      ? "bg-ethereal-crimson/5 border-ethereal-crimson/20"
      : color === "gold"
        ? "bg-ethereal-gold/5 border-ethereal-gold/20"
        : "bg-ethereal-parchment/60 border-ethereal-incense/15";

  return (
    <>
      <tr>
        <td colSpan={4} className={`border-y px-4 py-2 ${sectionBg}`}>
          <div className="flex items-center gap-2">
            <span
              className={
                color === "crimson"
                  ? "text-ethereal-crimson"
                  : color === "gold"
                    ? "text-ethereal-gold"
                    : "text-ethereal-graphite/60"
              }
            >
              {icon}
            </span>
            <Eyebrow color={color === "muted" ? "muted" : color}>
              {t(labelKey, labelFallback)} ({rows.length})
            </Eyebrow>
          </div>
        </td>
      </tr>
      {rows.map((row) => (
        <tr
          key={row.id}
          className="border-b border-ethereal-incense/10 transition-colors duration-200 hover:bg-ethereal-parchment/40"
        >
          <td className="px-4 py-2.5">
            <Text size="sm" truncate>
              {row.projectName}
            </Text>
          </td>
          <td className="px-4 py-2.5">
            <div className="flex flex-col">
              <Text size="sm" weight="medium" truncate>
                {row.artistName}
              </Text>
              {row.artistVoice && (
                <Label
                  color="muted"
                  size="xs"
                  className="uppercase tracking-tighter opacity-70"
                >
                  {row.artistVoice}
                </Label>
              )}
            </div>
          </td>
          <td className="px-4 py-2.5">
            {row.email ? (
              <a
                href={`mailto:${row.email}`}
                className="flex items-center gap-1.5 text-ethereal-sage transition-colors hover:text-ethereal-sage/80"
                onClick={(e) => e.stopPropagation()}
              >
                <Mail size={11} aria-hidden="true" className="shrink-0" />
                <Text size="sm" className="text-inherit truncate">
                  {row.email}
                </Text>
              </a>
            ) : (
              <Text size="sm" color="muted">
                —
              </Text>
            )}
          </td>
          <td className="px-4 py-2.5">
            {row.phone ? (
              <a
                href={`tel:${row.phone}`}
                className="flex items-center gap-1.5 text-ethereal-sage transition-colors hover:text-ethereal-sage/80"
                onClick={(e) => e.stopPropagation()}
              >
                <Phone size={11} aria-hidden="true" className="shrink-0" />
                <Text size="sm" className="text-inherit">
                  {row.phone}
                </Text>
              </a>
            ) : (
              <Text size="sm" color="muted">
                —
              </Text>
            )}
          </td>
        </tr>
      ))}
    </>
  );
};

export const InvitationDetailModal = ({
  isOpen,
  onClose,
}: InvitationDetailModalProps): React.ReactPortal | null => {
  const { t } = useTranslation();
  const titleId = useId();
  const [mounted, setMounted] = useState(false);

  useBodyScrollLock(isOpen);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  const { groups, totalCount, isLoading } = useInvitationDetails(isOpen);

  if (!mounted) return null;

  const isEmpty = totalCount === 0 && !isLoading;

  return createPortal(
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 md:p-8">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-ethereal-ink/50 backdrop-blur-sm"
            onClick={onClose}
            aria-hidden="true"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.97, y: 16 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.97, y: 16 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            className="relative flex w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-ethereal-incense/20 bg-ethereal-marble shadow-glass-solid"
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            style={{ maxHeight: "85vh" }}
          >
            {/* HEADER */}
            <div className="flex shrink-0 items-center justify-between border-b border-ethereal-incense/15 bg-ethereal-alabaster/60 px-6 py-4">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl border border-ethereal-gold/20 bg-ethereal-gold/10">
                  <Users
                    size={16}
                    className="text-ethereal-gold"
                    aria-hidden="true"
                  />
                </div>
                <div>
                  <Heading id={titleId} as="h2" size="lg" weight="bold">
                    {t("dashboard.admin.inv_modal_title", "Status Zaproszeń")}
                  </Heading>
                  <Eyebrow color="muted">
                    {t(
                      "dashboard.admin.inv_modal_subtitle",
                      "Aktywne projekty · {{count}} uczestników",
                      { count: totalCount },
                    )}
                  </Eyebrow>
                </div>
              </div>

              <Button
                type="button"
                variant="ghost"
                size="icon"
                onClick={onClose}
                aria-label={t("common.actions.close", "Zamknij")}
              >
                <X size={18} aria-hidden="true" />
              </Button>
            </div>

            {/* BODY - ADDED overscroll-contain and pointer-events-auto */}
            <div className=" min-h-0 flex-1 overflow-y-auto overscroll-contain pointer-events-auto">
              {isLoading ? (
                <div className="flex h-48 items-center justify-center">
                  <EtherealLoader
                    message={t(
                      "dashboard.admin.inv_loading",
                      "Ładowanie listy...",
                    )}
                  />
                </div>
              ) : isEmpty ? (
                <div className="flex h-48 flex-col items-center justify-center gap-2 opacity-60">
                  <UserCheck
                    size={28}
                    className="text-ethereal-graphite/40"
                    aria-hidden="true"
                  />
                  <Eyebrow color="muted">
                    {t(
                      "dashboard.admin.inv_empty",
                      "Brak uczestników do wyświetlenia",
                    )}
                  </Eyebrow>
                </div>
              ) : (
                <table className="w-full border-collapse text-left">
                  <thead>
                    <tr className="sticky top-0 bg-ethereal-marble/95 backdrop-blur-sm shadow-[0_1px_0_rgba(0,0,0,0.05)] z-10">
                      <th scope="col" className="px-4 py-3 w-[30%]">
                        <Eyebrow color="muted">
                          {t("dashboard.admin.inv_col_concert", "Koncert")}
                        </Eyebrow>
                      </th>
                      <th scope="col" className="px-4 py-3 w-[22%]">
                        <Eyebrow color="muted">
                          {t("dashboard.admin.inv_col_person", "Osoba")}
                        </Eyebrow>
                      </th>
                      <th scope="col" className="px-4 py-3 w-[28%]">
                        <Eyebrow color="muted">
                          {t("dashboard.admin.inv_col_email", "E-mail")}
                        </Eyebrow>
                      </th>
                      <th scope="col" className="px-4 py-3 w-[20%]">
                        <Eyebrow color="muted">
                          {t("dashboard.admin.inv_col_phone", "Telefon")}
                        </Eyebrow>
                      </th>
                    </tr>
                  </thead>

                  <tbody className="relative z-0">
                    <StatusSection
                      rows={groups.declined}
                      labelKey="dashboard.admin.inv_section_declined"
                      labelFallback="Odrzucili"
                      color="crimson"
                      icon={<UserX size={13} />}
                    />
                    <StatusSection
                      rows={groups.pending}
                      labelKey="dashboard.admin.inv_section_pending"
                      labelFallback="Oczekujący"
                      color="muted"
                      icon={<Clock size={13} />}
                    />
                    <StatusSection
                      rows={groups.confirmed}
                      labelKey="dashboard.admin.inv_section_confirmed"
                      labelFallback="Potwierdzeni"
                      color="gold"
                      icon={<UserCheck size={13} />}
                    />
                  </tbody>
                </table>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
};
