/**
 * @file contentDisposition.ts
 * @description The name a downloaded file is saved under, read from the
 * response's `Content-Disposition`. Django sends a name with Polish letters
 * as RFC 5987 (`filename*=utf-8''%C5%81ukasz…`) — nearly every finance file
 * carries a person's or a concert's name — so that form is decoded first.
 * @architecture Enterprise SaaS 2026
 * @module features/finance/lib/contentDisposition
 */

const ENCODED_FILENAME = /filename\*\s*=\s*[^']*'[^']*'([^;\n]+)/i;
const PLAIN_FILENAME = /filename\s*=\s*(?:"([^"]*)"|([^;\n]*))/i;

/**
 * The encoded name wins; the plain `filename` is the fallback, and the
 * caller's name the last resort.
 */
export const filenameFromDisposition = (
  disposition: unknown,
  fallbackName: string,
): string => {
  if (typeof disposition !== "string") return fallbackName;
  const encoded = ENCODED_FILENAME.exec(disposition)?.[1]?.trim();
  if (encoded) {
    try {
      return decodeURIComponent(encoded.replace(/^"|"$/g, ""));
    } catch {
      // A malformed escape: the plain name, if any, is the better guess.
    }
  }
  const plain = PLAIN_FILENAME.exec(disposition);
  const name = (plain?.[1] ?? plain?.[2] ?? "").trim();
  return name || fallbackName;
};
