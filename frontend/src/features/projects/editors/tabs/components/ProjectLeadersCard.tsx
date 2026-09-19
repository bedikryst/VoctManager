/**
 * @file ProjectLeadersCard.tsx
 * @description The project's leader: who runs its rehearsals in the conductor's
 * place, what that opens for them, and until when. Normally one person for
 * every programme, but decided per concert — so the add form suggests the last
 * leader and the manager still clicks.
 *
 * It lives beside the schedule rather than on the score, even though the score
 * is where the conductor thinks of it, because leadership is not a property of
 * one piece — it covers a whole programme and the evenings in it. Putting the
 * control where it is granted keeps one list rather than a second, disagreeing
 * one on every score.
 *
 * The scopes are separate switches because they leak differently, and the copy
 * says what each opens instead of naming an internal layer: a conductor
 * deciding this is deciding who reads his hand, not choosing a permission. They
 * sit behind a collapsed "advanced" toggle, the first three on and the fourth
 * (writing the choir's own markings) off: the ordinary appointment is a name,
 * and a row only says anything about scope when it departs from that — one of
 * the three withheld, or the fourth granted.
 *
 * One form serves both the appointment and a later change of mind — the fourth
 * scope in particular is one a conductor lends after watching somebody run a few
 * evenings. Editing opens it on the row it belongs to, with the switches already
 * unfolded and the person locked: who a grant is about is its identity, not its
 * content, and the server refuses to re-point one for the same reason.
 * The server keeps the model's name (`RehearsalDelegate`, URL `/delegates/`).
 * @architecture Enterprise SaaS 2026
 * @module features/projects/editors/tabs/components
 */

import React, { useState } from "react";
import { useTranslation } from "react-i18next";
import {
  ChevronDown,
  ChevronUp,
  ClipboardCheck,
  FolderOpen,
  PenLine,
  SlidersHorizontal,
  UserPlus,
  Users,
  UserRound,
  X,
} from "lucide-react";

