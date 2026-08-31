/**
 * @file useCommandItems.ts
 * @description Assembles every command-palette row from five sources — quick
 * actions, navigation destinations, projects, artists and the repertoire —
 * plus the conductor's pinned/recent projects. Every data source is fetched
 * **lazily and non-blocking** (plain useQuery gated on `enabled`, sharing the
 * feature cache keys) so the always-mounted palette never suspends the shell
 * and rides warm cache when those tabs were already visited.
 *
 * Repertoire is the one source that differs by role, because the two roles do
 * not have the same library: a manager searches the whole archive and lands on
 * the Piece Card, while a chorister searches only the pieces they are actually
 * cast in and lands on their practice page for that piece *in that project*.
 * Same section, same question ("where is that piece"), two honest answers.
 * @module widgets/panel-shell/command
 * @architecture Enterprise SaaS 2026
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  CalendarDays,
  Monitor,
  Moon,
  Music,
  Sun,
  User,
  type LucideIcon,
} from "lucide-react";

import type { AuthUser } from "@/shared/auth/auth.types";
import { isArtist } from "@/shared/auth/rbac";
import type { Artist, Piece, Project } from "@/shared/types";
import { ProjectService } from "@/features/projects/api/project.service";
import { projectKeys } from "@/features/projects/api/project.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import { artistKeys } from "@/features/artists/api/artist.queries";
import { ArchiveService } from "@/features/archive/api/archive.service";
import { archiveKeys } from "@/features/archive/api/archive.queries";
import { MaterialsService } from "@/features/materials/api/materials.service";
import { materialsKeys } from "@/features/materials/api/materials.queries";
import type { MaterialsDashboardItem } from "@/features/materials/types/materials.dto";

import { useTheme } from "@/shared/theme/useTheme";
import type { ThemePreference } from "@/shared/theme/themeController";

import { useNavigationAura } from "../hooks/useNavigationAura";
import { foldSearchText } from "../lib/navSearch";
import { COMMAND_ACTIONS } from "./commandActions";
import { useProjectQuickAccess } from "./quickAccessStore";

export type CommandKind = "action" | "nav" | "project" | "artist" | "piece";

export interface CommandItem {
  readonly id: string;
  readonly kind: CommandKind;
  readonly label: string;
  readonly hint?: string;
  /**
   * How the hint is set. `overline` (default) is the machine label the slot was
   * built for — a date, a voice type. `natural` is for a hint carrying human
   * content, and a composer's name is exactly that: the design canon keeps a
   * person in the sans at their own casing, in every view, so an uppercased
   * overline would read as a machine label. Same axis, same reason, as
   * `Badge`'s `casing`.
   */
  readonly hintCasing?: "overline" | "natural";
  readonly icon: LucideIcon;
  /**
   * Where the row leads. A row carries either this or `run`, never neither and
   * never both — the palette is a navigator first, and a row that acts instead
   * is the exception that has to declare itself.
   */
  readonly to?: string;
  /**
   * Performs the row's effect in place rather than navigating, and leaves the
   * palette OPEN. That is the point for a preference: the palette is the only
   * surface where a theme can be judged against real content behind it, so
   * closing on select would hide the thing being chosen.
   */
  readonly run?: () => void;
  readonly keywords: string;
  readonly isCurrent?: boolean;
  readonly projectId?: string;
  readonly hasMessagesBadge?: boolean;
}

export interface CommandSection {
  readonly id: string;
  readonly titleKey: string;
  readonly items: readonly CommandItem[];
}

export interface CommandItemsResult {
  readonly sections: readonly CommandSection[];
  readonly flatItems: readonly CommandItem[];
}

const DATA_STALE_TIME = 1000 * 60 * 5;
const SEARCH_RESULT_CAP = 6;
const RECENT_DISPLAY_CAP = 5;

/** The three preferences, in the order the settings control shows them. */
const THEME_OPTIONS: readonly { id: ThemePreference; icon: LucideIcon }[] = [
  { id: "system", icon: Monitor },
  { id: "light", icon: Sun },
  { id: "dark", icon: Moon },
];

