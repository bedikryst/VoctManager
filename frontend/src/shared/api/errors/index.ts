/**
 * @file index.ts
 * @description Public surface of the API-error toolkit. Import from here:
 *   `import { toastApiError, applyFieldErrors, parseApiError } from "@/shared/api/errors";`
 * @module shared/api/errors
 */

export type { NormalizedApiError, ApiErrorKind } from "./types";
export { parseApiError } from "./parseApiError";
export { resolveErrorCopy, type ErrorCopy } from "./errorCopy";
export { toastApiError, type ToastApiErrorOptions } from "./errorToast";
export {
  applyFieldErrors,
  type ApplyFieldErrorsOptions,
} from "./applyFieldErrors";
