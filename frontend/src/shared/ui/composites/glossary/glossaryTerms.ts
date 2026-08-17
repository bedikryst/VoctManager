/**
 * @file glossaryTerms.ts
 * @description The panel's glossary: the closed set of specialist terms that
 * carry a micro-definition, and the one rule for finding a term's sentence.
 * The sentences themselves live only in the locale files under `glossary.*` —
 * this module never holds a copy, not even as a `t()` fallback, because a
 * second copy of a definition is exactly how two views end up explaining one
 * term two ways.
 *
 * A term earns an entry when it is jargon the reader cannot deduce from the
 * surface around it AND one sentence settles it. A term that needs two
 * sentences needs renaming instead — that goes to the remediation file's
 * "Still open", not here.
 * @architecture Enterprise SaaS 2026
 * @module shared/ui/composites/glossary/glossaryTerms
 */

/**
 * Every glossed term. Each id has exactly one `glossary.<id>` sentence in
 * `pl`, `en` and `fr`.
 */
export const GLOSSARY_TERMS = [
  "divisi",
  "epoch",
  "edition",
  "license",
  "density",
] as const;

export type GlossaryTermId = (typeof GLOSSARY_TERMS)[number];

/** The i18n key holding a term's one-sentence definition. */
export const glossaryDefinitionKey = (term: GlossaryTermId): string =>
  `glossary.${term}`;
