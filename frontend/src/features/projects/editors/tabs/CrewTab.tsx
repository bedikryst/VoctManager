/**
 * @file CrewTab.tsx
 * @description Technical-crew console: a compact "add collaborator" form (left) beside the
 * live crew roster (right). Assignments persist on the explicit submit / remove actions
 * (deliberate single ops — no per-keystroke lag), so no deferred buffer is needed here.
 * Two columns on desktop, stacked on tablet/phone; the roster is height-capped with scroll.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/CrewTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Wrench, Trash2 } from "lucide-react";

import { useCrewAssignments } from "../hooks/useCrewAssignments";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { AutosaveStatus } from "@/shared/ui/composites/AutosaveStatus";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Eyebrow, Text } from "@/shared/ui/primitives/typography";

interface CrewTabProps {
  projectId: string;
}

export const CrewTab = ({
  projectId,
}: CrewTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    isMutating,
    selectedCrewId,
    setSelectedCrewId,
    roleDesc,
    setRoleDesc,
    availableCrew,
    projectAssignments,
    crewMap,
    handleAssign,
    handleRemove,
  } = useCrewAssignments(projectId);

  return (
    <>
      <div className="grid w-full grid-cols-1 gap-6 pb-12 lg:grid-cols-12 lg:items-start">
        {/* ── Add collaborator ─────────────────────────────────────────── */}
        <form onSubmit={handleAssign} className="lg:col-span-4">
          <SectionCard
            as="h2"
            bodyClassName="gap-5"
            icon={<Plus size={15} aria-hidden="true" />}
            title={t("projects.crew.form.title", "Dodaj do zespołu")}
          >
            <Select
              label={t("projects.crew.form.hire_label", "Zatrudnij z bazy")}
              required
              value={selectedCrewId}
              onValueChange={setSelectedCrewId}
              disabled={isMutating}
              placeholder={t(
                "projects.crew.form.select_placeholder",
                "Wybierz współpracownika",
              )}
              options={availableCrew.map((collaborator) => ({
                value: String(collaborator.id),
                label: `${collaborator.first_name} ${collaborator.last_name} (${collaborator.specialty})`,
              }))}
            />

            <Input
              label={t("projects.crew.form.role_label", "Rola na tym koncercie")}
              type="text"
              value={roleDesc}
              onChange={(event) => setRoleDesc(event.target.value)}
              placeholder={t("projects.crew.form.role_placeholder", "np. Akustyk FOH")}
              disabled={isMutating}
            />

            <Button
              type="submit"
              variant="primary"
              fullWidth
              disabled={isMutating || !selectedCrewId}
              isLoading={isMutating}
              leftIcon={
                !isMutating ? <Plus size={14} aria-hidden="true" /> : undefined
              }
            >
              {t("projects.crew.form.submit", "Przypisz")}
            </Button>
          </SectionCard>
        </form>

        {/* ── Crew roster ──────────────────────────────────────────────── */}
        <SectionCard
          as="h2"
          scroll
          className="max-h-[70dvh] lg:col-span-8"
          bodyClassName="divide-y divide-hairline p-0"
          icon={<Wrench size={15} aria-hidden="true" />}
          title={t("projects.crew.list.title", "Skład Ekipy (Crew)")}
          action={
            projectAssignments.length > 0 ? (
              <Badge variant="neutral">{projectAssignments.length}</Badge>
            ) : undefined
          }
        >
          <AnimatePresence initial={false}>
              {projectAssignments.length > 0 ? (
                projectAssignments.map((assignment) => {
                  const person = crewMap.get(String(assignment.collaborator));
                  if (!person) return null;

                  return (
                    <motion.div
                      key={assignment.id}
                      layout
                      initial={{ opacity: 0, y: -10 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95 }}
                      transition={{ duration: 0.2 }}
                      className="group flex items-center justify-between gap-3 px-5 py-3.5 transition-colors hover:bg-ethereal-alabaster/55"
                    >
                      <div className="flex min-w-0 flex-col gap-0.5">
                        <Text size="sm" weight="bold" truncate>
                          {person.first_name} {person.last_name}
                        </Text>
                        <Eyebrow color="muted" className="truncate">
                          {assignment.role_description || person.specialty}
                          {person.company_name ? ` · ${person.company_name}` : ""}
                        </Eyebrow>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => handleRemove(String(assignment.id))}
                        disabled={isMutating}
                        title={t(
                          "projects.crew.list.remove_title",
                          "Usuń z ekipy technicznej",
                        )}
                        aria-label={t(
                          "projects.crew.list.remove_title",
                          "Usuń z ekipy technicznej",
                        )}
                        className="shrink-0 text-ethereal-graphite/50 hover:bg-ethereal-crimson/10 hover:text-ethereal-crimson"
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </Button>
                    </motion.div>
                  );
                })
              ) : (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="flex flex-col items-center justify-center gap-2 px-6 py-16 text-center"
                >
                  <Wrench
                    size={28}
                    className="text-ethereal-incense/30"
                    aria-hidden="true"
                  />
                  <Text color="muted" className="italic">
                    {t(
                      "projects.crew.empty",
                      "Brak przypisanej ekipy technicznej.",
                    )}
                  </Text>
                </motion.div>
              )}
          </AnimatePresence>
        </SectionCard>
      </div>

      <AutosaveStatus isSaving={isMutating} />
    </>
  );
};