import {
  useGrantDelegate,
  useProjectDelegates,
  useRevokeDelegate,
  useSuggestedLeader,
  useUpdateDelegate,
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
import { Select, type SelectOption } from "@/shared/ui/primitives/Select";
import { ACCENT_BADGE } from "@/shared/ui/primitives/accents";
import { Caption, Text } from "@/shared/ui/primitives/typography";
import { formatLocalizedDate } from "@/shared/lib/time/intl";
import { toZonedWallClock } from "@/shared/lib/time/timezone";
import { cn } from "@/shared/lib/utils";

export interface LeaderCandidate {
  id: string;
  name: string;
  /** Sings in this project. The cast is offered first; everyone else after a divider. */
  inCast: boolean;
}

interface ProjectLeadersCardProps {
  projectId: string;
  /** Every active member who could lead: the cast first, then the rest. */
  candidates: readonly LeaderCandidate[];
}

interface DraftState {
  /** `null` = nothing chosen by hand yet, so the server's suggestion applies. */
  artist: string | null;
  marks: boolean;
  rollCall: boolean;
  materials: boolean;
  /** The choir's own layer — off unless the conductor lends his voice. */
  choirMarks: boolean;
  /** Wall-clock string from DateTimeField, or "" for "until the project closes". */
  expiresAt: string;
  note: string;
}

const EMPTY_DRAFT: DraftState = {
  artist: null,
  marks: true,
  rollCall: true,
  materials: true,
  choirMarks: false,
  expiresAt: "",
  note: "",
};

/** A Select item that only separates the cast from the rest; never selectable. */
const OTHERS_DIVIDER_VALUE = "__others__";

/** Which grant the form has open: a fresh appointment, or a row being changed. */
type OpenForm =
  | { readonly mode: "create" }
  | { readonly mode: "edit"; readonly delegate: RehearsalDelegate };

/**
 * An existing grant read back into the form's shape. `expires_at` returns
 * through the browser's own zone because that is the zone the field wrote it in
 * — reading it back in the project's would move an expiry nobody touched.
 */
const draftFromDelegate = (row: RehearsalDelegate): DraftState => ({
  artist: row.artist,
  marks: row.can_see_leader_marks,
  rollCall: row.can_take_roll_call,
  materials: row.can_open_materials,
  choirMarks: row.can_mark_for_choir,
  expiresAt: row.expires_at ? toZonedWallClock(new Date(row.expires_at)) : "",
  note: row.note,
});

export const ProjectLeadersCard = ({
  projectId,
  candidates,
}: ProjectLeadersCardProps): React.JSX.Element => {
  const { t } = useTranslation();
  const { data: delegates = [], isLoading } = useProjectDelegates(projectId);
  const { data: suggestedArtist = null } = useSuggestedLeader(projectId);
  const grant = useGrantDelegate(projectId);
  const update = useUpdateDelegate(projectId);
  const revoke = useRevokeDelegate(projectId);

  const [draft, setDraft] = useState<DraftState>(EMPTY_DRAFT);
  const [form, setForm] = useState<OpenForm | null>(null);
  const [scopesOpen, setScopesOpen] = useState(false);
  const [pendingRevoke, setPendingRevoke] = useState<RehearsalDelegate | null>(
    null,
  );

  // The suggestion only counts while it names somebody the picker offers — a
  // person who has since left the roster would otherwise be "selected" with no
  // visible name.
  const suggestion =
    suggestedArtist !== null &&
    candidates.some((candidate) => candidate.id === suggestedArtist)
      ? suggestedArtist
      : "";
  const chosenArtist = draft.artist ?? suggestion;
  const editing = form?.mode === "edit" ? form.delegate : null;

  const scopeChosen =
    draft.marks || draft.rollCall || draft.materials || draft.choirMarks;
  const isSaving = grant.isPending || update.isPending;
  const canSubmit = Boolean(chosenArtist) && scopeChosen && !isSaving;

  const closeForm = (): void => {
    setDraft(EMPTY_DRAFT);
    setScopesOpen(false);
    setForm(null);
  };

  const openCreate = (): void => {
    setDraft(EMPTY_DRAFT);
    setScopesOpen(false);
    setForm({ mode: "create" });
  };

  // The switches are the reason this opens at all, so they arrive unfolded —
  // unlike the appointment, where the ordinary answer is just a name.
  const openEdit = (row: RehearsalDelegate): void => {
    setDraft(draftFromDelegate(row));
    setScopesOpen(true);
    setForm({ mode: "edit", delegate: row });
  };

  const submit = (): void => {
    if (!canSubmit) return;
    const scopes = {
      can_see_leader_marks: draft.marks,
      can_take_roll_call: draft.rollCall,
      can_open_materials: draft.materials,
      can_mark_for_choir: draft.choirMarks,
      // The field speaks wall clock; the server reads the instant. Empty is
      // not "now", it is "no end of its own" — see the model.
      expires_at: draft.expiresAt ? new Date(draft.expiresAt).toISOString() : null,
      note: draft.note.trim(),
    };
    if (editing) {
      update.mutate({ id: editing.id, patch: scopes }, { onSuccess: closeForm });
      return;
    }
    grant.mutate({ artist: chosenArtist, ...scopes }, { onSuccess: closeForm });
  };

  const withheldScopes = (scopes: {
    marks: boolean;
    rollCall: boolean;
    materials: boolean;
  }): string[] => {
    const missing: string[] = [];
    if (!scopes.marks) {
      missing.push(t("projects.delegates.scope.without_marks", "bez notatek"));
    }
    if (!scopes.rollCall) {
      missing.push(t("projects.delegates.scope.without_roll_call", "bez obecności"));
    }
    if (!scopes.materials) {
      missing.push(t("projects.delegates.scope.without_materials", "bez materiałów"));
    }
    return missing;
  };

  const limitedScopeCaption = (missing: string[]): string =>
    t("projects.delegates.scope.limited", {
      defaultValue: "Zakres ograniczony: {{missing}}",
      missing: missing.join(", "),
    });

  // The fourth scope reads the other way round: granted is the exception, so
  // the caption names it only when it is on.
  const choirMarksCaption = t(
    "projects.delegates.scope.choir_marks_granted",
    "Nanosi uwagi dla chóru",
  );

  const draftWithheld = withheldScopes(draft);

  const castOptions: SelectOption[] = candidates
    .filter((candidate) => candidate.inCast)
    .map((candidate) => ({ value: candidate.id, label: candidate.name }));
  const otherOptions: SelectOption[] = candidates
    .filter((candidate) => !candidate.inCast)
    .map((candidate) => ({ value: candidate.id, label: candidate.name }));
  const offeredOptions: SelectOption[] =
    otherOptions.length > 0
      ? [
          ...castOptions,
          {
            value: OTHERS_DIVIDER_VALUE,
            label: t("projects.delegates.form.others_divider", "— Pozostali członkowie —"),
            disabled: true,
          },
          ...otherOptions,
        ]
      : castOptions;
  // A leader who has since left the roster is still the one this grant is
  // about, and the locked field has to say their name rather than a placeholder.
  const personOptions: SelectOption[] =
    editing && !offeredOptions.some((option) => option.value === editing.artist)
      ? [...offeredOptions, { value: editing.artist, label: editing.artist_name }]
      : offeredOptions;

  return (
    <>
      <SectionCard
        as="h2"
        icon={<UserRound size={15} aria-hidden="true" />}
        title={t("projects.delegates.title", "Lider projektu")}
        action={
          delegates.length > 0 ? (
            <Badge variant="neutral">{delegates.length}</Badge>
          ) : undefined
        }
      >
        <Caption as="p" color="graphite">
          {t(
            "projects.delegates.description",
            "Osoba spoza grona menedżerów, która prowadzi próby tego projektu w Twoim imieniu. Zwykle jedna na cały program — ale decydujesz przy każdym koncercie.",
          )}
        </Caption>

        {isLoading ? null : delegates.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {delegates.map((row) => {
              const missing = withheldScopes({
                marks: row.can_see_leader_marks,
                rollCall: row.can_take_roll_call,
                materials: row.can_open_materials,
              });
              return (
                <li
                  key={row.id}
                  className={cn(
                    "flex flex-wrap items-center justify-between gap-3 rounded-nested border px-3 py-2.5",
                    editing?.id === row.id
                      ? "border-ethereal-gold/50 bg-ethereal-gold/5"
                      : "border-hairline bg-ethereal-alabaster/50",
                  )}
                >
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <Text as="p" weight="medium" className="truncate">
                        {row.artist_name}
                      </Text>
                      <Badge variant={ACCENT_BADGE.gold}>
                        {t("projects.delegates.badge", "Lider")}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
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
                      {/* A chip only for the exception: the full grant is the
                          ordinary case and says nothing about scope. */}
                      {missing.length > 0 && (
                        <Caption color="gold">{limitedScopeCaption(missing)}</Caption>
                      )}
                      {row.can_mark_for_choir && (
                        <Caption color="gold">{choirMarksCaption}</Caption>
                      )}
                    </div>
                    {row.note && (
                      <Caption as="p" color="graphite" className="mt-1 truncate">
                        {row.note}
                      </Caption>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<SlidersHorizontal size={14} aria-hidden="true" />}
                      onClick={() => openEdit(row)}
                    >
                      {t("common.actions.change", "Zmień")}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      leftIcon={<X size={14} aria-hidden="true" />}
                      onClick={() => setPendingRevoke(row)}
                    >
                      {t("projects.delegates.revoke", "Cofnij")}
                    </Button>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : (
          <StatePanel
            variant="inline"
            className="py-8"
            icon={<UserRound size={22} aria-hidden="true" />}
            title={t("projects.delegates.empty.title", "Projekt nie ma lidera")}
            description={t(
              "projects.delegates.empty.description",
              "Próby prowadzisz Ty i pozostali menedżerowie.",
            )}
          />
        )}

        {form ? (
          <div className="mt-4 flex flex-col gap-4 rounded-nested border border-hairline-strong p-4">
            <div className="flex flex-col gap-1">
              <Select
                label={
                  editing
                    ? t("projects.delegates.form.person_locked", "Lider")
                    : t("projects.delegates.form.person", "Kto będzie liderem")
                }
                placeholder={t(
                  "projects.delegates.form.person_placeholder",
                  "Wybierz osobę",
                )}
                value={chosenArtist}
                onValueChange={(value) => setDraft({ ...draft, artist: value })}
                options={personOptions}
                disabled={editing !== null}
              />
              {editing && (
                <Caption as="p" color="graphite">
                  {t(
                    "projects.delegates.form.person_locked_hint",
                    "Żeby zmienić osobę, cofnij to nadanie i mianuj kogoś innego.",
                  )}
                </Caption>
              )}
            </div>

            <div className="flex flex-col gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="self-start"
                aria-expanded={scopesOpen}
                rightIcon={
                  scopesOpen ? (
                    <ChevronUp size={14} aria-hidden="true" />
                  ) : (
                    <ChevronDown size={14} aria-hidden="true" />
                  )
                }
                onClick={() => setScopesOpen((open) => !open)}
              >
                {t("projects.delegates.form.scopes_toggle", "Zakres (zaawansowane)")}
              </Button>
              {!scopesOpen && draftWithheld.length > 0 && (
                <Caption as="p" color="gold">
                  {limitedScopeCaption(draftWithheld)}
                </Caption>
              )}
              {!scopesOpen && draft.choirMarks && (
                <Caption as="p" color="gold">
                  {choirMarksCaption}
                </Caption>
              )}
              {scopesOpen && (
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
                  <ScopeRow
                    icon={<Users size={14} aria-hidden="true" />}
                    checked={draft.choirMarks}
                    onChange={(next) => setDraft({ ...draft, choirMarks: next })}
                    label={t(
                      "projects.delegates.scope.choir_marks",
                      "Nanosi uwagi dla chóru",
                    )}
                    hint={t(
                      "projects.delegates.scope.choir_marks_hint",
                      "Pisze na warstwie „Widoczne dla chóru” — oficjalnych uwagach, które widzi każdy śpiewak. Domyślnie wyłączone.",
                    )}
                  />
                </div>
              )}
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
                "np. na czas mojego wyjazdu 10–24 grudnia",
              )}
            />

            <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="ghost" onClick={closeForm}>
                {t("common.actions.cancel", "Anuluj")}
              </Button>
              <Button type="button" onClick={submit} disabled={!canSubmit}>
                {editing
                  ? t("common.actions.save", "Zapisz")
                  : t("projects.delegates.form.submit", "Mianuj lidera")}
              </Button>
            </div>
          </div>
        ) : (
          <Button
            type="button"
            variant="secondary"
            size="touch"
            leftIcon={<UserPlus size={14} aria-hidden="true" />}
            onClick={openCreate}
            className="mt-4 w-full sm:w-auto"
          >
            {t("projects.delegates.add", "Mianuj lidera")}
          </Button>
        )}
      </SectionCard>

      <ConfirmModal
        isOpen={pendingRevoke !== null}
        title={t("projects.delegates.confirm.title", "Odwołać lidera?")}
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
