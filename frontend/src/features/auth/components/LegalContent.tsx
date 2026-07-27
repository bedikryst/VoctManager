/**
 * @file LegalContent.tsx
 * @description Single source of truth for the legal documents: the version
 * identifier recorded at account activation and the section bodies of the
 * Privacy Policy and Terms of Service. Rendered by both the pre-login
 * LegalModal and the public printable /legal/:type page.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Heading, Text } from "@/shared/ui/primitives/typography";

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

/**
 * Both surfaces that render this document are wide — a 4xl modal and a 3xl page
 * — and a legal text is read, not scanned, so the column is capped at a normal
 * measure and centred rather than run to the edge of whatever contains it.
 */
const DOCUMENT_COLUMN = "mx-auto max-w-prose space-y-8";

/**
 * A section title outranks its body by size, family, weight AND colour: ink
 * serif over graphite sans. It used to be 16px graphite semibold above 16px
 * graphite text — the same size and the same colour as the paragraph under it,
 * so the only thing marking a heading was the serif, and the document read as
 * one undifferentiated slab. Five call sites had each typed that recipe out.
 */
const LegalHeading: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Heading as="h3" size="lg" weight="semibold" color="default">
    {children}
  </Heading>
);

/** Document prose, at the panel's own body size. */
const LegalText: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <Text size="base" color="graphite">
    {children}
  </Text>
);

interface LegalSectionProps {
  titleKey: string;
  descKey: string;
}

const LegalSection: React.FC<LegalSectionProps> = ({ titleKey, descKey }) => {
  const { t } = useTranslation();

  return (
    <div className="space-y-2">
      <LegalHeading>{t(titleKey)}</LegalHeading>
      <LegalText>{t(descKey)}</LegalText>
    </div>
  );
};

export const PrivacyContent: React.FC = () => {
  const { t } = useTranslation();

  return (
    <div className={DOCUMENT_COLUMN}>
      <LegalSection
        titleKey="auth.legal.privacy.administrator"
        descKey="auth.legal.privacy.administrator_desc"
      />

      <LegalSection
        titleKey="auth.legal.privacy.source_title"
        descKey="auth.legal.privacy.source_desc"
      />

      <div className="space-y-2">
        <LegalHeading>{t("auth.legal.privacy.goals_and_basis")}</LegalHeading>
        <ul className="m-0 list-none space-y-3 pl-0">
          {(["account", "voice", "logistics", "contracts"] as const).map(
            (item) => (
              <li key={item}>
                <Text size="base" weight="semibold" color="default">
                  {t(`auth.legal.privacy.goals_items.${item}.title`)}:
                </Text>
                <LegalText>
                  {t(`auth.legal.privacy.goals_items.${item}.desc`)}
                </LegalText>
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

      <div className="space-y-2">
        <LegalHeading>{t("auth.legal.privacy.internal_comm_title")}</LegalHeading>
        <LegalText>{t("auth.legal.privacy.internal_comm_desc")}</LegalText>
        <LegalText>{t("auth.legal.privacy.internal_comm_retention")}</LegalText>
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
    <div className={DOCUMENT_COLUMN}>
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

      <div className="space-y-2">
        <LegalHeading>{t("auth.legal.terms.intellectual_property")}</LegalHeading>
        {/* The one clause the foundation needs a member to actually notice. */}
        <div className="border-l-2 border-ethereal-gold bg-ethereal-gold/10 p-4">
          <Text size="base" color="graphite" className="italic">
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

      <div className="space-y-2">
        <LegalHeading>{t("auth.legal.terms.support_title")}</LegalHeading>
        <Text size="base" color="graphite">
          {t("auth.legal.terms.support_desc_prefix")}{" "}
          <Text as="span" size="base" weight="medium" color="default">
            {t("auth.legal.privacy.contact_email")}
          </Text>{" "}
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
