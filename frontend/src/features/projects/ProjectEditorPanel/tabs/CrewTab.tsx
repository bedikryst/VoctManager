/**
 * @file CrewTab.tsx
 * @description External Collaborator and Crew Logistics Manager.
 * Employs Hash Maps and Sets for rapid resolution of available crew members.
 * Integrates Framer Motion `<AnimatePresence>` for fluid list mutation animations.
 * @architecture Enterprise SaaS 2026
 * @module panel/projects/ProjectEditorPanel/tabs/CrewTab
 */

import React from "react";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Plus, Wrench, Trash2 } from "lucide-react";

import { useCrewAssignments } from "../hooks/useCrewAssignments";
import { GlassCard } from "@/shared/ui/composites/GlassCard";
import { Button } from "@/shared/ui/primitives/Button";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { EtherealLoader } from "@/shared/ui/kinematics/EtherealLoader";
import {
  Eyebrow,
  Text,
} from "@/shared/ui/primitives/typography";

interface CrewTabProps {
  projectId: string;
}

export const CrewTab = ({
  projectId,
}: CrewTabProps): React.JSX.Element | null => {
  const { t } = useTranslation();
  const {
    isLoading,
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
    <div className="mx-auto max-w-4xl space-y-8 pb-12">
      <form onSubmit={handleAssign}>
        <GlassCard
          variant="ethereal"
          padding="md"
          isHoverable={false}
          className="flex flex-col items-end gap-5 md:flex-row"
        >
          <div className="w-full flex-1">
            <Select
              label={t("projects.crew.form.hire_label", "Zatrudnij z bazy")}
              required
              value={selectedCrewId}
              onChange={(event) => setSelectedCrewId(event.target.value)}
              disabled={isMutating}
            >
              <option value="">
                {t(
                  "projects.crew.form.select_placeholder",
                  "— Wybierz współpracownika —",
                )}
              </option>
              {availableCrew.map((collaborator) => (
                <option key={collaborator.id} value={collaborator.id}>
                  {collaborator.first_name} {collaborator.last_name} (
                  {collaborator.specialty})
                </option>
              ))}
            </Select>
          </div>

          <div className="w-full flex-1">
            <Input
              label={t(
                "projects.crew.form.role_label",
                "Rola na tym koncercie",
              )}
              type="text"
              value={roleDesc}
              onChange={(event) => setRoleDesc(event.target.value)}
              placeholder={t(
                "projects.crew.form.role_placeholder",
                "np. Akustyk FOH",
              )}
              disabled={isMutating}
            />
          </div>

          <Button
            type="submit"
            variant="primary"
            disabled={isMutating || !selectedCrewId}
            isLoading={isMutating}
            leftIcon={
              !isMutating ? <Plus size={14} aria-hidden="true" /> : undefined
            }
            className="w-full md:w-auto"
          >
            {t("projects.crew.form.submit", "Przypisz")}
          </Button>
        </GlassCard>
      </form>

      <GlassCard
        variant="ethereal"
        padding="none"
        isHoverable={false}
        className="overflow-hidden"
      >
        <div className="relative z-10 flex items-center justify-between border-b border-ethereal-incense/20 bg-ethereal-parchment/40 p-5">
          <div className="flex items-center gap-2.5">
            <GlassCard
              variant="light"
              padding="none"
              isHoverable={false}
              className="flex h-8 w-8 items-center justify-center"
            >
              <Wrench
                size={14}
                className="text-ethereal-graphite"
                aria-hidden="true"
              />
            </GlassCard>
            <Eyebrow color="default">
              {t("projects.crew.list.title", "Skład Ekipy (Crew)")}
            </Eyebrow>
          </div>
          <Eyebrow color="muted">
            {t("projects.crew.list.assigned_count", "Przypisano: {{count}}", {
              count: projectAssignments.length,
            })}
          </Eyebrow>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-10">
            <EtherealLoader />
          </div>
        ) : (
          <div className="ethereal-scroll max-h-125 divide-y divide-ethereal-incense/10 overflow-y-auto overflow-x-hidden [scrollbar-gutter:stable]">
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
                      className="flex items-center justify-between p-5 transition-colors hover:bg-ethereal-marble/50"
                    >
                      <div className="flex flex-col gap-0.5">
                        <Text size="sm" weight="bold">
                          {person.first_name} {person.last_name}
                        </Text>
                        <Eyebrow color="muted">
                          {assignment.role_description || person.specialty}{" "}
                          {person.company_name && `(${person.company_name})`}
                        </Eyebrow>
                      </div>
                      <Button
                        type="button"
                        variant="icon"
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
                  className="p-8 text-center"
                >
                  <Text size="xs" color="muted" className="italic">
                    {t(
                      "projects.crew.empty",
                      "Brak przypisanej ekipy technicznej.",
                    )}
                  </Text>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        )}
      </GlassCard>
    </div>
  );
};