export const useCommandItems = (
  user: AuthUser | null,
  isOpen: boolean,
  query: string,
): CommandItemsResult => {
  const { t, i18n } = useTranslation();
  const aura = useNavigationAura(user);
  const isManager = aura.isManagerUser;
  const location = useLocation();
  const { favorites, recents } = useProjectQuickAccess();
  const { preference, setPreference } = useTheme();

  // Project + artist search is a manager affordance — a chorister may not read
  // either collection. Fetch only once the palette is opened.
  const enabled = isOpen && isManager;

  const { data: projects } = useQuery<Project[]>({
    queryKey: projectKeys.projects.all,
    queryFn: ProjectService.getAll,
    enabled,
    staleTime: DATA_STALE_TIME,
  });

  const { data: artists } = useQuery<Artist[]>({
    queryKey: artistKeys.artists.all,
    queryFn: ArtistService.getAll,
    enabled,
    staleTime: DATA_STALE_TIME,
  });

  // The archive, for a manager: the whole library, keyed to the Piece Card.
  const { data: pieces } = useQuery<Piece[]>({
    queryKey: archiveKeys.pieces.all,
    queryFn: ArchiveService.getPieces,
    enabled,
    staleTime: DATA_STALE_TIME,
  });

  // The chorister's own repertoire read-model — the same cache their Materials
  // tab fills, so the palette usually opens onto warm data and never asks for a
  // collection they are not permitted. Gated on the ARTIST role rather than on
  // `!isManager`, because the read-model is joined from participations: a crew
  // member is neither, and would spend a 403 every time they opened the palette.
  // Deliberately WITHOUT `RECONCILING_REFETCH` — the palette is a reader mounted
  // for the whole session, and forcing a refetch belongs to the page that owns
  // the read-model.
  // The arrow is load-bearing: React Query calls `queryFn` with its own context
  // object, which would land in the service's preview-artist parameter and ask
  // the server for somebody named `[object Object]`.
  const { data: myMaterials } = useQuery<MaterialsDashboardItem[]>({
    queryKey: materialsKeys.dashboard,
    queryFn: () => MaterialsService.getArtistMaterialsDashboard(),
    enabled: isOpen && isArtist(user),
    staleTime: DATA_STALE_TIME,
  });

  // Sources → rows. Deliberately independent of `query`: folding diacritics over
  // every project, every artist and the entire piece archive is the expensive
  // half of this hook, and it produces the same rows no matter what is typed.
  // Folded once here, the query pass below is string matching and nothing else.
  const sources = useMemo(() => {
    const projectList = projects ?? [];
    const artistList = artists ?? [];

    const dateFormatter = new Intl.DateTimeFormat(i18n.language || "pl", {
      day: "numeric",
      month: "short",
    });
    const formatDate = (value: string): string => {
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? "" : dateFormatter.format(date);
    };

    // ---- Quick actions ----
    const actionItems: CommandItem[] = COMMAND_ACTIONS.filter((action) =>
      action.scope === "all"
        ? true
        : action.scope === "manager"
          ? isManager
          : !isManager,
    ).map((action) => {
      const label = t(action.labelKey, action.defaultLabel);
      return {
        id: `action:${action.id}`,
        kind: "action",
        label,
        icon: action.icon,
        to: action.to,
        keywords: foldSearchText(label),
      };
    });

    // ---- Navigation destinations ----
    const navItems: CommandItem[] = aura.navGroups.flatMap((group) =>
      group.links.map((link) => {
        const label = t(link.labelKey);
        const isCurrent =
          link.to === "/panel"
            ? location.pathname === "/panel"
            : location.pathname.startsWith(link.to);
        return {
          id: `nav:${link.to}`,
          kind: "nav",
          label,
          icon: link.icon,
          to: link.to,
          keywords: foldSearchText(
            `${label} ${t(group.labelKey)} ${link.to.replace(/[/-]/g, " ")}`,
          ),
          isCurrent,
          hasMessagesBadge: link.to === "/panel/messages",
        };
      }),
    );

    // ---- Projects ----
    const projectItems: CommandItem[] = projectList.map((project) => {
      const id = String(project.id);
      return {
        id: `project:${id}`,
        kind: "project",
        label: project.title,
        hint: formatDate(project.date_time),
        icon: CalendarDays,
        to: `/panel/projects/${id}`,
        projectId: id,
        keywords: foldSearchText(
          `${project.title} ${project.location?.name ?? ""} ${
            project.conductor_name ?? ""
          }`,
        ),
        isCurrent: location.pathname.startsWith(`/panel/projects/${id}`),
      };
    });
    const projectById = new Map(
      projectItems.map((item) => [item.projectId as string, item]),
    );

    // ---- Artists (active only) ----
    const artistItems: CommandItem[] = artistList
      .filter((artist) => artist.is_active)
      .map((artist) => {
        const label = `${artist.first_name} ${artist.last_name}`.trim();
        return {
          id: `artist:${artist.id}`,
          kind: "artist",
          label,
          hint: artist.voice_type_display ?? "",
          icon: User,
          to: `/panel/artists?focus=${artist.id}`,
          keywords: foldSearchText(`${label} ${artist.voice_type_display ?? ""}`),
        };
      });

    // ---- Repertoire ----
    // A manager searches the library and lands on the Piece Card; a chorister
    // searches what they are cast in and lands on the practice page for that
    // piece in that project. The same piece sung in two concerts is genuinely
    // two rows: different divisi, different readiness, different destination —
    // so the hint names the project that tells them apart.
    const pieceItems: CommandItem[] = isManager
      ? (pieces ?? []).map((piece) => {
          const id = String(piece.id);
          const composer = piece.composer
            ? piece.composer.full_name ||
              `${piece.composer.first_name ?? ""} ${piece.composer.last_name}`.trim()
            : "";
          return {
            id: `piece:${id}`,
            kind: "piece",
            label: piece.title,
            hint: composer || undefined,
            hintCasing: "natural",
            icon: Music,
            to: `/panel/archive-management/${id}`,
            keywords: foldSearchText(
              `${piece.title} ${composer} ${piece.opus_catalog ?? ""}`,
            ),
            isCurrent: location.pathname.startsWith(
              `/panel/archive-management/${id}`,
            ),
          };
        })
      : (myMaterials ?? []).flatMap((group) =>
          group.program.map((entry) => {
            const projectId = String(group.project.id);
            const pieceId = String(entry.piece.id);
            const composer = entry.piece.composer?.full_name ?? "";
            const to = `/panel/materials/${projectId}/${pieceId}`;
            return {
              id: `piece:${projectId}:${pieceId}`,
              kind: "piece" as const,
              label: entry.piece.title,
              hint: composer
                ? `${composer} · ${group.project.title}`
                : group.project.title,
              hintCasing: "natural" as const,
              icon: Music,
              to,
              keywords: foldSearchText(
                `${entry.piece.title} ${composer} ${group.project.title}`,
              ),
              isCurrent: location.pathname === to,
            };
          }),
        );

    return {
      actionItems,
      navItems,
      projectItems,
      projectById,
      artistItems,
      pieceItems,
    };
  }, [
    aura.navGroups,
    artists,
    i18n.language,
    isManager,
    location.pathname,
    myMaterials,
    pieces,
    projects,
    t,
  ]);

  // Appearance rows — their own memo rather than a sixth source, because they
  // change with the preference and `sources` above is the expensive fold over
  // every project, artist and piece. Folding the whole archive again because
  // somebody switched to dark would be a real cost for no new rows.
  //
  // These are SEARCH-ONLY: they never appear in the empty palette. A theme is
  // set about once per device, and the resting list is navigation the member
  // uses daily — so the rows answer the word that is typed ("motyw", "ciemny",
  // "theme") instead of standing in the way of the ones that are not.
  const themeItems = useMemo<CommandItem[]>(() => {
    const aliases = t("settings.app.theme.keywords");
    const title = t("settings.app.theme.title");
    return THEME_OPTIONS.map(({ id, icon }) => {
      const label = t(`settings.app.theme.${id}`);
      return {
        id: `theme:${id}`,
        kind: "action" as const,
        label,
        hint:
          preference === id ? t("settings.app.theme.active") : undefined,
        icon,
        run: () => setPreference(id),
        keywords: foldSearchText(`${label} ${title} ${aliases}`),
      };
    });
  }, [preference, setPreference, t]);

  // Rows → sections. The only query-dependent work in the hook.
  return useMemo<CommandItemsResult>(() => {
    const {
      actionItems,
      navItems,
      projectItems,
      projectById,
      artistItems,
      pieceItems,
    } = sources;

    const tokens = foldSearchText(query).split(/\s+/).filter(Boolean);
    const sections: CommandSection[] = [];

    if (tokens.length === 0) {
      if (actionItems.length > 0) {
        sections.push({
          id: "actions",
          titleKey: "dashboard.layout.command.sections.actions",
          items: actionItems,
        });
      }

      const favoriteSet = new Set(favorites);
      const favoriteItems = favorites
        .map((id) => projectById.get(id))
        .filter((item): item is CommandItem => Boolean(item));
      if (favoriteItems.length > 0) {
        sections.push({
          id: "pinned",
          titleKey: "dashboard.layout.command.sections.pinned",
          items: favoriteItems,
        });
      }

      const recentItems = recents
        .filter((id) => !favoriteSet.has(id))
        .map((id) => projectById.get(id))
        .filter((item): item is CommandItem => Boolean(item))
        .slice(0, RECENT_DISPLAY_CAP);
      if (recentItems.length > 0) {
        sections.push({
          id: "recent",
          titleKey: "dashboard.layout.command.sections.recent",
          items: recentItems,
        });
      }

      sections.push({
        id: "nav",
        titleKey: "dashboard.layout.command.sections.navigation",
        items: navItems,
      });
    } else {
      const matches = (item: CommandItem): boolean =>
        tokens.every((token) => item.keywords.includes(token));

      const navMatches = navItems.filter(matches);
      const projectMatches = projectItems.filter(matches).slice(0, SEARCH_RESULT_CAP);
      const pieceMatches = pieceItems.filter(matches).slice(0, SEARCH_RESULT_CAP);
      const artistMatches = artistItems.filter(matches).slice(0, SEARCH_RESULT_CAP);
      const actionMatches = actionItems.filter(matches);

      if (navMatches.length > 0) {
        sections.push({
          id: "nav",
          titleKey: "dashboard.layout.command.sections.navigation",
          items: navMatches,
        });
      }
      if (projectMatches.length > 0) {
        sections.push({
          id: "projects",
          titleKey: "dashboard.layout.command.sections.projects",
          items: projectMatches,
        });
      }
      if (pieceMatches.length > 0) {
        sections.push({
          id: "repertoire",
          titleKey: "dashboard.layout.command.sections.repertoire",
          items: pieceMatches,
        });
      }
      if (artistMatches.length > 0) {
        sections.push({
          id: "artists",
          titleKey: "dashboard.layout.command.sections.artists",
          items: artistMatches,
        });
      }
      if (actionMatches.length > 0) {
        sections.push({
          id: "actions",
          titleKey: "dashboard.layout.command.sections.actions",
          items: actionMatches,
        });
      }
      const themeMatches = themeItems.filter(matches);
      if (themeMatches.length > 0) {
        sections.push({
          id: "appearance",
          titleKey: "dashboard.layout.command.sections.appearance",
          items: themeMatches,
        });
      }
    }

    const flatItems = sections.flatMap((section) => [...section.items]);
    return { sections, flatItems };
  }, [favorites, query, recents, sources, themeItems]);
};
