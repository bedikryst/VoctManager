/**
 * @file useCrewData.ts
 * @description Operational orchestrator for the Crew domain — derives metrics, filter state,
 * active filter chips, and deletion lifecycle on top of the React Query cache.
 * Server state stays delegated to `crew.queries`; this hook owns purely UI logic.
 * @architecture Enterprise SaaS 2026
 * @module features/crew/hooks/useCrewData
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";

import type { Collaborator, CollaboratorSpecialty } from "@/shared/types";

import { useCrewMembers, useDeleteCrewMember } from "../api/crew.queries";
import {
  getCrewSpecialtyOption,
  getCrewSpecialtyOptions,
} from "../constants/crewSpecialties";
import type { CrewContactCompleteness } from "../types/crew.dto";

export interface CrewActiveFilter {
  id: string;
  label: string;
  clear: () => void;
}

export interface CrewMetrics {
  totalPeople: number;
  withEmail: number;
  withPhone: number;
  withFullContact: number;
  uniqueCompanies: number;
  uniqueSpecialties: number;
  topSpecialty: {
    value: CollaboratorSpecialty;
    count: number;
  } | null;
}

export interface CrewDeletionTarget {
  id: string;
  fullName: string;
}

const matchesContactFilter = (
  person: Collaborator,
  filter: CrewContactCompleteness,
): boolean => {
  const hasEmail = Boolean(person.email && person.email.trim());
  const hasPhone = Boolean(person.phone_number && person.phone_number.trim());

  switch (filter) {
    case "WITH_EMAIL":
      return hasEmail;
    case "WITH_PHONE":
      return hasPhone;
    case "FULL_CONTACT":
      return hasEmail && hasPhone;
    case "MISSING_CONTACT":
      return !hasEmail || !hasPhone;
    case "ALL":
    default:
      return true;
  }
};

const getContactFilterLabel = (
  t: TFunction,
  filter: CrewContactCompleteness,
): string => {
  switch (filter) {
    case "WITH_EMAIL":
      return t("crew.contact_filters.with_email", "Z e-mailem");
    case "WITH_PHONE":
      return t("crew.contact_filters.with_phone", "Z telefonem");
    case "FULL_CONTACT":
      return t("crew.contact_filters.full_contact", "Pełny kontakt");
    case "MISSING_CONTACT":
      return t("crew.contact_filters.missing_contact", "Niekompletny kontakt");
    case "ALL":
    default:
      return t("crew.contact_filters.all", "Dowolny kontakt");
  }
};

export const useCrewData = () => {
  const { t } = useTranslation();

  const { data: crew = [], isLoading, isError } = useCrewMembers();
  const deleteMutation = useDeleteCrewMember();

  const [searchTerm, setSearchTerm] = useState<string>("");
  const [specialtyFilter, setSpecialtyFilter] = useState<string>("");
  const [companyFilter, setCompanyFilter] = useState<string>("");
  const [contactFilter, setContactFilter] =
    useState<CrewContactCompleteness>("ALL");

  const [isPanelOpen, setIsPanelOpen] = useState<boolean>(false);
  const [editingPerson, setEditingPerson] = useState<Collaborator | null>(null);
  const [initialSearchContext, setInitialSearchContext] = useState<string>("");
  const [personToDelete, setPersonToDelete] =
    useState<CrewDeletionTarget | null>(null);

  const closeResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  const normalizedSearchTerm = searchTerm.trim().toLowerCase();

  const availableCompanies = useMemo(
    () =>
      Array.from(
        new Set(
          crew
            .map((person) => person.company_name?.trim())
            .filter((name): name is string => Boolean(name)),
        ),
      ).sort((left, right) =>
        left.localeCompare(right, undefined, { sensitivity: "base" }),
      ),
    [crew],
  );

  const displayCrew = useMemo(() => {
    return crew.filter((person) => {
      const haystack =
        `${person.first_name} ${person.last_name} ${person.company_name ?? ""} ${person.email ?? ""}`.toLowerCase();
      const matchesSearch =
        normalizedSearchTerm.length === 0 ||
        haystack.includes(normalizedSearchTerm);
      const matchesSpecialty = specialtyFilter
        ? person.specialty === specialtyFilter
        : true;
      const matchesCompany = companyFilter
        ? person.company_name?.trim() === companyFilter
        : true;
      const matchesContact = matchesContactFilter(person, contactFilter);

      return (
        matchesSearch && matchesSpecialty && matchesCompany && matchesContact
      );
    });
  }, [
    crew,
    normalizedSearchTerm,
    specialtyFilter,
    companyFilter,
    contactFilter,
  ]);

  const metrics: CrewMetrics = useMemo(() => {
    const specialtyCounts = new Map<CollaboratorSpecialty, number>();
    let withEmail = 0;
    let withPhone = 0;
    let withFullContact = 0;

    for (const person of crew) {
      const hasEmail = Boolean(person.email && person.email.trim());
      const hasPhone = Boolean(
        person.phone_number && person.phone_number.trim(),
      );
      if (hasEmail) withEmail += 1;
      if (hasPhone) withPhone += 1;
      if (hasEmail && hasPhone) withFullContact += 1;
      specialtyCounts.set(
        person.specialty,
        (specialtyCounts.get(person.specialty) ?? 0) + 1,
      );
    }

    let topSpecialty: CrewMetrics["topSpecialty"] = null;
    for (const [value, count] of specialtyCounts.entries()) {
      if (!topSpecialty || count > topSpecialty.count) {
        topSpecialty = { value, count };
      }
    }

    return {
      totalPeople: crew.length,
      withEmail,
      withPhone,
      withFullContact,
      uniqueCompanies: availableCompanies.length,
      uniqueSpecialties: specialtyCounts.size,
      topSpecialty,
    };
  }, [crew, availableCompanies.length]);

  const hasActiveFilters = Boolean(
    normalizedSearchTerm ||
      specialtyFilter ||
      companyFilter ||
      contactFilter !== "ALL",
  );

  const activeFilterCount = [
    normalizedSearchTerm,
    specialtyFilter,
    companyFilter,
    contactFilter !== "ALL" ? contactFilter : "",
  ].filter(Boolean).length;

  const activeFilters = useMemo<CrewActiveFilter[]>(() => {
    const tokens: CrewActiveFilter[] = [];

    if (normalizedSearchTerm) {
      tokens.push({
        id: "search",
        label: t("crew.filters.search_token", 'Fraza: "{{term}}"', {
          term: searchTerm.trim(),
        }),
        clear: () => setSearchTerm(""),
      });
    }

    if (specialtyFilter) {
      const option = getCrewSpecialtyOption(t, specialtyFilter);
      tokens.push({
        id: "specialty",
        label: t("crew.filters.specialty_token", "Specjalizacja: {{label}}", {
          label: option.label,
        }),
        clear: () => setSpecialtyFilter(""),
      });
    }

    if (companyFilter) {
      tokens.push({
        id: "company",
        label: t("crew.filters.company_token", "Firma: {{label}}", {
          label: companyFilter,
        }),
        clear: () => setCompanyFilter(""),
      });
    }

    if (contactFilter !== "ALL") {
      tokens.push({
        id: "contact",
        label: t("crew.filters.contact_token", "Kontakt: {{label}}", {
          label: getContactFilterLabel(t, contactFilter),
        }),
        clear: () => setContactFilter("ALL"),
      });
    }

    return tokens;
  }, [
    companyFilter,
    contactFilter,
    normalizedSearchTerm,
    searchTerm,
    specialtyFilter,
    t,
  ]);

  const specialtyOptions = useMemo(() => getCrewSpecialtyOptions(t), [t]);

  const resetFilters = useCallback(() => {
    setSearchTerm("");
    setSpecialtyFilter("");
    setCompanyFilter("");
    setContactFilter("ALL");
  }, []);

  const openPanel = useCallback(
    (person: Collaborator | null = null, searchContext: string = "") => {
      if (closeResetTimeoutRef.current) {
        clearTimeout(closeResetTimeoutRef.current);
        closeResetTimeoutRef.current = null;
      }
      setEditingPerson(person);
      setInitialSearchContext(searchContext);
      setIsPanelOpen(true);
    },
    [],
  );

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
      toast.success(
        t("crew.toast.delete_success", "Osoba została usunięta z bazy."),
        { id: toastId },
      );
    } catch {
      toast.error(
        t("crew.toast.delete_error_title", "Nie można usunąć tej osoby"),
        {
          id: toastId,
          description: t(
            "crew.toast.delete_error_desc",
            "Prawdopodobnie jest ona powiązana z istniejącymi projektami. Spróbuj edytować jej dane.",
          ),
        },
      );
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
    metrics,
    availableCompanies,
    specialtyOptions,
    activeFilters,
    hasActiveFilters,
    activeFilterCount,

    // Filter state
    searchTerm,
    setSearchTerm,
    specialtyFilter,
    setSpecialtyFilter,
    companyFilter,
    setCompanyFilter,
    contactFilter,
    setContactFilter,
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
