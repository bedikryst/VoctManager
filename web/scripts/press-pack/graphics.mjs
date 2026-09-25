/**
 * @file graphics.mjs
 * @description A concert poster mounted WHOLE on a ground blurred out of its own sheet — the recipe
 *  behind both the link-preview card (`poster-art.cjs`) and the press kit's social graphics.
 *
 *  Deliberately NOT a crop. Every poster in this archive is a standing A-sheet, and any landscape
 *  or square cut of one loses either the title or the dateline; a graphic that has dropped the date
 *  is a poster of nothing. So the sheet is scaled to fit and the frame around it is the sheet's own
 *  colour, blurred well past the point where its ring of work titles is language.
 *
 *  THE BLUR SCALES WITH THE FRAME. Sigma 28 was set by eye on the 1200 × 630 share card; a 1080 px
 *  story at the same sigma would show the ring's letterforms through the ground. It is 28 per 630
 *  px of the frame's short edge, so the share card is unchanged and the larger graphics read the
 *  same.
 * @architecture Astro islands 2026
 * @module scripts/press-pack/graphics
 */
import sharp from "sharp";

const BLUR_PER_630 = 28;

/**
 * The poster on its own ground, as a sharp pipeline — the caller picks the output format.
 *
 * @param {string | Buffer} source The poster.
 * @param {{ width: number, height: number }} frame
 * @param {{ inset?: number }} [options] The share of the frame the sheet may take on either axis;
 *   1 lets it touch the frame's edges, which is what the share card wants.
 */
export async function posterOnGround(source, frame, { inset = 1 } = {}) {
  const sheet = await sharp(source)
    .resize({
      width: Math.floor(frame.width * inset),
      height: Math.floor(frame.height * inset),
      fit: "inside",
    })
    .toBuffer({ resolveWithObject: true });
  // Brightness 0.86 seats the sheet without darkening the frame into a mood.
  const ground = await sharp(source)
    .resize({ ...frame, fit: "cover", position: "top" })
    .blur((BLUR_PER_630 * Math.min(frame.width, frame.height)) / 630)
    .modulate({ brightness: 0.86, saturation: 0.9 })
    .toBuffer();

  return sharp(ground).composite([
    {
      input: sheet.data,
      left: Math.round((frame.width - sheet.info.width) / 2),
      top: Math.round((frame.height - sheet.info.height) / 2),
    },
  ]);
}
