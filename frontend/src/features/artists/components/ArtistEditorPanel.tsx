/**
 * @file ArtistEditorPanel.tsx
 * @description The editor that creates or updates an artist, on `SidePanel`.
 * React Hook Form + Zod through `useArtistForm`; closing with unsaved changes
 * asks first. Three `FormSection`s: the person (names, vocative, phone), the
 * voice profile, and the account (the e-mail, the language and form of
 * address, platform access). Once the member has activated the account, the
 * address and the two preferences are theirs to change, so they read as text
 * here under one sentence saying so. Under the conductor's own range
 * (`AssessedRangeField`) it shows the singer's proposal, read-only, once one
 * exists, with the one action that copies it into the form.
 * @module features/artists/components/ArtistEditorPanel
 */

import React, { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useTranslation } from "react-i18next";
import { Controller, useWatch } from "react-hook-form";

import { ConfirmModal } from "@ui/composites/ConfirmModal";
import { FormSection } from "@ui/composites/FormSection";
import { SidePanel } from "@ui/composites/SidePanel";
import { Button } from "@ui/primitives/Button";
import { Checkbox } from "@ui/primitives/Checkbox";
import { Input } from "@ui/primitives/Input";
import { Select } from "@ui/primitives/Select";
import { Eyebrow, Text } from "@ui/primitives/typography";
import type { Artist, VoiceType, VoiceTypeOption } from "@/shared/types";
import type { VocalRangeMidi } from "@/shared/lib/music/pitchNotation";
import { RANGE_SLOTS } from "@/shared/lib/music/rangeDraft";
import { isInstrumentalist, isSingingVoiceType } from "@/shared/lib/voiceTypes";
import { formatLocalizedDateTime } from "@/shared/lib/time/intl";
import { VocalRangeText } from "@/shared/ui/instruments/PitchName";
import { singingVoiceOf } from "../constants/voices";
import { useArtistForm } from "../hooks/useArtistForm";
import { usePitchNotation } from "../hooks/usePitchNotation";
import { proposalOf, sameRange } from "../lib/vocalRangeProposal";
import {
  ASSESSED_FIELD,
  ASSESSED_FIELDS,
  voiceToSalutation,
} from "../types/artist.dto";
import { vocativeFromTable } from "../lib/polishVocative";
import { AssessedRangeField } from "./AssessedRangeField";
import { SightReadingInput } from "./SightReadingInput";

interface ArtistEditorPanelProps {
  isOpen: boolean;
  onClose: () => void;
  artist: Artist | null;
  voiceTypes: VoiceTypeOption[];
  initialSearchContext?: string;
}

const PROPOSAL_DATE_FORMAT: Intl.DateTimeFormatOptions = {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
};

/** The message languages, each named in itself. */
const LANGUAGE_OPTIONS = [
  { value: "pl", label: "Polski" },
  { value: "en", label: "English" },
  { value: "fr", label: "Français" },
];

/** A sentence under a field. An overline would set it uppercase and tracked
 *  out, which is a label's clothing on a piece of prose. */
const FieldHint = ({ children }: { children: React.ReactNode }) => (
  <Text as="p" size="xs" color="muted" className="ml-1 mt-2">
    {children}
  </Text>
);

/**
 * A value the manager can no longer change, as text under the field's label.
 * A disabled control would still look like something to click. The error
 * stays: a rejected value stops the submit, and nothing else on screen would
 * say why.
 */
const LockedValue = ({
  label,
  value,
  error,
}: {
  label: string;
  value: string;
  error?: string;
}) => (
  <div className="flex flex-col gap-1.5">
    <Eyebrow color="muted" className="ml-1">
      {label}
    </Eyebrow>
    <Text as="p" size="base" className="ml-1 wrap-break-word">
      {value}
    </Text>
    {error && (
      <Text as="p" size="sm" color="crimson" className="ml-1">
        {error}
      </Text>
    )}
  </div>
);

/** A checkbox with its title and one sentence, on the form's own ground. */
const CheckboxRow = ({
  control,
  title,
  description,
}: {
  control: React.ReactNode;
  title: string;
  description: string;
}) => (
  <label className="flex cursor-pointer items-start gap-3">
    {control}
    <span className="min-w-0">
      <Text as="span" size="sm" weight="semibold" className="block">
        {title}
      </Text>
      <Text as="span" size="sm" color="muted" className="mt-0.5 block">
        {description}
      </Text>
    </span>
  </label>
);

