/**
 * @file useCrewData.ts
 * @description The crew list's filter state, its client-side filtering and
 * sorting, the tokens for the filters in use and the deletion lifecycle, on
 * top of the React Query cache. Server state stays delegated to
 * `crew.queries`; this hook owns purely UI logic.
 *
 * One quick filter, "bez pełnego kontaktu": a collaborator missing an e-mail
 * or a phone is the gap this list is opened to fill. Its count is list-wide.
 * @module features/crew/hooks/useCrewData
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { toastApiError } from "@/shared/api/errors";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import { foldDiacritics } from "@/shared/lib/text";
import type { FilterToken } from "@/shared/ui/composites/FilterTokens";
import type { Collaborator } from "@/shared/types";

import { useCrewMembers, useDeleteCrewMember } from "../api/crew.queries";
import { getCrewSpecialtyOption, getCrewSpecialtyOrder } from "../constants/crewSpecialties";
import type { CrewContactCompleteness } from "../types/crew.dto";

export type CrewSort = "name" | "specialty" | "company";

export interface CrewDeletionTarget {
  id: string;
  fullName: string;
}

const hasEmail = (person: Collaborator): boolean => Boolean(person.email?.trim());
const hasPhone = (person: Collaborator): boolean => Boolean(person.phone_number?.trim());

/** A collaborator missing an e-mail or a phone: the quick filter. */
export const lacksFullContact = (person: Collaborator): boolean =>
  !hasEmail(person) || !hasPhone(person);

const matchesContactFilter = (
  person: Collaborator,
  filter: CrewContactCompleteness,
): boolean => {
  switch (filter) {
    case "WITH_EMAIL":
      return hasEmail(person);
    case "WITH_PHONE":
      return hasPhone(person);
    case "FULL_CONTACT":
      return hasEmail(person) && hasPhone(person);
    case "ALL":
    default:
      return true;
  }
};

export const getContactFilterLabel = (
  t: TFunction,
  filter: Exclude<CrewContactCompleteness, "ALL">,
): string => {
  switch (filter) {
    case "WITH_EMAIL":
      return t("crew.contact_filters.with_email", "Z e-mailem");
    case "WITH_PHONE":
      return t("crew.contact_filters.with_phone", "Z telefonem");
    case "FULL_CONTACT":
    default:
      return t("crew.contact_filters.full_contact", "Pełny kontakt");
  }
};

