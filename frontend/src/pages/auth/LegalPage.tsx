/**
 * @file LegalPage.tsx
 * @description Public, printable full-page view of a legal document (Terms of
 * Service or Privacy Policy). Satisfies the UŚUDE requirement that the terms
 * be retrievable and reproducible outside the app: linkable URL, plain
 * document layout, working print styling. Content comes from LegalContent.tsx
 * — the same source the pre-login LegalModal renders.
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { Link, Navigate, useParams } from "react-router-dom";
import { ArrowLeft, Printer } from "lucide-react";
import { Heading, Eyebrow, Text } from "@/shared/ui/primitives/typography";
import { Button } from "@/shared/ui/primitives/Button";
import {
  PrivacyContent,
  TermsContent,
  LEGAL_DOCS_UPDATED_DISPLAY,
} from "@features/auth/components/LegalContent";

export default function LegalPage(): React.JSX.Element {
  const { type } = useParams();
  const { t } = useTranslation();

  if (type !== "privacy" && type !== "terms") {
    return <Navigate to="/legal/terms" replace />;
  }

  const title =
    type === "privacy"
      ? t("auth.legal.privacy.title")
      : t("auth.legal.terms.title");

  return (
    <div className="min-h-screen bg-ethereal-alabaster print:bg-white">
      <div className="mx-auto w-full max-w-3xl px-6 py-12 print:max-w-none print:px-0 print:py-0">
        {/* Chrome — hidden on paper */}
        <div className="mb-10 flex items-center justify-between print:hidden">
          <Link
            to="/login"
            className="inline-flex items-center gap-2 text-ethereal-graphite transition-colors hover:text-ethereal-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            <Text size="sm" color="graphite" as="span">
              {t("auth.reset.back_to_login")}
            </Text>
          </Link>
          <Button variant="ghost" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" aria-hidden="true" />
            {t("auth.legal.common.print")}
          </Button>
        </div>

        {/* Document header */}
        <header className="mb-10 border-b border-ethereal-incense/20 pb-6">
          <Eyebrow color="muted" className="mb-2">
            VoctManager
          </Eyebrow>
          <Heading size="3xl" weight="medium" color="default">
            {title}
          </Heading>
          <Eyebrow color="muted" className="mt-2">
            {t("auth.legal.common.last_updated", {
              date: LEGAL_DOCS_UPDATED_DISPLAY,
            })}
          </Eyebrow>
        </header>

        {type === "privacy" ? <PrivacyContent /> : <TermsContent />}
      </div>
    </div>
  );
}
