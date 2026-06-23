/**
 * @file errorToast.ts
 * @description One consistent, localized way to surface an API failure as a
 * toast — replacing 50+ bespoke `toast.error("Błąd zapisu")` / hard-coded
 * English call sites. Returns the normalized error so the caller can branch
 * further (e.g. also apply field errors to a form) without re-parsing.
 * @module shared/api/errors/errorToast
 * @architecture Enterprise SaaS 2026
 */

import { toast } from "sonner";
import i18n from "i18next";
import type { TFunction } from "i18next";
import type { ExternalToast } from "sonner";

import { parseApiError } from "./parseApiError";
import { resolveErrorCopy } from "./errorCopy";
import type { NormalizedApiError } from "./types";

export interface ToastApiErrorOptions extends ExternalToast {
  /** Override the resolved headline (detail still comes from the server). */
  title?: string;
}

/**
 * Parse, localize and toast an API error in one call.
 *
 * Pass the component's `t` from `useTranslation` wherever you have it. Outside
 * React (e.g. an optimistic mutation's `onError`), omit it and the active
 * language is read from the global i18next instance.
 * @returns the normalized error, for any follow-up handling.
 */
export const toastApiError = (
  error: unknown,
  t?: TFunction,
  options: ToastApiErrorOptions = {},
): NormalizedApiError => {
  const translate = (t ?? i18n.t.bind(i18n)) as TFunction;
  const normalized = parseApiError(error);
  const { title, detail } = resolveErrorCopy(normalized, translate);
  const { title: titleOverride, description, ...rest } = options;

  toast.error(titleOverride ?? title, {
    description: description ?? detail,
    ...rest,
  });

  return normalized;
};
