/**
 * @file CopyDeskReviewPage.tsx
 * @description `/redakcja/przeglad` — the reviewer's entrance. Default export
 * required for the lazy route.
 *
 * This address is already promised in three places that shipped with stage B:
 * the push notification, the digest e-mail's CTA and the bell's deep link. It
 * therefore has to answer, and answer honestly — the queue itself is the next
 * surface, and until it exists there is nothing here to settle, because nothing
 * can propose a change yet.
 *
 * Reviewing is `is_staff`, not the copy-desk capability: accepting is not an
 * opinion about wording, it is the decision to put a value into the repository
 * and commit it. An editor who reaches this address is told that, rather than
 * being shown an empty queue they could never have filled.
 * @architecture Enterprise SaaS 2026
 * @module pages/copydesk/CopyDeskReviewPage
 */

import React from "react";
import { Link, useOutletContext } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { GitPullRequestArrow, ShieldCheck } from "lucide-react";

import type { CopyDeskOutletContext } from "@/widgets/copy-desk-shell/CopyDeskShell";
import { PageHeader } from "@/shared/ui/composites/PageHeader";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Button } from "@/shared/ui/primitives/Button";
import { PageTransition } from "@/shared/ui/kinematics/PageTransition";

export default function CopyDeskReviewPage(): React.JSX.Element {
  const { t } = useTranslation();
  const { contents } = useOutletContext<CopyDeskOutletContext>();

  const backToContents = (
    <Button variant="outline" size="sm" asChild>
      <Link to="/redakcja">{t("copy_desk.review.back", "Spis treści")}</Link>
    </Button>
  );

  return (
    <PageTransition className="min-h-0">
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-5 pb-16 pt-6">
        <PageHeader
          title={t("copy_desk.review.title", "Przegląd")}
          titleHighlight={t("copy_desk.review.title_highlight", "zmian")}
        />

        {contents.is_reviewer ? (
          <StatePanel
            icon={<GitPullRequestArrow size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t("copy_desk.review.empty_title", "Nic tu jeszcze nie czeka")}
            description={t(
              "copy_desk.review.empty_description",
              "Wnioski redaktorów pojawią się tutaj, kiedy desk otworzy się do pisania. Przyjęte zmiany i tak trafiają na serwis dopiero przez commit.",
            )}
            actions={backToContents}
          />
        ) : (
          <StatePanel
            icon={<ShieldCheck size={22} aria-hidden="true" />}
            eyebrow={t("copy_desk.eyebrow", "Redakcja")}
            title={t(
              "copy_desk.review.refused_title",
              "Przegląd należy do wydawcy",
            )}
            description={t(
              "copy_desk.review.refused_description",
              "Przyjęcie zmiany kończy się wpisem do repozytorium, więc rozstrzyga ją osoba, która publikuje serwis. Twoje propozycje czekają na nią w spisie.",
            )}
            actions={backToContents}
          />
        )}
      </div>
    </PageTransition>
  );
}
