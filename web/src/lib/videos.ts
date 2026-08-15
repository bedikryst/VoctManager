/**
 * @file videos.ts
 * @description Self-hosted marketing video asset registry. Videos live under
 *  `src/assets/videos`, so the build emits content-hashed URLs instead of stable public
 *  `/video/*.mp4` paths.
 *
 *  Every film ships TWICE: an AV1 rendition and the H.264 original it was cut from. AV1 carries
 *  this footage — a lit nave, fine ornament, sensor grain — at roughly 2.5× fewer bytes for the
 *  same measured quality, which is a saving H.264 cannot reach at any setting (raising its CRF
 *  far enough to matter costs visible quality; denoising first costs it too and saves nothing).
 *  H.264 stays because AV1 is not universal: Safari decodes it only from 17 and only on hardware
 *  that has the decoder, so the older Apple half of the audience needs a file it can actually
 *  play. `videoAssetAv1` is total, not optional — the compiler is what keeps a newly added film
 *  from silently shipping in one codec.
 * @architecture Astro assets 2026
 * @module lib/videos
 */

import landingAeternamAv1 from "../assets/videos/landing-aeternam.av1.mp4?url";
import landingAeternam from "../assets/videos/landing-aeternam.mp4?url";
import landingModalAv1 from "../assets/videos/landing-modal.av1.mp4?url";
import landingModal from "../assets/videos/landing-modal.mp4?url";
import landingWolanieAv1 from "../assets/videos/landing-wolanie.av1.mp4?url";
import landingWolanie from "../assets/videos/landing-wolanie.mp4?url";

export const VIDEO_ASSETS = {
  "landing-modal": landingModal,
  "landing-wolanie": landingWolanie,
  "landing-aeternam": landingAeternam,
} as const;

export type VideoAssetKey = keyof typeof VIDEO_ASSETS;

/**
 * AV1 renditions, one per key — the annotation is the point: adding a film to VIDEO_ASSETS
 * without encoding its AV1 twin fails the typecheck rather than quietly serving everyone the
 * heavy file.
 */
export const VIDEO_ASSETS_AV1: Record<VideoAssetKey, string> = {
  "landing-modal": landingModalAv1,
  "landing-wolanie": landingWolanieAv1,
  "landing-aeternam": landingAeternamAv1,
};

/**
 * `type` for the AV1 `<source>`. Main profile, level 4.0, Main tier, 8-bit — what SVT-AV1 emits
 * for these 1080p30 files. It has to be this specific: a bare `video/mp4` tells a browser nothing
 * about the codec, so Safari would accept the source, fail to decode it, and never reach the
 * H.264 line below it. Re-check this string if a film ever arrives above 1080p30 — the level
 * digits (`08`) are the part that would move.
 */
export const AV1_MIME = 'video/mp4; codecs="av01.0.08M.08"';

export const videoAsset = (key: VideoAssetKey): string => VIDEO_ASSETS[key];

export const videoAssetAv1 = (key: VideoAssetKey): string => VIDEO_ASSETS_AV1[key];
