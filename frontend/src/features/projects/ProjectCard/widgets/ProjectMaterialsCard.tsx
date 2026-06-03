/**
 * @file ProjectMaterialsCard.tsx
 * @description Context-rail card gathering the production's reference materials — the score
 * PDF, the Spotify listening reference, and the dress code — as quiet, tappable rows. This
 * replaces the heavy always-on Spotify <iframe> on the Overview (the embed lives on instead
 * in the schedule timeline, where it earns its weight); here the reference is a light link.
 * The score row reuses the hub's shared PDF viewer via context rather than mounting its own.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectCard/widgets/ProjectMaterialsCard
 */

import React from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronRight,
  ExternalLink,
  FileText,
  FolderOpen,
  Music,
  Shirt,
} from "lucide-react";

import type { Project } from "@/shared/types";
import { cn } from "@/shared/lib/utils";
import { WidgetCard } from "@/shared/ui/composites/WidgetCard";
import { Caption, Text } from "@/shared/ui/primitives/typography";

interface ProjectMaterialsCardProps {
  project: Project;
  onOpenScore?: () => void;
}

interface MaterialRowProps {
  icon: typeof FileText;
  label: string;
  available: boolean;
  emptyLabel: string;
  onClick?: () => void;
  href?: string;
  external?: boolean;
}

const MaterialRow = ({
  icon: Icon,
  label,
  available,
  emptyLabel,
  onClick,
  href,
  external,
}: MaterialRowProps): React.JSX.Element => {
  const content = (
    <>
      <Icon
        size={15}
        className={cn(
          "shrink-0",
          available ? "text-ethereal-gold/70" : "text-ethereal-graphite/35",
        )}
        aria-hidden="true"
      />
      <div className="flex min-w-0 flex-1 flex-col">
        <Text as="span" size="sm" weight="medium" truncate>
          {label}
        </Text>
        {!available && (
          <Caption color="muted" className="italic">
            {emptyLabel}
          </Caption>
        )}
      </div>
      {available &&
        (external ? (
          <ExternalLink
            size={15}
            className="shrink-0 text-ethereal-graphite/35 transition-colors group-hover:text-ethereal-gold"
            aria-hidden="true"
          />
        ) : (
          <ChevronRight
            size={16}
            className="shrink-0 text-ethereal-graphite/35 transition-transform duration-300 group-hover:translate-x-0.5 group-hover:text-ethereal-gold"
            aria-hidden="true"
          />
        ))}
    </>
  );

  const rowClass =
    "group flex w-full items-center gap-3 py-3 text-left transition-colors first:pt-0 last:pb-0";

  if (!available) {
    return <div className={cn(rowClass, "cursor-default")}>{content}</div>;
  }

  if (href) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(rowClass, "rounded-lg hover:text-ethereal-gold")}
      >
        {content}
      </a>
    );
  }

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        rowClass,
        "rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ethereal-gold/40",
      )}
    >
      {content}
    </button>
  );
};

export function ProjectMaterialsCard({
  project,
  onOpenScore,
}: ProjectMaterialsCardProps): React.JSX.Element {
  const { t } = useTranslation();

  const hasDress = Boolean(project.dress_code_female || project.dress_code_male);

  return (
    <WidgetCard
      title={t("projects.overview.materials.title", "Materiały")}
      icon={<FolderOpen size={15} aria-hidden="true" />}
      bodyClassName="py-2"
    >
      <div className="divide-y divide-ethereal-ink/5">
        <MaterialRow
          icon={FileText}
          label={t("projects.exports.score_pdf", "Partytura (PDF)")}
          available={Boolean(project.score_pdf)}
          emptyLabel={t("projects.overview.materials.no_score", "Nie wgrano partytury")}
          onClick={onOpenScore}
        />

        <MaterialRow
          icon={Music}
          label={t("projects.overview.materials.spotify", "Referencje Spotify")}
          available={Boolean(project.spotify_playlist_url)}
          emptyLabel={t("projects.spotify.empty", "Brak przypisanej playlisty.")}
          href={project.spotify_playlist_url ?? undefined}
          external
        />

        <div className="flex items-start gap-3 py-3 first:pt-0 last:pb-0">
          <Shirt
            size={15}
            className={cn(
              "mt-0.5 shrink-0",
              hasDress ? "text-ethereal-gold/70" : "text-ethereal-graphite/35",
            )}
            aria-hidden="true"
          />
          <div className="flex min-w-0 flex-1 flex-col gap-1.5">
            <Text as="span" size="sm" weight="medium">
              {t("projects.details.dress_code_title", "Dress Code")}
            </Text>
            {hasDress ? (
              <div className="flex flex-col gap-1">
                {project.dress_code_female && (
                  <Text size="sm" color="graphite" className="leading-snug">
                    <Caption as="span" color="amethyst" weight="bold" className="uppercase tracking-[0.16em]">
                      {t("projects.details.dress_code_female", "Panie")}
                    </Caption>{" "}
                    {project.dress_code_female}
                  </Text>
                )}
                {project.dress_code_male && (
                  <Text size="sm" color="graphite" className="leading-snug">
                    <Caption as="span" color="sage" weight="bold" className="uppercase tracking-[0.16em]">
                      {t("projects.details.dress_code_male", "Panowie")}
                    </Caption>{" "}
                    {project.dress_code_male}
                  </Text>
                )}
              </div>
            ) : (
              <Caption color="muted" className="italic">
                {t("projects.details.no_dress_code", "Nie ma wymagań co do ubioru.")}
              </Caption>
            )}
          </div>
        </div>
      </div>
    </WidgetCard>
  );
}
