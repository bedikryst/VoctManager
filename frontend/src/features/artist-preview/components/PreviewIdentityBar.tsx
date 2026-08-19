/**
 * @file PreviewIdentityBar.tsx
 * @description The header that never leaves the preview: whose view this is,
 * and that it only looks.
 *
 * It stays on screen through every tab because the surfaces below it are the
 * artist's own, verbatim — "Mój Harmonogram", "Twoja gotowość", a greeting in
 * the second person. Read without this bar for two seconds, the page claims to
 * be the reader's. Naming the member once, at the top, is what keeps every
 * possessive underneath truthful.
 * @module features/artist-preview/components/PreviewIdentityBar
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Eye } from "lucide-react";

import { Avatar } from "@/shared/ui/composites/Avatar";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Eyebrow, Heading, Text } from "@/shared/ui/primitives/typography";
import type { PreviewArtistIdentity } from "@/app/providers/ArtistPreviewProvider";

interface PreviewIdentityBarProps {
  artist: PreviewArtistIdentity;
}

export const PreviewIdentityBar = ({
  artist,
}: PreviewIdentityBarProps): React.JSX.Element => {
  const { t } = useTranslation();

  return (
    <GlassCard variant="ethereal" padding="md" isHoverable={false}>
      <div className="flex flex-wrap items-center gap-4">
        <Avatar
          src={artist.avatarUrl}
          name={artist.fullName}
          size="md"
          shape="rounded"
          tone="gold"
          className="shrink-0"
        />

        <div className="min-w-0 flex-1">
          <Eyebrow color="muted" className="block">
            {t("artist_preview.eyebrow", "Podgląd chórzysty")}
          </Eyebrow>
          <Heading as="h1" size="2xl" truncate className="tracking-tight">
            {t("artist_preview.title", "Co widzi {{name}}", {
              name: artist.firstName || artist.fullName,
            })}
          </Heading>
          <Text size="sm" color="muted" className="mt-1 block">
            {t(
              "artist_preview.subtitle",
              "Dokładnie te dane serwer wysyła na urządzenie tej osoby. Z tego ekranu niczego nie zapiszesz.",
            )}
          </Text>
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Badge variant="neutral" icon={<Eye size={11} aria-hidden="true" />}>
            {t("artist_preview.read_only_badge", "Tylko podgląd")}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            asChild
            leftIcon={<ArrowLeft size={13} aria-hidden="true" />}
          >
            <Link to="/panel/artists">
              {t("artist_preview.back_to_roster", "Baza Artystów")}
            </Link>
          </Button>
        </div>
      </div>
    </GlassCard>
  );
};
