/**
 * @file applyFieldErrors.ts
 * @description Bridges a {@link NormalizedApiError} into react-hook-form, so a
 * server-rejected field (e.g. "email already taken", "vocal range invalid")
 * lights up *on that field* — inline, accessible, exactly where the user is
 * looking — instead of as a vague form-wide toast. The named example the team
 * called out: forms that today only say "coś jest źle".
 * @module shared/api/errors/applyFieldErrors
 * @architecture Enterprise SaaS 2026
 */

import type {
  FieldValues,
  Path,
  UseFormSetError,
} from "react-hook-form";

import type { NormalizedApiError } from "./types";

export interface ApplyFieldErrorsOptions<TFieldValues extends FieldValues> {
  /** The form's known field names; messages for unknown fields are skipped. */
  knownFields?: readonly Path<TFieldValues>[];
  /** Map a server field name onto a different form field name when they differ. */
  mapField?: (serverField: string) => Path<TFieldValues> | null;
  /** Focus the first field that received an error (default: true). */
  shouldFocus?: boolean;
}

/**
 * Push server field errors onto a form.
 * @returns the server field names that had *no* matching form field — the
 * caller should surface these some other way (usually a toast), so no error is
 * silently swallowed.
 */
export const applyFieldErrors = <TFieldValues extends FieldValues>(
  setError: UseFormSetError<TFieldValues>,
  error: NormalizedApiError,
  options: ApplyFieldErrorsOptions<TFieldValues> = {},
): string[] => {
  const { knownFields, mapField, shouldFocus = true } = options;
  const unmatched: string[] = [];
  let focusedFirst = false;

  for (const [serverField, message] of Object.entries(error.fieldErrors)) {
    const mapped = mapField
      ? mapField(serverField)
      : (serverField as Path<TFieldValues>);

    if (
      !mapped ||
      (knownFields && !knownFields.includes(mapped))
    ) {
      unmatched.push(serverField);
      continue;
    }

    setError(
      mapped,
      { type: "server", message },
      { shouldFocus: shouldFocus && !focusedFirst },
    );
    focusedFirst = true;
  }

  return unmatched;
};
