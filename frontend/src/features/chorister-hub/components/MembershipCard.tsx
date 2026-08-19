// chorister-hub/components/MembershipCard.tsx
// "Legitymacja" — the membership hero. Answers "who am I in this ensemble" at a
// glance: avatar, name, stable voice type, and a few long-horizon stats. Degrades
// to a curator card for users with no artist record (pure managers / conductors).
import React from "react";
import { useTranslation } from "react-i18next";
import { Library, Music, UserRound } from "lucide-react";

import { useAuth } from "@/app/providers/AuthProvider";
import { useArtistPreview } from "@/app/providers/ArtistPreviewProvider";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Avatar } from "@/shared/ui/composites/Avatar";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Caption, Heading, Metric, Text } from "@/shared/ui/primitives/typography";
import { useArtistMetrics, useMyEnsemble } from "../api/chorister-hub.queries";

const Stat = ({
  value,
  label,
}: {
  value: number | string;
  label: string;
}): React.JSX.Element => (
  <div className="min-w-0">
    <Metric size="2xl" color="graphite" className="leading-none">
      {value}
    </Metric>
    <Caption color="muted" className="mt-1 block truncate">
      {label}
    </Caption>
  </div>
);

export const MembershipCard = (): React.JSX.Element => {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { isPreview, artist: previewArtist } = useArtistPreview();
  const { data: ensemble } = useMyEnsemble();
  const { data: metrics } = useArtistMetrics();

  // The figures below already describe the previewed member (the server resolved
  // them from `?artist=`), so the face and the name have to follow. Left on the
  // session's own user, this card would put the manager's identity on top of
  // somebody else's history — the one lie a "what does Kasia see" screen must
  // never tell.
  const fullName = isPreview
    ? (previewArtist?.fullName ?? "")
    : [user?.first_name, user?.last_name].filter(Boolean).join(" ").trim();
  const avatarUrl = isPreview
    ? (previewArtist?.avatarUrl ?? null)
    : (user?.profile?.avatar_url ?? user?.profile?.avatar_thumb_url ?? null);
  // A name is all a preview has — no login to fall back on, and none to show.
  const identityFallback = isPreview
    ? fullName
    : (fullName || user?.username || user?.email);

  // ── Curator card (no artist record) ───────────────────────────────────────
  if (!ensemble.me.is_linked) {
    return (
      <GlassCard
        variant="ethereal"
        padding="lg"
        isHoverable={false}
        className="relative overflow-hidden"
      >
        <Library
          size={120}
          aria-hidden="true"
          className="pointer-events-none absolute -right-5 -top-5 text-ethereal-ink/5"
        />
        <div className="relative z-10 flex items-center gap-4">
          <Avatar src={avatarUrl} name={fullName || user?.email} size="lg" tone="gold" />
          <div className="min-w-0">
            <Caption color="muted" className="block">
              {t("chorister_hub.card.curator_role", "Kurator zespołu")}
            </Caption>
            <Heading size="xl" className="truncate tracking-tight">
              {identityFallback}
            </Heading>
            <Text size="sm" color="muted" className="mt-1 block">
              {t(
                "chorister_hub.card.curator_hint",
                "Zarządzasz bazą wiedzy i widzisz pełny skład zespołu.",
              )}
            </Text>
          </div>
        </div>
      </GlassCard>
    );
  }

  // ── Personal membership card ──────────────────────────────────────────────
  const voiceLabel =
    ensemble.me.voice_type_display ??
    (isPreview ? previewArtist?.voiceLabel : user?.voice_type_display) ??
    null;
  const hasHistory = metrics.total_concerts > 0;

  return (
    <GlassCard
      variant="ethereal"
      padding="lg"
      isHoverable={false}
      className="relative overflow-hidden"
    >
      <Music
        size={140}
        aria-hidden="true"
        className="pointer-events-none absolute -right-6 -top-8 text-ethereal-gold/5"
      />

      <div className="relative z-10 flex flex-col gap-5">
        <div className="flex items-center gap-4">
          <Avatar src={avatarUrl} name={fullName || user?.email} size="xl" tone="gold" />
          <div className="min-w-0 flex-1">
            <Caption color="muted" className="flex items-center gap-1.5">
              <UserRound size={12} aria-hidden="true" />
              {ensemble.me.is_active
                ? t("chorister_hub.card.member_active", "Aktywny członek")
                : t("chorister_hub.card.member_inactive", "Członek (nieaktywny)")}
            </Caption>
            <Heading size="2xl" className="truncate tracking-tight">
              {identityFallback}
            </Heading>
            {voiceLabel && (
              <Badge variant="glass" className="mt-2 inline-flex">
                {voiceLabel}
              </Badge>
            )}
          </div>
        </div>

        {hasHistory ? (
          <div className="grid grid-cols-3 gap-3 border-t border-ethereal-incense/15 pt-4">
            <Stat
              value={metrics.first_project_year ?? "—"}
              label={t("chorister_hub.card.since", "Śpiewa od")}
            />
            <Stat
              value={metrics.total_concerts}
              label={t("chorister_hub.card.concerts", "Koncerty")}
            />
            <Stat
              value={metrics.active_seasons}
              label={t("chorister_hub.card.seasons", "Sezony")}
            />
          </div>
        ) : (
          <Text
            size="sm"
            color="muted"
            className="border-t border-ethereal-incense/15 pt-4 italic"
          >
            {t(
              "chorister_hub.card.new_member",
              "Twoja historia w zespole dopiero się zaczyna.",
            )}
          </Text>
        )}
      </div>
    </GlassCard>
  );
};
