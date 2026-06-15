/**
 * @file SettingsIdentityCard.tsx
 * @description "Who am I" anchor for the settings hub: editable avatar, full
 * name, account e-mail and role/voice chips. Clicking the avatar opens the
 * picture editor. Keeps account context visible while the user edits any
 * section — and surfaces the login e-mail, which the old settings never showed.
 * @architecture Enterprise SaaS 2026
 * @module features/settings/components/SettingsIdentityCard
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { Camera } from "lucide-react";

import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import type { UserMeDTO } from "../types/settings.dto";
import { AvatarEditorModal } from "./AvatarEditorModal";

interface SettingsIdentityCardProps {
  readonly user: UserMeDTO | undefined;
}

const ROLE_LABELS: Record<string, { key: string; fallback: string }> = {
  MANAGER: { key: "settings.identity.roles.MANAGER", fallback: "Management" },
  ARTIST: { key: "settings.identity.roles.ARTIST", fallback: "Artysta" },
  CREW: {
    key: "settings.identity.roles.CREW",
    fallback: "Obsługa techniczna",
  },
};

const chipClass =
  "rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-ethereal-graphite";

export const SettingsIdentityCard = ({
  user,
}: SettingsIdentityCardProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const [editorOpen, setEditorOpen] = useState(false);

  if (!user) return null;

  const fullName = `${user.first_name ?? ""} ${user.last_name ?? ""}`.trim();
  const role = user.profile?.role ? ROLE_LABELS[user.profile.role] : undefined;
  const voiceLabel = user.voice_type
    ? t(
        `dashboard.layout.roles.${user.voice_type}`,
        user.voice_type_display ?? user.voice_type,
      )
    : null;
  const avatarUrl = user.profile?.avatar_url ?? null;

  return (
    <>
      <GlassCard variant="solid" padding="md" isHoverable={false}>
        <div className="flex items-center gap-3.5">
          <button
            type="button"
            onClick={() => setEditorOpen(true)}
            className="group relative shrink-0 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/50"
            aria-label={t("settings.avatar.edit_aria", "Zmień zdjęcie profilowe")}
          >
            <Avatar src={avatarUrl} name={fullName || user.email} size="md" />
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-ethereal-ink/45 text-ethereal-marble opacity-0 transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100">
              <Camera size={16} aria-hidden="true" />
            </span>
          </button>
          <div className="min-w-0">
            <Text weight="medium" truncate className="block">
              {fullName || user.email}
            </Text>
            <Caption color="muted" truncate className="block" title={user.email}>
              {user.email}
            </Caption>
          </div>
        </div>

        {(role || voiceLabel) && (
          <div className="mt-3.5 flex flex-wrap gap-1.5 border-t border-ethereal-ink/6 pt-3.5">
            {role && (
              <span
                className={`${chipClass} border-ethereal-gold/30 bg-ethereal-gold/[0.08]`}
              >
                {t(role.key, role.fallback)}
              </span>
            )}
            {voiceLabel && (
              <span
                className={`${chipClass} border-ethereal-amethyst/30 bg-ethereal-amethyst/[0.08]`}
              >
                {voiceLabel}
              </span>
            )}
          </div>
        )}
      </GlassCard>

      <AvatarEditorModal
        isOpen={editorOpen}
        onClose={() => setEditorOpen(false)}
        hasAvatar={Boolean(avatarUrl)}
      />
    </>
  );
};
