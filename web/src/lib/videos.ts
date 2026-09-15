/**
 * @file videos.ts
 * @description Self-hosted marketing video registry. Every film resolves to a stable
 *  `/video/<file>` URL served straight off disk by nginx — the files are NOT part of the
 *  build.
 *
 *  WHY THEY ARE NOT BUNDLED. Handing them to Vite (`?url`) costs three quarters of a
 *  gigabyte of work on every deploy for a set that changes twice a year: rollup reads each
 *  file to emit it under a content hash, writes it into `dist/`, and the runtime stage then
 *  copies `dist/` into the nginx image, which orphans the previous one. On the one-vCPU
 *  droplet that single asset pass measured **29 minutes** and took the whole box into swap
 *  with it — every other container starved while a file nobody edited was hashed again. The
 *  `<Image>` pipeline earns its keep because it TRANSFORMS; this one only moved bytes.
 *
 *  WHERE THE FILES LIVE. `web/public/video/`, gitignored like the photographs and uploaded
 *  to the host out of band (web/README.md §Conventions). `astro dev` serves `public/` at the
 *  site root, so development needs nothing else. In production the directory is bind-mounted
 *  into the nginx container (docker-compose.prod.yml) and the root `.dockerignore` keeps it
 *  out of the build context, so the same bytes reach the same URL without ever entering an
 *  image layer. A re-cut film is then an upload, not a deploy.
 *
 *  CACHE. A stable path cannot carry a content hash, so nginx serves `/video/` as immutable
 *  for a year (infra/nginx/prod.conf) and `VIDEO_REVISION` is what makes a re-encode visible
 *  to browsers holding the old file. Bump it in the same commit that names a new cut, or the
 *  upload ships to everyone except the people who have already watched.
 * @architecture Astro assets 2026
 * @module lib/videos
 */

/** Bumped whenever a film is re-encoded under a name that is already public. See @file. */
const VIDEO_REVISION = "1";

const videoUrl = (file: string): string => `/video/${file}?v=${VIDEO_REVISION}`;

export const VIDEO_ASSETS = {
  "landing-modal": videoUrl("landing-modal.mp4"),
  "landing-wolanie": videoUrl("landing-wolanie.mp4"),
  "landing-aeternam": videoUrl("landing-aeternam.mp4"),
} as const;

export type VideoAssetKey = keyof typeof VIDEO_ASSETS;

/**
 * AV1 renditions, one per key — the annotation is the point: adding a film to VIDEO_ASSETS
 * without encoding its AV1 twin fails the typecheck rather than quietly serving everyone the
 * heavy file.
 *
 * Every film ships TWICE. AV1 carries this footage — a lit nave, fine ornament, sensor grain —
 * at roughly 2.5× fewer bytes for the same measured quality, which is a saving H.264 cannot
 * reach at any setting (raising its CRF far enough to matter costs visible quality; denoising
 * first costs it too and saves nothing). H.264 stays because AV1 is not universal: Safari
 * decodes it only from 17 and only on hardware that has the decoder, so the older Apple half of
 * the audience needs a file it can actually play.
 */
export const VIDEO_ASSETS_AV1: Record<VideoAssetKey, string> = {
  "landing-modal": videoUrl("landing-modal.av1.mp4"),
  "landing-wolanie": videoUrl("landing-wolanie.av1.mp4"),
  "landing-aeternam": videoUrl("landing-aeternam.av1.mp4"),
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
