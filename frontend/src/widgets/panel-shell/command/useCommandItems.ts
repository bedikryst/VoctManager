/**
 * @file useCommandItems.ts
 * @description Assembles every command-palette row from four sources — quick
 * actions, navigation destinations, projects and artists — plus the conductor's
 * pinned/recent projects. Project & artist data is fetched **lazily and
 * non-blocking** (plain useQuery gated on `enabled`, sharing the feature cache
 * keys) so the always-mounted palette never suspends the shell and rides warm
 * cache when those tabs were already visited.
 * @module widgets/panel-shell/command
 * @architecture Enterprise SaaS 2026
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { CalendarDays, User, type LucideIcon } from "lucide-react";

import type { AuthUser } from "@/shared/auth/auth.types";
import type { Artist, Project } from "@/shared/types";
import { ProjectService } from "@/features/projects/api/project.service";
import { projectKeys } from "@/features/projects/api/project.queries";
import { ArtistService } from "@/features/artists/api/artist.service";
import { artistKeys } from "@/features/artists/api/artist.queries";

import { useNavigationAura } from "../hooks/useNavigationAura";
import { foldSearchText } from "../lib/navSearch";
import { COMMAND_ACTIONS } from "./commandActions";
import { useProjectQuickAccess } from "./quickAccessStore";

export type CommandKind = "action" | "nav" | "project" | "artist";

export interface CommandItem {
  readonly id: string;
  readonly kind: CommandKind;
  readonly label: string;
  readonly hint?: string;
  readonly icon: LucideIcon;
  readonly to: string;
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

  // Project + artist search is a manager affordance; choristers keep a lean
  // palette (nav + their actions). Fetch only once the palette is opened.
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

  return useMemo<CommandItemsResult>(() => {
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
    }

    const flatItems = sections.flatMap((section) => [...section.items]);
    return { sections, flatItems };
  }, [
    aura.navGroups,
    artists,
    favorites,
    i18n.language,
    isManager,
    location.pathname,
    projects,
    query,
    recents,
    t,
  ]);
};
