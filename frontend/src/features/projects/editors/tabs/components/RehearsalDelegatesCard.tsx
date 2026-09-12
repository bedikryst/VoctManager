/**
 * @file RehearsalDelegatesCard.tsx
 * @description Handing one programme to somebody who is not a manager: who may
 * run its rehearsals, what that opens for them, and until when.
 *
 * It lives beside the schedule rather than on the score, even though the score
 * is where the conductor thinks of it, because a delegation is not a property of
 * one piece — it covers a whole programme and the evenings in it. Putting the
 * control where it is granted keeps one list rather than a second, disagreeing
 * one on every score.
 *
 * The three scopes are separate switches because they leak differently, and the
 * copy says what each opens instead of naming an internal layer: a conductor
 * deciding this is deciding who reads his hand, not choosing a permission.
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import { CalendarOff, ClipboardCheck, FolderOpen, PenLine, UserPlus, X } from "lucide-react";

import {
  useGrantDelegate,
  useProjectDelegates,
  useRevokeDelegate,
  type RehearsalDelegate,
} from "../../../api/project.delegates";
import { ConfirmModal } from "@/shared/ui/composites/ConfirmModal";
import { DateTimeField } from "@/shared/ui/composites/DateTimeField";
import { SectionCard } from "@/shared/ui/composites/SectionCard";
import { StatePanel } from "@/shared/ui/composites/StatePanel";
import { Badge } from "@/shared/ui/primitives/Badge";
import { Button } from "@/shared/ui/primitives/Button";
import { Checkbox } from "@/shared/ui/primitives/Checkbox";
import { Input } from "@/shared/ui/primitives/Input";
import { Select } from "@/shared/ui/primitives/Select";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";

interface DelegateCandidate {
  id: string;
  name: string;
}

interface RehearsalDelegatesCardProps {
  projectId: string;
  /** The cast, as the people a rehearsal is most often handed to. */
  candidates: readonly DelegateCandidate[];
}

interface DraftState {
  artist: string;
  marks: boolean;
  rollCall: boolean;
  materials: boolean;
  /** Wall-clock string from DateTimeField, or "" for "until the project closes". */
  expiresAt: string;
  note: string;
}

const EMPTY_DRAFT: DraftState = {
  artist: "",
  marks: true,
  rollCall: true,
  materials: true,
  expiresAt: "",
  note: "",
};