export const useCrewData = () => {
  const { t } = useTranslation();

  const { data: crew = [], isLoading, isError } = useCrewMembers();
  const deleteMutation = useDeleteCrewMember();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [contactFilter, setContactFilter] = useState<CrewContactCompleteness>("ALL");
  const [onlyMissingContact, setOnlyMissingContact] = useState<boolean>(false);
  const [sortBy, setSortBy] = useState<CrewSort>("name");

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Collaborator | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>("");
  const [personToDelete, setPersonToDelete] = useState<CrewDeletionTarget | null>(null);

  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Folded, so "sniadecki" finds Śniadecki — the one fold, shared with every
  // other search in the panel.
  const normalizedSearchTerm = foldDiacritics(searchTerm.trim());

  const availableCompanies = useMemo(
    () =>
      Array.from(
        new Set(
          crew
            .map((person) => person.company_name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((left, right) => left.localeCompare(right, undefined, { sensitivity: "base" })),
    [crew],
  );

  const missingContactCount = useMemo(() => crew.filter(lacksFullContact).length, [crew]);

  // The chip is gone once nobody lacks a contact, so nothing else could switch
  // it off, and the list behind it would stay empty.
  if (onlyMissingContact && !isLoading && missingContactCount === 0) {
    setOnlyMissingContact(false);
  }

  const displayCrew = useMemo(() => {
    const sortName = (person: Collaborator) =>
      `${person.last_name} ${person.first_name}`.trim().toLowerCase();

    const filtered = crew.filter((person) => {
      const haystack = foldDiacritics(
        `${person.first_name} ${person.last_name} ${person.company_name ?? ""} ${person.email ?? ""}`,
      );
      return (
        (normalizedSearchTerm.length === 0 || haystack.includes(normalizedSearchTerm)) &&
        (!specialtyFilter || person.specialty === specialtyFilter) &&
        (!companyFilter || person.company_name?.trim() === companyFilter) &&
        matchesContactFilter(person, contactFilter) &&
        (!onlyMissingContact || lacksFullContact(person))
      );
    });

    return filtered.sort((a, b) => {
      if (sortBy === "specialty") {
        const bySpecialty = getCrewSpecialtyOrder(a.specialty) - getCrewSpecialtyOrder(b.specialty);
        if (bySpecialty !== 0) return bySpecialty;
      } else if (sortBy === "company") {
        const byCompany = (a.company_name?.trim() || "￿").localeCompare(
          b.company_name?.trim() || "￿",
          undefined,
          { sensitivity: "base" },
        );
        if (byCompany !== 0) return byCompany;
      }
      return sortName(a).localeCompare(sortName(b), undefined, { sensitivity: "base" });
    });
  }, [crew, normalizedSearchTerm, specialtyFilter, companyFilter, contactFilter, onlyMissingContact, sortBy]);

  /** Filters in the "Filtry" panel, for the count on its button. */
  const panelFilterCount =
    (specialtyFilter ? 1 : 0) + (companyFilter ? 1 : 0) + (contactFilter !== "ALL" ? 1 : 0);

  const hasActiveFilters = Boolean(normalizedSearchTerm) || panelFilterCount > 0 || onlyMissingContact;

  const activeFilters = useMemo<FilterToken[]>(() => {
    const tokens: FilterToken[] = [];

    if (normalizedSearchTerm) {
      tokens.push({
        id: "search",
        label: t("crew.filters.search_token", 'Fraza: "{{term}}"', { term: searchTerm.trim() }),
        clear: () => setSearchTerm(""),
      });
    }
    if (specialtyFilter) {
      tokens.push({
        id: "specialty",
        label: t("crew.filters.specialty_token", "Specjalizacja: {{label}}", {
          label: getCrewSpecialtyOption(t, specialtyFilter).label,
        }),
        clear: () => setSpecialtyFilter(""),
      });
    }
    if (companyFilter) {
      tokens.push({
        id: "company",
        label: t("crew.filters.company_token", "Firma: {{label}}", { label: companyFilter }),
        clear: () => setCompanyFilter(""),
      });
    }
    if (contactFilter !== "ALL") {
      tokens.push({
        id: "contact",
        label: getContactFilterLabel(t, contactFilter),
        clear: () => setContactFilter("ALL"),
      });
    }
    return tokens;
  }, [companyFilter, contactFilter, normalizedSearchTerm, searchTerm, specialtyFilter, t]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setSpecialtyFilter("");
    setCompanyFilter("");
    setContactFilter("ALL");
  }, []);

  const openPanel = useCallback((person: Collaborator | null = null, searchContext: string = "") => {
    if (closeResetTimeoutRef.current) {
      clearTimeout(closeResetTimeoutRef.current);
      closeResetTimeoutRef.current = null;
    }
    setEditingPerson(person);
    setInitialSearchContext(searchContext);
    setIsPanelOpen(true);
  }, []);

  const closePanel = useCallback(() => {
    setIsPanelOpen(false);
    if (closeResetTimeoutRef.current) {
      clearTimeout(closeResetTimeoutRef.current);
    }
    closeResetTimeoutRef.current = setTimeout(() => {
      setEditingPerson(null);
      setInitialSearchContext("");
      closeResetTimeoutRef.current = null;
    }, 300);
  }, []);

  useEffect(() => {
    return () => {
      if (closeResetTimeoutRef.current) {
        clearTimeout(closeResetTimeoutRef.current);
      }
    };
  }, []);

  const requestDelete = useCallback((person: Collaborator) => {
    if (!person.id) return;
    setPersonToDelete({
      id: person.id,
      fullName: `${person.first_name} ${person.last_name}`.trim(),
    });
  }, []);

  const cancelDelete = useCallback(() => {
    setPersonToDelete(null);
  }, []);

  const executeDelete = async (): Promise<void> => {
    if (!personToDelete) return;

    const toastId = toast.loading(
      t("crew.toast.delete_loading", 'Usuwanie "{{name}}"...', {
        name: personToDelete.fullName,
      }),
    );

    try {
      await deleteMutation.mutateAsync(personToDelete.id);
      toast.success(t("crew.toast.delete_success", "Usunięto osobę z ekipy."), {
        id: toastId,
      });
    } catch (error) {
      toastApiError(error, t, {
        id: toastId,
        fallbackDescription: t(
          "crew.toast.delete_error_desc",
          "Prawdopodobnie jest przypisana do koncertu; jej dane można tylko poprawić.",
        ),
      });
    } finally {
      setPersonToDelete(null);
    }
  };

  return {
    // Server snapshot
    crew,
    isLoading,
    isError,

    // Derived list & metadata
    displayCrew,
    availableCompanies,
    missingContactCount,
    activeFilters,
    hasActiveFilters,
    panelFilterCount,

    // Filter state
    searchTerm,
    setSearchTerm,
    specialtyFilter,
    setSpecialtyFilter,
    companyFilter,
    setCompanyFilter,
    contactFilter,
    setContactFilter,
    onlyMissingContact,
    setOnlyMissingContact,
    sortBy,
    setSortBy,
    resetFilters,

    // Editor lifecycle
    isPanelOpen,
    editingPerson,
    initialSearchContext,
    openPanel,
    closePanel,

    // Deletion lifecycle
    personToDelete,
    requestDelete,
    cancelDelete,
    isDeleting: deleteMutation.isPending,
    executeDelete,
  };
};
