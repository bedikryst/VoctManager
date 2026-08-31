/**
 * @file ActivationNave.tsx
 * @description The welcome half of the activation threshold: a dark plate that
 * says who is being welcomed and names the credential they are about to secure.
 * Two masses with air between them — the greeting at the top, the login pinned
 * to the foot on a hairline — so a column stretched to the form beside it reads
 * as a composition rather than as content that ran out.
 *
 * It renders only while there is something to activate. A rail promising what
 * waits inside, standing next to a card that has just refused entry (or beside
 * one confirming the act is already done), is the screen arguing with itself.
 * @architecture Enterprise SaaS 2026
 * @module features/auth/components/ActivationNave
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Heading, Text, Eyebrow, Emphasis } from "@/shared/ui/primitives/typography";
import { AuthBrand } from "@features/auth/components/AuthBrand";
import { AuthCredential } from "@features/auth/components/AuthCredential";

interface ActivationNaveProps {
  /** The invitee's given name, already resolved to the vocative in Polish. */
  readonly inviteeName: string | null;
  readonly inviteeEmail: string | null;
}

export const ActivationNave = ({
  inviteeName,
  inviteeEmail,
}: ActivationNaveProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <GlassCard
      variant="dark"
      padding="lg"
      isHoverable={false}
      // GlassCard's content wrapper carries `flex-1`, which only does anything
      // once the card itself is a flex column — without this the wrapper is
      // auto-height and `justify-between` below has no space to distribute.
      className="flex h-full flex-col"
      contentClassName="justify-between gap-8 lg:gap-12"
    >
      <div>
        <AuthBrand tone="on-inverse" align="left" size="lg" className="mb-9" />

        <Eyebrow color="ink-on-inverse-muted" as="p" className="mb-3">
          {t("auth.activate.badge")}
        </Eyebrow>

        {/* The name drops to its own line: two lines of display serif is what
            gives the greeting more mass than the wordmark above it, and a
            one-line greeting would set `Krzysztofie` in whatever gutter the
            column happened to leave. `tight`, not `none` — Polish diacritics
            ride high enough to touch the line below at a leading of 1. */}
        <Heading as="h1" size="5xl" color="ink-on-inverse" className="leading-tight">
          {inviteeName ? (
            <>
              {t("auth.activate.greeting_word")},{" "}
              <Emphasis as="span" className="block">
                {inviteeName}
              </Emphasis>
            </>
          ) : (
            <>
              {t("auth.activate.title_1")}{" "}
              <Emphasis as="span" className="block">
                {t("auth.activate.title_2")}
              </Emphasis>
            </>
          )}
        </Heading>

        <Text
          size="base"
          color="ink-on-inverse-muted"
          className="mt-6 max-w-md leading-7"
        >
          {t("auth.activate.description")}
        </Text>
      </div>

      {inviteeEmail && (
        <AuthCredential
          tone="dark"
          label={t("auth.activate.login_label")}
          email={inviteeEmail}
          hint={t("auth.activate.login_hint")}
        />
      )}
    </GlassCard>
  );
};
