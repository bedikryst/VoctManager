/**
 * @file PreviewRefusal.tsx
 * @description What the preview shows when there is no view to show.
 *
 * The reason travels as a SENTENCE, not a code. `core/preview.py` raises DRF
 * exceptions whose `default_code` the shared error envelope
 * (`core/exceptions.py::enterprise_exception_handler`) throws away, deriving
 * `error_code` from the HTTP status instead and nesting the original message
 * under `errors.detail`. So `parseApiError().code` here is only ever
 * `conflict` / `not_found` / `forbidden` — three statuses covering, between
 * them, "no account yet", "archived", "no such member" and "you may not ask".
 * The server already wrote the distinction in the reader's language; this panel
 * renders it verbatim rather than branching on a code that is not there.
 *
 * The one thing the screen adds is what to do next, which the server has no
 * business knowing: a member with no account is waiting for an invitation, and
 * that is a manager action on the roster.
 * @module features/artist-preview/components/PreviewRefusal
 */

import React from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { EyeOff } from "lucide-react";

import { parseApiError } from "@/shared/api/errors";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";

interface PreviewRefusalProps {
  error: unknown;
}

export const PreviewRefusal = ({
  error,
}: PreviewRefusalProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { serverMessage } = parseApiError(error);

  return (
    <StatePanel
      icon={<EyeOff size={22} aria-hidden="true" />}
      eyebrow={t("artist_preview.eyebrow", "Podgląd chórzysty")}
      title={t("artist_preview.refused.title", "Nie ma czego pokazać")}
      description={
        serverMessage ??
        t(
          "artist_preview.refused.fallback",
          "Nie udało się otworzyć widoku tej osoby.",
        )
      }
      actions={
        <Button variant="outline" size="sm" asChild>
          <Link to="/panel/artists">
            {t("artist_preview.back_to_roster", "Baza Artystów")}
          </Link>
        </Button>
      }
    />
  );
};
