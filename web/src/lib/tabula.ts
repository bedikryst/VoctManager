/**
 * @file tabula.ts
 * @description The shape of one row of the TABULA — a page's own table of contents, hung from
 *  the chrome's line and summoned by turning BACK in the document (styles/tabula.css, rendered
 *  by SiteChrome). A page passes the sections it wants steerable; the chrome owns everything
 *  about how they look and when they appear.
 *
 *  ONE GRAMMAR, the one both index surfaces on this site already use — numeral, name, a hairline
 *  leader, a figure at the right hand — with an optional second tier hanging under the title as
 *  that entry's own colophon. `/obrazy` fills the tier (the evening's Latin and its date) and puts
 *  the frame count in the figure; a concert page has no second fact per band and puts the band's
 *  own Latin rubric in the figure instead. Two pages, one row.
 *
 *  The numerals are the INDEX'S, not necessarily the page's. On `/obrazy` they happen to be the
 *  concerts' own Via numerals; on a concert page the bands carry no number anywhere and the index
 *  numbers them I…N itself, which is what a table of contents has always done.
 * @architecture Astro islands 2026
 * @module lib/tabula
 */

export interface TabulaEntry {
  /** The section's in-document id. The chrome both links to it and observes it. */
  readonly id: string;
  /** Left column — fixed width, so every title in the index aligns on one edge. */
  readonly roman: string;
  /** The vernacular name, exactly as the section prints it at its own head. */
  readonly title: string;
  /** Right hand of the row: the count on `/obrazy`, the band's Latin rubric on a concert page. */
  readonly figure?: string;
  /** BCP-47 tag for `figure` when it is not the page's language — the Latin rubrics take "la". */
  readonly figureLang?: string;
  /** Second tier, Latin half — set in capitalis by base.css's two-tier rubric. */
  readonly latin?: string;
  /** Second tier, gloss half. Printed after the Latin with the rubric's middot between them. */
  readonly meta?: string;
}