export default function ArtistEditorPanel({
  isOpen,
  onClose,
  artist,
  voiceTypes,
  initialSearchContext = "",
}: ArtistEditorPanelProps): React.JSX.Element {
  const { t } = useTranslation();
  const formId = useId();
  const notation = usePitchNotation();
  const proposal = proposalOf(artist ?? undefined);
  const [showExitConfirm, setShowExitConfirm] = useState<boolean>(false);

  const { form, isDirty, isSubmitting, onSubmit } = useArtistForm(
    artist,
    voiceTypes,
    initialSearchContext,
    onClose,
    isOpen,
  );

  const { errors, isSubmitted } = form.formState;
  const errorText = (key?: string) => (key ? t(key) : undefined);

  // Past activation the address is that person's sign-in credential, and the
  // server refuses to move it from here. The language and the form of address
  // pass to the member at the same moment: until then only the manager can set
  // them, after it the member does, in their own settings.
  const isAccountTheirs = Boolean(artist?.id && artist.account_activated);
  const isCreating = !artist?.id;

  const firstNameValue = useWatch({ control: form.control, name: "first_name" });
  const vocativeValue = useWatch({
    control: form.control,
    name: "first_name_vocative",
  });
  // The form fills the vocative from the name table; an empty field beside a
  // name says why, so a blank does not read as a fill that failed.
  const isNameMissingFromTable =
    !vocativeValue?.trim() && vocativeFromTable(firstNameValue ?? "") === "";
  const withoutEmail = useWatch({ control: form.control, name: "without_email" });
  // Creating with the waiver ticked: the field is emptied and closed, so the
  // form cannot carry an address and the waiver at once. On edit the waiver is
  // never shown — a member without an address may gain one, which invites them.
  const isEmailWaived = isCreating && withoutEmail;
  const [emailValue, languageValue, salutationValue] = useWatch({
    control: form.control,
    name: ["email", "language", "salutation"],
  });
  const voiceValue = useWatch({ control: form.control, name: "voice_type" });
  const isPlayer = isInstrumentalist(voiceValue as VoiceType);
  const isSinger = isSingingVoiceType(voiceValue as VoiceType);
  // The assessment's keyboard opens on this voice's own window.
  const singingVoice = singingVoiceOf(voiceValue);

  const salutationOptions = [
    { value: "N", label: t("common.salutation.neutral", "Neutralna") },
    { value: "F", label: t("common.salutation.feminine", "Kobieca") },
    { value: "M", label: t("common.salutation.masculine", "Męska") },
  ];
  const optionLabel = (
    options: readonly { value: string; label: string }[],
    value: string | undefined,
  ): string => options.find((option) => option.value === value)?.label ?? "—";

  const [tessituraLow, tessituraHigh, extremeLow, extremeHigh] = useWatch({
    control: form.control,
    name: [
      "assessed_tessitura_low",
      "assessed_tessitura_high",
      "assessed_extreme_low",
      "assessed_extreme_high",
    ],
  });
  const assessed = useMemo<VocalRangeMidi>(
    () => ({ tessituraLow, tessituraHigh, extremeLow, extremeHigh }),
    [tessituraLow, tessituraHigh, extremeLow, extremeHigh],
  );
  const assessedError = ASSESSED_FIELDS.map(
    (field) => errors[field]?.message,
  ).find((message) => message !== undefined);

  const { setValue, clearErrors, trigger } = form;

  // While adding someone, choosing the voice suggests the form of address —
  // until the manager picks one by hand. A choice made by hand survives a
  // voice chosen after it.
  const salutationPickedByHand = useRef(false);
  useEffect(() => {
    if (isOpen) salutationPickedByHand.current = false;
  }, [isOpen]);

  /** Writes the four notes into the form, never the record. After a refused
   *  save the check reruns, so the problem line follows the notes. */
  const setAssessed = (range: VocalRangeMidi): void => {
    for (const slot of RANGE_SLOTS) {
      setValue(ASSESSED_FIELD[slot], range[slot], { shouldDirty: true });
    }
    if (isSubmitted) void trigger([...ASSESSED_FIELDS]);
  };

  const handleCloseRequest = useCallback(() => {
    if (isDirty) {
      setShowExitConfirm(true);
    } else {
      onClose();
    }
  }, [isDirty, onClose]);

  const forceClose = () => {
    setShowExitConfirm(false);
    onClose();
  };

  return (
    <SidePanel
      isOpen={isOpen}
      onCloseRequest={handleCloseRequest}
      size="lg"
      title={
        isCreating
          ? t("artists.editor.title_new", "Nowy artysta")
          : t("artists.editor.title_edit", "Edytuj artystę")
      }
      footer={
        <Button
          type="submit"
          form={formId}
          variant="primary"
          casing="sentence"
          fullWidth
          disabled={isSubmitting}
          isLoading={isSubmitting}
        >
          {isCreating
            ? t("artists.editor.submit", "Dodaj artystę")
            : t("artists.editor.save", "Zapisz")}
        </Button>
      }
    >
      <form id={formId} onSubmit={onSubmit} className="space-y-9">
        <FormSection
          heading={t("artists.editor.section_basic", "Dane podstawowe")}
          className="space-y-5"
        >
          {/* Only the name pairs up: anything else in half of the panel is
              cut off ("Męska (Drogi…)", a real e-mail address). */}
          <div className="grid gap-x-4 gap-y-5 md:grid-cols-2">
            <Input
              type="text"
              label={t("artists.editor.first_name", "Imię")}
              {...form.register("first_name")}
              disabled={isSubmitting}
              error={errorText(errors.first_name?.message)}
              autoComplete="given-name"
            />
            <Input
              type="text"
              label={t("artists.editor.last_name", "Nazwisko")}
              {...form.register("last_name")}
              disabled={isSubmitting}
              error={errorText(errors.last_name?.message)}
              autoComplete="family-name"
            />
          </div>
          <AnimatePresence initial={false}>
            {firstNameValue && languageValue === "pl" && (
              <motion.div
                key="vocative-input"
                initial={{ opacity: 0, transform: "translateY(-6px)" }}
                animate={{ opacity: 1, transform: "translateY(0px)" }}
                exit={{ opacity: 0, transform: "translateY(-6px)" }}
                transition={{ duration: 0.18 }}
              >
                <Input
                  type="text"
                  label={t("artists.editor.first_name_vocative", "Wołacz")}
                  {...form.register("first_name_vocative")}
                  placeholder={t(
                    "artists.editor.first_name_vocative_placeholder",
                    "np. Krystianie",
                  )}
                  disabled={isSubmitting}
                  className="font-medium text-ethereal-amethyst"
                />
                <FieldHint>
                  {isNameMissingFromTable
                    ? t(
                        "artists.editor.first_name_vocative_not_in_table",
                        "Tego imienia nie ma w tabeli wołaczy. Wpisz formę ręcznie.",
                      )
                    : t(
                        "artists.editor.first_name_vocative_hint",
                        "Forma używana w powitaniach, np. w mailach.",
                      )}
                </FieldHint>
              </motion.div>
            )}
          </AnimatePresence>
          <Input
            type="tel"
            label={t("artists.editor.phone", "Telefon")}
            {...form.register("phone_number")}
            disabled={isSubmitting}
            autoComplete="tel"
          />
        </FormSection>

        <FormSection
          heading={t("artists.editor.section_voice", "Profil wokalny")}
          className="space-y-5"
        >
          <Controller
            control={form.control}
            name="voice_type"
            render={({ field }) => (
              <Select
                label={t("artists.editor.voice_type", "Rodzaj głosu")}
                name={field.name}
                value={field.value ?? ""}
                onValueChange={(value) => {
                  field.onChange(value);
                  if (isCreating && !salutationPickedByHand.current) {
                    setValue("salutation", voiceToSalutation(value));
                  }
                }}
                // Until the dictionary lands the field says it is waiting,
                // rather than offering one placeholder voice that would be
                // submitted verbatim.
                disabled={isSubmitting || voiceTypes.length === 0}
                placeholder={
                  voiceTypes.length === 0
                    ? t("artists.editor.loading", "Ładowanie...")
                    : undefined
                }
                error={errorText(errors.voice_type?.message)}
                options={voiceTypes}
              />
            )}
          />

          {/* What a player plays, in the words the sheets will print
              ("Organy", "Trąbka"). Only a player has one; the range and
              sight-reading below are a singer's facts and are not asked of
              anyone who does not stand in a section. */}
          {isPlayer && (
            <Input
              type="text"
              label={t("artists.editor.instrument", "Instrument")}
              {...form.register("instrument")}
              placeholder={t("artists.editor.instrument_placeholder", "np. Organy")}
              disabled={isSubmitting}
              error={errorText(errors.instrument?.message)}
            />
          )}

          {singingVoice && (
            <AssessedRangeField
              value={assessed}
              voice={singingVoice}
              notation={notation}
              disabled={isSubmitting}
              error={assessedError}
              onChange={(slot, midi) => setAssessed({ ...assessed, [slot]: midi })}
            />
          )}

          {/* The singer's own proposal, read-only. "Przyjmij propozycję"
              copies its four notes into the field above, where the conductor
              adjusts them; nothing is written until the editor is saved. One
              singer at a time, on purpose: a bulk copy would turn the
              conductor's verdict into the singer's. Absent until they send
              one. */}
          {singingVoice && proposal && artist?.vocal_range_proposed_at && (
            <div>
              <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
                <Text size="sm" color="graphite">
                  {t("artists.editor.range_proposal", "Propozycja chórzysty")}
                  {": "}
                  <Text as="span" size="sm" color="inherit" className="text-ethereal-ink">
                    <VocalRangeText
                      range={proposal}
                      notation={notation}
                      className="font-semibold"
                    />
                  </Text>
                  <span className="tabular-nums">
                    {", "}
                    {formatLocalizedDateTime(
                      artist.vocal_range_proposed_at,
                      PROPOSAL_DATE_FORMAT,
                    )}
                  </span>
                </Text>
                {!sameRange(assessed, proposal) && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    casing="sentence"
                    onClick={() => setAssessed(proposal)}
                    disabled={isSubmitting}
                  >
                    {t(
                      "artists.editor.assessed_range.accept_proposal",
                      "Przyjmij propozycję",
                    )}
                  </Button>
                )}
              </div>
              {artist.vocal_range_comment?.trim() && (
                <Text
                  size="sm"
                  color="muted"
                  className="mt-1.5 whitespace-pre-line wrap-break-word"
                >
                  {artist.vocal_range_comment.trim()}
                </Text>
              )}
            </div>
          )}

          {isSinger && (
            <Controller
              control={form.control}
              name="sight_reading_skill"
              render={({ field }) => (
                <SightReadingInput
                  label={t("artists.editor.sight_reading", "Czytanie a vista (ocena)")}
                  name={field.name}
                  value={field.value ? String(field.value) : ""}
                  onChange={field.onChange}
                  onBlur={field.onBlur}
                  disabled={isSubmitting}
                />
              )}
            />
          )}
        </FormSection>

        <FormSection
          heading={t("artists.editor.section_account", "Konto")}
          className="space-y-5"
        >
          {isAccountTheirs ? (
            <>
              <LockedValue
                label={t("artists.editor.email", "E-mail")}
                value={emailValue || "—"}
              />
              <LockedValue
                label={t("artists.editor.language", "Język wiadomości")}
                value={optionLabel(LANGUAGE_OPTIONS, languageValue)}
                error={errorText(errors.language?.message)}
              />
              <LockedValue
                label={t("common.salutation.label", "Forma zwrotu")}
                value={optionLabel(salutationOptions, salutationValue)}
                error={errorText(errors.salutation?.message)}
              />
              <Text as="p" size="sm" color="muted">
                {t(
                  "artists.editor.account_theirs",
                  "Adres, język i formę zwrotu zmienia już tylko sam członek, w ustawieniach swojego konta.",
                )}
              </Text>
            </>
          ) : (
            <>
              <div>
                <Input
                  type="email"
                  label={t("artists.editor.email", "E-mail")}
                  {...form.register("email")}
                  placeholder={
                    isEmailWaived
                      ? t("artists.editor.email_waived_placeholder", "Bez adresu e-mail")
                      : undefined
                  }
                  disabled={isSubmitting || isEmailWaived}
                  error={errorText(errors.email?.message)}
                  autoComplete="email"
                />
                {!isCreating && withoutEmail && (
                  <FieldHint>
                    {t(
                      "artists.editor.email_add_hint",
                      "Ta osoba została dodana bez adresu. Wpisanie go wyśle jej zaproszenie do aplikacji.",
                    )}
                  </FieldHint>
                )}
              </div>

              {/* The waiver is a checkbox of its own rather than an empty
                  field: leaving the address blank is refused, so a member
                  ends up outside the app only because somebody said so. */}
              {isCreating && (
                <CheckboxRow
                  title={t("artists.editor.without_email_title", "Dodaj bez adresu e-mail")}
                  description={t(
                    "artists.editor.without_email_desc",
                    "Tylko dla osoby, która nie chce korzystać z aplikacji. Nie dostanie zaproszenia ani powiadomień, więc plan, zmiany i nuty trzeba jej przekazywać osobiście. Adres można dopisać później, wtedy wyjdzie zaproszenie.",
                  )}
                  control={
                    <Controller
                      control={form.control}
                      name="without_email"
                      render={({ field }) => (
                        <Checkbox
                          size="md"
                          checked={Boolean(field.value)}
                          onChange={(event) => {
                            const waived = event.target.checked;
                            field.onChange(waived);
                            if (waived) {
                              setValue("email", "", { shouldDirty: true });
                              clearErrors("email");
                            }
                          }}
                          onBlur={field.onBlur}
                          name={field.name}
                          disabled={isSubmitting}
                          className="mt-0.5"
                        />
                      )}
                    />
                  }
                />
              )}

              <Controller
                control={form.control}
                name="language"
                render={({ field }) => (
                  <Select
                    label={t("artists.editor.language", "Język wiadomości")}
                    name={field.name}
                    value={field.value ?? ""}
                    onValueChange={field.onChange}
                    disabled={isSubmitting}
                    error={errorText(errors.language?.message)}
                    options={LANGUAGE_OPTIONS}
                  />
                )}
              />

              <div>
                <Controller
                  control={form.control}
                  name="salutation"
                  render={({ field }) => (
                    <Select
                      label={t("common.salutation.label", "Forma zwrotu")}
                      name={field.name}
                      value={field.value ?? ""}
                      onValueChange={(value) => {
                        salutationPickedByHand.current = true;
                        field.onChange(value);
                      }}
                      disabled={isSubmitting}
                      error={errorText(errors.salutation?.message)}
                      options={salutationOptions}
                    />
                  )}
                />
                <FieldHint>
                  {isCreating
                    ? t(
                        "artists.editor.salutation_hint",
                        "Tylko do powitań (np. „Droga”, „Drogi”). Podpowiadana na podstawie głosu, dopóki nie wybierzesz jej ręcznie.",
                      )
                    : t(
                        "artists.editor.salutation_hint_pending",
                        "Tylko do powitań. Do aktywacji konta możesz ją tu poprawić, potem zmienia ją już tylko sam członek.",
                      )}
                </FieldHint>
              </div>
            </>
          )}

          {!isCreating && (
            <CheckboxRow
              title={t("artists.editor.active_access_title", "Aktywny dostęp do platformy")}
              description={t(
                "artists.editor.active_access_desc",
                "Zablokuje logowanie w przypadku odznaczenia.",
              )}
              control={
                // `Checkbox` is a controlled primitive (the tick is drawn from
                // the prop, not the DOM node), so this field cannot ride on
                // `register`.
                <Controller
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <Checkbox
                      size="md"
                      checked={Boolean(field.value)}
                      onChange={(event) => field.onChange(event.target.checked)}
                      onBlur={field.onBlur}
                      name={field.name}
                      disabled={isSubmitting}
                      className="mt-0.5"
                    />
                  )}
                />
              }
            />
          )}
        </FormSection>
      </form>

      <ConfirmModal
        isOpen={showExitConfirm}
        title={t("common.unsaved_title", "Masz niezapisane zmiany!")}
        description={t(
          "common.unsaved_desc",
          "Wprowadziłeś zmiany w formularzu, które nie zostały zapisane. Zamknięcie edytora spowoduje ich utratę.",
        )}
        onConfirm={forceClose}
        onCancel={() => setShowExitConfirm(false)}
      />
    </SidePanel>
  );
}
