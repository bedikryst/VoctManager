/**
 * @file ActivationLinkClosed.tsx
 * @description What the threshold says when the invitation link no longer opens
 * it. Two causes, one recovery ladder: the overwhelmingly likely reading of a
 * dead single-use link is that the account behind it already exists, so signing
 * in is the primary way forward and a new invitation is the quiet fallback.
 *
 * Deliberately not an alarm. Nothing here failed, nothing is lost, and the
 * member did nothing wrong — the medallion is the warm tone, and the way home
 * is the shell's own back link rather than a second gold slab competing with the
 * one action that actually resolves this.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/ActivationLinkClosed
 */

import React from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Hourglass, Link2Off } from "lucide-react";

import { Button } from "@/shared/ui/primitives/Button";
import { Text } from "@/shared/ui/primitives/typography";
import { AuthOutcome } from "@features/auth/components/AuthOutcome";

interface ActivationLinkClosedProps {
  /** `expired` also covers a link already spent — activating invalidates it. */
  readonly status: "expired" | "invalid";
}

export const ActivationLinkClosed = ({
  status,
}: ActivationLinkClosedProps): React.JSX.Element => {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const isExpired = status === "expired";
  const supportEmail = t("auth.login.support_email");

  return (
    <AuthOutcome
      tone="info"
      icon={
        isExpired ? (
          <Hourglass className="h-6 w-6" strokeWidth={1.6} />
        ) : (
          <Link2Off className="h-6 w-6" strokeWidth={1.6} />
        )
      }
      eyebrow={t("auth.activate.invalid.eyebrow")}
      title={
        isExpired
          ? t("auth.activate.invalid.expired_title")
          : t("auth.activate.invalid.invalid_title")
      }
      description={
        isExpired
          ? t("auth.activate.invalid.expired_desc")
          : t("auth.activate.invalid.invalid_desc")
      }
      actions={
        <>
          <Button
            type="button"
            variant="primary"
            size="lg"
            fullWidth
            onClick={() => navigate("/login")}
          >
            {t("auth.activate.invalid.cta_login")}
          </Button>

          <Text
            size="xs"
            color="graphite"
            className="border-t border-hairline pt-5 leading-6"
          >
            {t("auth.activate.invalid.help_prefix")}{" "}
            <a
              href={`mailto:${supportEmail}`}
              className="font-medium text-ethereal-gold underline decoration-ethereal-gold/40 underline-offset-4 transition-colors hover:text-ethereal-ink"
            >
              {supportEmail}
            </a>
          </Text>
        </>
      }
    />
  );
};
