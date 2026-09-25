/**
 * @file photos.mjs
 * @description One press photograph, cut to its ratio: the print file an editor downloads, the
 *  2400 px preview the lightbox opens and the two thumbnails the page lays out.
 *
 *  WHAT YOU SEE IS WHAT YOU DOWNLOAD. Every file is the same crop — the largest box of the row's
 *  ratio inside the upright frame, centred as near to `focus` as the edges allow — so the tile on
 *  the page is the frame the reader gets, not a hint at a larger original.
 *
 *  A CAMERA ORIGINAL IS NOT A PRESS PHOTOGRAPH. Anything past 5000 px on its long edge (42 cm at
 *  300 dpi, the long side of A3) is resampled once, here, to JPEG q92 — a 44 MB original in a
 *  pack nobody opens on a deadline is not generosity.
 *
 *  METADATA: the colour profile stays (a wide-gamut frame printed without it prints flat) and the
 *  credit is written into EXIF `Artist` / `Copyright` and the matching XMP fields. Both, because
 *  EXIF strings are ASCII and libvips folds them ("Grudzinska", "(C)"), while XMP is UTF-8 and
 *  carries the name as it is spelled — which is the field Adobe tools show first. Everything else
 *  (GPS, camera serials, IPTC, the photographer's editing history) is dropped.
 * @architecture Astro islands 2026
 * @module scripts/press-pack/photos
 */
import sharp from "sharp";

/** 42 cm at 300 dpi. */
export const PRINT_LONG_EDGE = 5000;
export const PRINT_QUALITY = 92;
/** Below this on its short edge a crop is a thumbnail, not a press photograph: warned and skipped. */
export const SHORT_EDGE_FLOOR = 1080;
export const PREVIEW_LONG_EDGE = 2400;
export const PREVIEW_QUALITY = 85;
export const THUMB_WIDTHS = [640, 1280];

export const RATIOS = { "16:9": 16 / 9, "4:5": 4 / 5 };

/**
 * The largest box of `ratio` (width / height) inside `width × height`, centred on `focus` and
 * clamped to the frame.
 */
export function cropBox(width, height, ratio, [fx, fy]) {
  const boxWidth = Math.min(width, Math.round(height * ratio));
  const boxHeight = Math.min(height, Math.round(boxWidth / ratio));
  const clamp = (value, max) => Math.max(0, Math.min(max, Math.round(value)));
  return {
    left: clamp(fx * width - boxWidth / 2, width - boxWidth),
    top: clamp(fy * height - boxHeight / 2, height - boxHeight),
    width: boxWidth,
    height: boxHeight,
  };
}

/** Upright dimensions: EXIF orientations 5–8 store the frame turned by a quarter. */
export async function uprightSize(file) {
  const meta = await sharp(file).metadata();
  const turned = (meta.orientation ?? 1) >= 5;
  return {
    width: (turned ? meta.height : meta.width) ?? 0,
    height: (turned ? meta.width : meta.height) ?? 0,
  };
}

const xmlEscape = (text) =>
  text.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The credit as XMP — `dc:creator` and `dc:rights`, the two fields Adobe tools show. */
const creditXmp = (credit) => `<?xpacket begin="﻿" id="W5M0MpCehiHzreSzNTczkc9d"?>
<x:xmpmeta xmlns:x="adobe:ns:meta/"><rdf:RDF xmlns:rdf="http://www.w3.org/1999/02/22-rdf-syntax-ns#">
<rdf:Description rdf:about="" xmlns:dc="http://purl.org/dc/elements/1.1/">
<dc:creator><rdf:Seq><rdf:li>${xmlEscape(credit)}</rdf:li></rdf:Seq></dc:creator>
<dc:rights><rdf:Alt><rdf:li xml:lang="x-default">© ${xmlEscape(credit)}</rdf:li></rdf:Alt></dc:rights>
</rdf:Description></rdf:RDF></x:xmpmeta>
<?xpacket end="w"?>`;

/**
 * Cut one photograph. Returns `{ skipped }` with the crop's size when it falls under the
 * short-edge floor, otherwise the print file, the preview and the thumbnails as buffers.
 */
export async function pressPhoto(file, { ratio, focus, credit }) {
  const { width, height } = await uprightSize(file);
  const box = cropBox(width, height, RATIOS[ratio], focus);
  if (Math.min(box.width, box.height) < SHORT_EDGE_FLOOR) {
    return { skipped: { width: box.width, height: box.height } };
  }

  const print = await sharp(file)
    .autoOrient()
    .extract(box)
    .resize({
      width: PRINT_LONG_EDGE,
      height: PRINT_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .keepIccProfile()
    .withExif({ IFD0: { Artist: credit, Copyright: `© ${credit}` } })
    .withXmp(creditXmp(credit))
    .jpeg({ quality: PRINT_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  // The web files start from the print file, not the original, so every size is the same crop to
  // the pixel. Their metadata is dropped: a thumbnail carries no credit a reader would look for.
  const preview = await sharp(print.data)
    .resize({
      width: PREVIEW_LONG_EDGE,
      height: PREVIEW_LONG_EDGE,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: PREVIEW_QUALITY, mozjpeg: true })
    .toBuffer({ resolveWithObject: true });

  const thumbs = await Promise.all(
    THUMB_WIDTHS.map((thumbWidth) =>
      sharp(print.data)
        .resize({ width: thumbWidth, withoutEnlargement: true })
        .webp({ quality: 80 })
        .toBuffer({ resolveWithObject: true }),
    ),
  );

  return { print, preview, thumbs };
}
