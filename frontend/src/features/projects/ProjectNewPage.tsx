/**
 * @file ProjectNewPage.tsx
 * @description Dedicated route for creating a project. Reuses the existing
 * DetailsTab in create mode (project = null); on success the form hands back the
 * persisted project and we land on its hub. Mirrors the archive new-piece route.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/ProjectNewPage
 */

import React, { useCallback, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { ArrowLeft, ChevronRight } from "lucide-react";

import type { Project } from "@/shared/types";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";
import { Button } from "@/shared/ui/primitives/Button";
import { Heading } from "@/shared/ui/primitives/typography";
import { useUnsavedChangesWarning } from "@/shared/lib/dom/useUnsavedChangesWarning";

import { DetailsTab } from "./editors/tabs/DetailsTab";

export default function ProjectNewPage(): React.JSX.Element {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [isDirty, setDirty] = useState<boolean>(false);

  useUnsavedChangesWarning(isDirty);

  const handleSuccess = useCallback(
    (created?: Project) => {
      setDirty(false);
      if (created?.id) {
        navigate(`/panel/projects/${created.id}`);
      }
    },
    [navigate],
  );

  return (
    <PageTransition>
      <div className="relative mx-auto max-w-4xl pb-24 pt-6">
        <header className="mb-5 flex items-center gap-3">
          <Button
            asChild
            variant="ghost"
            size="sm"
            leftIcon={<ArrowLeft size={14} aria-hidden="true" />}
          >
            <Link to="/panel/projects">
              {t("projects.hub.back", "Wydarzenia")}
            </Link>
          </Button>
          <ChevronRight
            size={14}
            aria-hidden="true"
            className="text-ethereal-graphite/40"
          />
          <Heading as="h1" size="2xl" weight="medium">
            {t("projects.editor.new_project_title", "Tworzenie nowego projektu")}
          </Heading>
        </header>

        <DetailsTab
          project={null}
          onSuccess={handleSuccess}
          onDirtyStateChange={setDirty}
        />
      </div>
    </PageTransition>
  );
}
