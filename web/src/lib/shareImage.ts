/**
 * @file shareImage.ts
 * @description The link-preview image (og:image / twitter:image) for every public page, built in
 *  one place so no page can pick its own format or forget the dimensions.
 *
 *  JPEG, not the WebP the page itself uses: link scrapers are not browsers, and JPEG is the one
 *  format every one of them renders. The dimensions travel with the URL because Facebook and
 *  Messenger process an image of unknown size asynchronously — the first scrape of a URL they
 *  have not seen before (and `http://…` is a different URL from `https://…` to their cache, which
 *  is what a link typed without a scheme becomes) then renders the card with no picture at all.
 * @module lib/shareImage
 */

import type { ImageMetadata } from "astro";
import { getImage } from "astro:assets";

/** The width Facebook recommends for a large card. A narrower source is never upscaled. */
const SHARE_WIDTH = 1200;

export interface ShareImage {
  /** Root-relative URL of the built file; BaseLayout makes it absolute against SITE. */
  src: string;
  width: number;
  height: number;
  /** MIME type for og:image:type. */
  type: string;
}

export async function shareImage(source: ImageMetadata): Promise<ShareImage> {
  const width = Math.min(SHARE_WIDTH, source.width);
  const built = await getImage({ src: source, width, format: "jpg" });
  return {
    src: built.src,
    width,
    height: Math.round((source.height * width) / source.width),
    type: "image/jpeg",
  };
}
