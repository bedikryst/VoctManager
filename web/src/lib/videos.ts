/**
 * @file videos.ts
 * @description Self-hosted marketing video asset registry. Videos live under
 *  `src/assets/videos`, so the build emits content-hashed URLs instead of stable public
 *  `/video/*.mp4` paths.
 * @architecture Astro assets 2026
 * @module lib/videos
 */

import landingAeternam from "../assets/videos/landing-aeternam.mp4?url";
import landingModal from "../assets/videos/landing-modal.mp4?url";
import landingWolanie from "../assets/videos/landing-wolanie.mp4?url";

export const VIDEO_ASSETS = {
  "landing-modal": landingModal,
  "landing-wolanie": landingWolanie,
  "landing-aeternam": landingAeternam,
} as const;

export type VideoAssetKey = keyof typeof VIDEO_ASSETS;

export const videoAsset = (key: VideoAssetKey): string => VIDEO_ASSETS[key];
