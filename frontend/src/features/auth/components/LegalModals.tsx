/**
 * @file LegalModals.tsx
 * @description Enterprise-grade legal modals for Terms of Service and Privacy Policy.
 * Compliant with Ethereal UI constraints (Glassmorphism, CVA Typography).
 * Updated: 2026-04-26
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { X, Printer } from "lucide-react";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import { useBodyScrollLock } from "@/shared/lib/dom/useBodyScrollLock";

export interface LegalModalProps {
  isOpen: boolean;
  onClose: () => void;
  type: "privacy" | "terms";
}

export const LegalModal: React.FC<LegalModalProps> = ({
  isOpen,
  onClose,
  type,
}) => {
  const { t } = useTranslation();
  useBodyScrollLock(isOpen);

  if (!isOpen) return null;

  const handlePrint = (): void => {
    window.print();
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-20 flex items-center justify-center p-4 sm:p-6">
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-ethereal-ink/60 backdrop-blur-sm"
          aria-hidden="true"
        />

        <div className="relative w-full max-w-4xl">
          <GlassCard
            as={motion.div}
            initial={{ opacity: 0, scale: 0.95, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 20 }}
            transition={{ type: "spring", stiffness: 400, damping: 30 }}
            variant="solid"
            padding="none"
            isHoverable={false}
            className="relative w-full max-h-[90vh] flex flex-col min-h-0 shadow-glass-ethereal overflow-hidden"
            role="dialog"
            aria-modal="true"
          >
            {/* Header */}
            <div className="flex items-center justify-between p-6 border-b border-ethereal-incense/10 bg-white/5">
              <div>
                <Heading size="3xl" weight="medium" color="default">
                  {type === "privacy"
                    ? t("auth.legal.privacy.title")
                    : t("auth.legal.terms.title")}
                </Heading>
                <Eyebrow color="muted" className="mt-1">
                  {t("auth.legal.common.last_updated", {
                    date: "15.06.2026",
                  })}
                </Eyebrow>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handlePrint}
                  className="hidden sm:flex"
                >
                  <Printer className="w-4 h-4 ml-3" />
                  {t("auth.legal.common.print")}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={onClose}
                  className="rounded-full"
                >
                  <X className="w-5 h-5" />
                </Button>
              </div>
            </div>

            {/* Content Area */}
            <div className="min-h-0 flex-1 overflow-y-auto touch-pan-y overscroll-contain pointer-events-auto p-6 space-y-8 custom-scrollbar bg-white/40">
              {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-ethereal-incense/10 flex justify-end bg-white/50">
              <Button variant="primary" onClick={onClose} className="mr-6">
                {t("auth.legal.common.close_button")}
              </Button>
            </div>
          </GlassCard>
        </div>
      </div>
    </AnimatePresence>
  );
};

/*
 * Privacy policy for the *panel application* (a separate document from the public
 * site's RODO under web/). The "Internal communication" disclosures below
 * (messaging + notifications) are written to match the actual implementation:
 * see backend/messaging/signals.py for the erasure behaviour ("[treść usunięta]"),
 * and config/settings.py for the notification processors (Anymail/Resend e-mail,
 * Google Firebase/FCM mobile push, self-hosted VAPID web push).
 *
 * ⚠ NOT yet reviewed by a lawyer. The legal basis (art. 6 ust. 1 lit. f RODO) and
 * the US-transfer mechanism (Data Privacy Framework / standard contractual clauses)
 * must be confirmed by counsel before this is relied on as final legal text.
 */
const PrivacyContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.administrator")}
      </Eyebrow>
      <Text color="graphite" size="md" className="mt-2">
        {t("auth.legal.privacy.administrator_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.goals_and_basis")}
      </Eyebrow>
      <ul className="space-y-4 list-none pl-0 m-0">
        <li>
          <Text weight="bold" color="default" size={"md"} className="mt-2">
            {t("auth.legal.privacy.goals_items.account.title")}:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            {t("auth.legal.privacy.goals_items.account.desc")}
          </Text>
        </li>
        <li>
          <Text weight="bold" color="default" size={"md"}>
            {t("auth.legal.privacy.goals_items.logistics.title")}:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            {t("auth.legal.privacy.goals_items.logistics.desc")}
          </Text>
        </li>
        <li>
          <Text weight="bold" color="default" size={"md"} className="mt-2">
            {t("auth.legal.privacy.goals_items.contracts.title")}:
          </Text>
          <Text size="md" color="graphite" className="mt-1">
            {t("auth.legal.privacy.goals_items.contracts.desc")}
          </Text>
        </li>
      </ul>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.security_and_tech")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.security_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.recipients")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.recipients_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.internal_comm_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.internal_comm_desc")}
      </Text>
      <Text size="md" color="graphite" className="mt-3">
        {t("auth.legal.privacy.internal_comm_retention")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.transfers_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.transfers_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.retention_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.retention_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.analytics_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.analytics_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.embeds_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.embeds_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.privacy.your_rights_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.privacy.your_rights_desc")}
      </Text>
    </div>
  </div>
  );
};

const TermsContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.character_and_usage")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.character_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.intellectual_property")}
      </Eyebrow>
      <div className="bg-ethereal-gold/10 p-4 border-l-2 border-ethereal-gold mt-2">
        <Text size="md" color="graphite" className="italic mt-2">
          {t("auth.legal.terms.intellectual_property_desc")}
        </Text>
      </div>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.confidentiality")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.confidentiality_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.data_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.data_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.embeds_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.embeds_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.support_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.support_desc_prefix")} <span className="font-medium text-ethereal-ink">{t("auth.legal.privacy.contact_email")}</span> {t("auth.legal.terms.support_desc_suffix")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.blocking_account")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.blocking_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.changes_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.changes_desc")}
      </Text>
    </div>

    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t("auth.legal.terms.governing_law_title")}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t("auth.legal.terms.governing_law_desc")}
      </Text>
    </div>
  </div>
  );
};
