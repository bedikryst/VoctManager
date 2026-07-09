/**
 * @file LegalContent.tsx
 * @description Single source of truth for the legal documents: the version
 * identifier recorded at account activation and the section bodies of the
 * Privacy Policy and Terms of Service. Rendered by both the pre-login
 * LegalModal and the public printable /legal/:type page.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

/**
 * Date-stamped version of BOTH legal documents. Bump on every content change:
 * it is displayed in the header, sent with the activation request and stored
 * server-side (UserProfile.terms_accepted_at/_version) as acceptance evidence.
 */
export const LEGAL_DOCS_VERSION = "2026-07-09";

/** Human display form of {@link LEGAL_DOCS_VERSION} (dd.mm.yyyy). */
export const LEGAL_DOCS_UPDATED_DISPLAY = "09.07.2026";

/*
 * Privacy policy for the *panel application* (a separate document from the
 * public site's RODO under web/). Disclosures are written to match the actual
 * implementation:
 *  - messaging erasure: backend/messaging/signals.py ("[treść usunięta]"),
 *  - notification processors: config/settings.py (Anymail/Resend e-mail,
 *    Google Firebase/FCM mobile push, self-hosted VAPID web push relayed by
 *    the browser vendor's push service),
 *  - licensed-score watermarking + access log: backend/archive/score_protection.py
 *    and archive.models.ScoreAccessLog,
 *  - AI sheet-music analysis: Anthropic (backend/archive ingestion pipeline).
 *
 * Dietary/allergy data (GDPR art. 9) was deliberately removed from the system
 * (client + server) rather than disclosed — catering is handled off-system.
 *
 * ⚠ NOT yet reviewed by a lawyer. Items for counsel: the art. 6(1)(b) vs (f)
 * split for members (volunteers vs contracted), the US-transfer mechanism per
 * provider (DPF / SCC), the "continued use = acceptance" amendment clause, and
 * whether the hosting provider should be named. Sentry is deliberately NOT
 * listed — it is not enabled; if a DSN is ever set, disclose it here first.
 */

interface LegalSectionProps {
  titleKey: string;
  descKey: string;
}

const LegalSection: React.FC<LegalSectionProps> = ({ titleKey, descKey }) => {
  const { t } = useTranslation();

  return (
    <div>
      <Eyebrow color="muted" size={"md"} className="mb-4">
        {t(titleKey)}
      </Eyebrow>
      <Text size="md" color="graphite" className="mt-2">
        {t(descKey)}
      </Text>
    </div>
  );
};

export const PrivacyContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <LegalSection
        titleKey="auth.legal.privacy.administrator"
        descKey="auth.legal.privacy.administrator_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.source_title"
        descKey="auth.legal.privacy.source_desc"
      />

      <div>
        <Eyebrow color="muted" size={"md"} className="mb-4">
          {t("auth.legal.privacy.goals_and_basis")}
        </Eyebrow>
        <ul className="space-y-4 list-none pl-0 m-0">
          {(["account", "voice", "logistics", "contracts"] as const).map(
            (item) => (
              <li key={item}>
                <Text weight="bold" color="default" size={"md"} className="mt-2">
                  {t(`auth.legal.privacy.goals_items.${item}.title`)}:
                </Text>
                <Text size="md" color="graphite" className="mt-1">
                  {t(`auth.legal.privacy.goals_items.${item}.desc`)}
                </Text>
              </li>
            ),
          )}
        </ul>
      </div>

      <LegalSection
        titleKey="auth.legal.privacy.internal_sharing_title"
        descKey="auth.legal.privacy.internal_sharing_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.security_and_tech"
        descKey="auth.legal.privacy.security_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.recipients"
        descKey="auth.legal.privacy.recipients_desc"
      />

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

      <LegalSection
        titleKey="auth.legal.privacy.score_protection_title"
        descKey="auth.legal.privacy.score_protection_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.transfers_title"
        descKey="auth.legal.privacy.transfers_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.retention_title"
        descKey="auth.legal.privacy.retention_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.analytics_title"
        descKey="auth.legal.privacy.analytics_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.embeds_title"
        descKey="auth.legal.privacy.embeds_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.minors_title"
        descKey="auth.legal.privacy.minors_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.your_rights_title"
        descKey="auth.legal.privacy.your_rights_desc"
      />
    </div>
  );
};

export const TermsContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className="space-y-6">
      <LegalSection
        titleKey="auth.legal.terms.provider_title"
        descKey="auth.legal.terms.provider_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.definitions_title"
        descKey="auth.legal.terms.definitions_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.character_and_usage"
        descKey="auth.legal.terms.character_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.access_title"
        descKey="auth.legal.terms.access_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.tech_title"
        descKey="auth.legal.terms.tech_desc"
      />

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

      <LegalSection
        titleKey="auth.legal.terms.confidentiality"
        descKey="auth.legal.terms.confidentiality_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.unlawful_title"
        descKey="auth.legal.terms.unlawful_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.data_title"
        descKey="auth.legal.terms.data_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.embeds_title"
        descKey="auth.legal.terms.embeds_desc"
      />

      <div>
        <Eyebrow color="muted" size={"md"} className="mb-4">
          {t("auth.legal.terms.support_title")}
        </Eyebrow>
        <Text size="md" color="graphite" className="mt-2">
          {t("auth.legal.terms.support_desc_prefix")}{" "}
          <span className="font-medium text-ethereal-ink">
            {t("auth.legal.privacy.contact_email")}
          </span>{" "}
          {t("auth.legal.terms.support_desc_suffix")}
        </Text>
      </div>

      <LegalSection
        titleKey="auth.legal.terms.complaints_title"
        descKey="auth.legal.terms.complaints_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.blocking_account"
        descKey="auth.legal.terms.blocking_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.changes_title"
        descKey="auth.legal.terms.changes_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.language_title"
        descKey="auth.legal.terms.language_desc"
      />

      <LegalSection
        titleKey="auth.legal.terms.governing_law_title"
        descKey="auth.legal.terms.governing_law_desc"
      />
    </div>
  );
};