export const RehearsalDelegatesCard = ({
  projectId,
  candidates,
}: RehearsalDelegatesCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: delegates = [], isLoading } = useProjectDelegates(projectId);
  const grant = useGrantDelegate(projectId);
  const revoke = useRevokeDelegate(projectId);

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [composing, setComposing] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<RehearsalDelegate | null>(
    null,
  );

  const scopeChosen = draft.marks || draft.rollCall || draft.materials;
  const canSubmit = Boolean(draft.artist) && scopeChosen && !grant.isPending;

  const submit = (): void => {
    if (!canSubmit) return;
    grant.mutate(
      {
        artist: draft.artist,
        can_see_leader_marks: draft.marks,
        can_take_roll_call: draft.rollCall,
        can_open_materials: draft.materials,
        // The field speaks wall clock; the server reads the instant. Empty is
        // not "now", it is "no end of its own" — see the model.
        expires_at: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
        note: draft.note.trim(),
      },
      {
        onSuccess: () => {
          setDraft(EMPTY_DRAFT);
          setComposing(false);
        },
      },
    );
  };

  const scopeLabels = (row: RehearsalDelegate): string[] => {
    const labels: string[] = [];
    if (row.can_see_leader_marks) {
      labels.push(t("projects.delegates.scope.marks_short", "Notatki"));
    }
    if (row.can_take_roll_call) {
      labels.push(t("projects.delegates.scope.roll_call_short", "Obecność"));
    }
    if (row.can_open_materials) {
      labels.push(t("projects.delegates.scope.materials_short", "Materiały"));
    }
    return labels;
  };

  return (
    <>
      <SectionCard
        as="h2"
        icon={<UserPlus size={15} aria-hidden="true" />}
        title={t("projects.delegates.title", "Prowadzenie prób")}
        action={
          delegates.length > 0 ? (
            <Badge variant="neutral">{delegates.length}</Badge>
          ) : undefined
        }
      >
        <Caption as="p" color="graphite">
          {t(
            "projects.delegates.description",
            "Osoba spoza grona menedżerów, która poprowadzi próby tego projektu w Twoim zastępstwie.",
          )}
        </Caption>

        {isLoading ? null : delegates.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {delegates.map((row) => (
              <li
                key={row.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-nested border border-hairline bg-ethereal-alabaster/50 px-3 py-2.5"
              >
                <div className="min-w-0">
                  <Text as="p" weight="medium" className="truncate">
                    {row.artist_name}
                  </Text>
                  <div className="mt-1 flex flex-wrap items-center gap-1.5">
                    {scopeLabels(row).map((label) => (
                      <Badge key={label} variant="neutral">
                        {label}
                      </Badge>
                    ))}
                    {row.expires_at ? (
                      <Caption color="graphite">
                        {t("projects.delegates.until", "do {{date}}", {
                          date: formatLocalizedDate(row.expires_at, {
                            day: "numeric",
                            month: "short",
                          }),
                        })}
                      </Caption>
                    ) : (
                      <Caption color="graphite">
                        {t(
                          "projects.delegates.until_project_ends",
                          "do zakończenia projektu",
                        )}
                      </Caption>
                    )}
                  </div>
                  {row.note && (
                    <Caption as="p" color="graphite" className="mt-1 truncate">
                      {row.note}
                    </Caption>
                  )}
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  leftIcon={<X size={14} aria-hidden="true" />}
                  onClick={() => setPendingRevoke(row)}
                >
                  {t("projects.delegates.revoke", "Cofnij")}
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <StatePanel
            variant="inline"
            className="py-8"
            icon={<CalendarOff size={22} aria-hidden="true" />}
            title={t("projects.delegates.empty.title", "Nikt nie ma zastępstwa")}
            description={t(
              "projects.delegates.empty.description",
              "Próby prowadzisz Ty i pozostali menedżerowie.",
            )}
          />
        )}

        {composing ? (
          <div className="mt-4 flex flex-col gap-4 rounded-nested border border-hairline-strong p-4">
            <Select
              label={t("projects.delegates.form.person", "Kto poprowadzi")}
              placeholder={t(
                "projects.delegates.form.person_placeholder",
                "Wybierz osobę",
              )}
              value={draft.artist}
              onValueChange={(value) => setDraft({ ...draft, artist: value })}
              options={candidates.map((candidate) => ({
                value: candidate.id,
                label: candidate.name,
              }))}
            />

            <div className="flex flex-col gap-2.5">
              <ScopeRow
                icon={<PenLine size={14} aria-hidden="true" />}
                checked={draft.marks}
                onChange={(next) => setDraft({ ...draft, marks: next })}
                label={t(
                  "projects.delegates.scope.marks",
                  "Widzi Twoje notatki dla prowadzącego",
                )}
                hint={t(
                  "projects.delegates.scope.marks_hint",
                  "Tylko warstwa „Dla prowadzącego”. Twoje prywatne notatki zostają prywatne.",
                )}
              />
              <ScopeRow
                icon={<ClipboardCheck size={14} aria-hidden="true" />}
                checked={draft.rollCall}
                onChange={(next) => setDraft({ ...draft, rollCall: next })}
                label={t(
                  "projects.delegates.scope.roll_call",
                  "Sprawdza obecność na próbie",
                )}
                hint={t(
                  "projects.delegates.scope.roll_call_hint",
                  "Może odhaczyć cały chór, nie tylko siebie.",
                )}
              />
              <ScopeRow
                icon={<FolderOpen size={14} aria-hidden="true" />}
                checked={draft.materials}
                onChange={(next) => setDraft({ ...draft, materials: next })}
                label={t(
                  "projects.delegates.scope.materials",
                  "Otwiera materiały projektu",
                )}
                hint={t(
                  "projects.delegates.scope.materials_hint",
                  "Potrzebne, gdy ta osoba nie śpiewa w tym programie.",
                )}
              />
            </div>

            <div className="flex flex-col gap-1">
              <DateTimeField
                label={t(
                  "projects.delegates.form.expires",
                  "Do kiedy (opcjonalnie)",
                )}
                value={draft.expiresAt}
                onChange={(next) => setDraft({ ...draft, expiresAt: next })}
                clearable
              />
              <Caption as="p" color="graphite">
                {t(
                  "projects.delegates.form.expires_hint",
                  "Puste = do zakończenia projektu.",
                )}
              </Caption>
            </div>

            <Input
              label={t("projects.delegates.form.note", "Notatka (opcjonalnie)")}
              value={draft.note}
              maxLength={200}
              onChange={(event) =>
                setDraft({ ...draft, note: event.target.value })
              }
              placeholder={t(
                "projects.delegates.form.note_placeholder",
                "np. zastępstwo 10–24 grudnia",
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button
                type="button"
                variant="ghost"
                onClick={() => {
                  setDraft(EMPTY_DRAFT);
                  setComposing(false);
                }}
              >
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button type="button" onClick={submit} disabled={!canSubmit}>
                {t("projects.delegates.form.submit", "Powierz prowadzenie")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="touch"
            leftIcon={<UserPlus size={14} aria-hidden="true" />}
            onClick={() => setComposing(true)}
            className="mt-4 w-full sm:w-auto"
          >
            {t("projects.delegates.add", "Powierz komuś prowadzenie")}
          </Button>
        )}
      </SectionCard>

      <ConfirmModal
        isOpen={pendingRevoke !== null}
        title={t("projects.delegates.confirm.title", "Cofnąć zastępstwo?")}
        // Said plainly, because the web cannot do more than this: the source
        // closes, what somebody already read they have read. Worded without a
        // gendered verb: this names whoever the manager picked, and Polish would
        // otherwise have to guess.
        description={t("projects.delegates.confirm.description", {
          defaultValue:
            "{{name}} straci dostęp do notatek i obecności tego projektu. Kopia pobrana wcześniej na urządzenie tej osoby zostanie tam do czasu wyczyszczenia pamięci aplikacji.",
          name: pendingRevoke?.artist_name ?? "",
        })}
        confirmText={t("projects.delegates.revoke", "Cofnij")}
        isDestructive
        isLoading={revoke.isPending}
        onConfirm={() => {
          if (!pendingRevoke) return;
          revoke.mutate(pendingRevoke.id, {
            onSuccess: () => setPendingRevoke(null),
          });
        }}
        onCancel={() => setPendingRevoke(null)}
      />
    </>
  );
};

const ScopeRow = ({
  icon,
  checked,
  onChange,
  label,
  hint,
}: {
  icon: React.ReactNode;
  checked: boolean;
  onChange: (next: boolean) => void;
  label: string;
  hint: string;
}): React.JSX.Element => (
  <label className="flex cursor-pointer items-start gap-3 rounded-control p-2 transition-colors hover:bg-ethereal-ink/3">
    <Checkbox
      checked={checked}
      onChange={(event) => onChange(event.target.checked)}
      className="mt-0.5"
    />
    <span className="min-w-0">
      <Text as="span" size="sm" className="flex items-center gap-1.5">
        <span className="text-ethereal-graphite">{icon}</span>
        {label}
      </Text>
      <Caption as="p" color="graphite" className="mt-0.5">
        {hint}
      </Caption>
    </span>
  </label>
);
