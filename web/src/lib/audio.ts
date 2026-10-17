/**
 * @file audio.ts
 * @description Self-hosted concert recordings, served at stable `/audio/<file>` URLs straight off
 *  disk by nginx — the files are NOT part of the build, and NOT part of the repository.
 *
 *  The second half is the reason this registry exists rather than a file under `public/`: the
 *  repository is public, and a concert recording is the foundation's to publish, not git's. So the
 *  recordings follow the films (lib/videos.ts) exactly. `web/public/audio/` is gitignored, uploaded
 *  to the host by hand, bind-mounted into the nginx container (docker-compose.prod.yml) and kept
 *  out of the build context (root `.dockerignore`). `astro dev` serves `public/` at the site root,
 *  so development needs the file dropped in that folder and nothing else.
 *
 *  THE TOKEN IN EACH NAME is the first 8 hex of the file's SHA-256, put there by
 *  `npm run audio:stamp`, for the films' two reasons: a URL nobody can type from memory, and a
 *  name unique per mix, which is what lets nginx serve `/audio/` immutable for a year. A new mix of
 *  the same excerpts is therefore a new URL, never a stale one held under a live name.
 *
 *  SO THESE LITERALS AND THE HOST MUST AGREE, and nothing checks them at build time: a mismatch
 *  renders every page and 404s the player, which then says the recording is unavailable. A new mix
 *  is: drop it in `public/audio/`, `npm run audio:stamp`, paste what it prints below, upload, and
 *  `npm run audio:stamp -- --verify` on the host.
 * @module lib/audio
 */

const audioUrl = (file: string): string => `/audio/${file}`;

/** Every recording a concert's `excerpts.asset` may name — content.config validates against it. */
export const AUDIO_KEYS = ["pochwala-stworzenia-excerpts"] as const;

export type AudioAssetKey = (typeof AUDIO_KEYS)[number];

/** AAC in MP4, the one container every browser plays, with the index at the head of the file. */
export const AUDIO_ASSETS: Record<AudioAssetKey, string> = {
  "pochwala-stworzenia-excerpts": audioUrl("pochwala-stworzenia-excerpts.20082980.m4a"),
};

/** `type` for a link to one of these files: the container, so a browser need not sniff it. */
export const AUDIO_MIME = "audio/mp4";

export const audioAsset = (key: AudioAssetKey): string => AUDIO_ASSETS[key];
