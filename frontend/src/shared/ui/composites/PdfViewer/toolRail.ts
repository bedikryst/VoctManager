/**
 * @file toolRail.ts
 * @description Whether the viewer's top-left tool slot is a vertical rail in
 * the page's left margin or a row in the top letterbox. Decided by the
 * viewport alone (landscape, tablet-sized and up), never by the page's current
 * margin, so zooming never flips the bar under the reader's hand. A portrait
 * phone never gets the rail: there it would cover every system's clef and
 * voice labels. The JS mirror of the `tool-rail:` CSS variant in panel.css —
 * keep the two queries in lockstep.
 * @module shared/ui/composites/PdfViewer
 */

import { useMediaQuery } from "@/shared/lib/dom/useMediaQuery";

export const PDF_TOOL_RAIL_QUERY =
  "(orientation: landscape) and (min-width: 60rem) and (min-height: 40rem)";

/** True when slot content in the viewer's top-left corner should stack vertically. */
export const usePdfToolRail = (): boolean => useMediaQuery(PDF_TOOL_RAIL_QUERY);
