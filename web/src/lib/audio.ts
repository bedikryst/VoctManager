/**
 * @file audio.ts
 * @description Self-hosted concert recordings, served at stable `/audio/<file>` URLs straight off
 *  disk by nginx — the files are NOT part of the build, and NOT part of the repository.
 *
 *  The second half is the reason this registry exists rather than a file under `public/`: the
 *  repository is public, and a concert recording is the foundation's to publish, not git's. So the
 *  recordings follow the films (lib/videos.ts): `web/public/audio/` is gitignored, uploaded to the
 *  host by hand and bind-mounted into the nginx container (docker-compose.prod.yml), which is the
 *  only thing that serves them. `astro dev` serves `public/` at the site root, so development needs
 *  the file dropped in that folder and nothing else.
 *
 *  THE PAGE LOOKS; IT IS NEVER TOLD — /press's rule (lib/pressPack). A concert's player renders
 *  only when `hostedAudio` finds the file on the host that builds the page, so a checkout or a
 *  server without the upload prints no glyph at all, and the deploy after the upload prints it.
 *  That is the one way the films' arrangement differs: the folder stays IN the Docker build
 *  context so the build can look, and frontend/Dockerfile strips it from `dist/` after the build,
 *  so the bytes still reach no image.
 *
 *  THE TOKEN IN EACH NAME is the first 8 hex of the file's SHA-256, put there by
 *  `npm run audio:stamp`, for the films' two reasons: a URL nobody can type from memory, and a
 *  name unique per mix, which is what lets nginx serve `/audio/` immutable for a year. A new mix of
 *  the same excerpts is therefore a new URL, never a stale one held under a live name.
 *
 *  SO THESE LITERALS AND THE HOST MUST AGREE. A mismatch hides the player — the build looks for
 *  the name written here — and says so in the build log, naming the file it found instead. A new
 *  mix is: drop it in `public/audio/`, `npm run audio:stamp`, paste what it prints below, upload,
 *  and `npm run audio:stamp -- --verify` on the host.
 *
 *  NO PAGE LINKS TO A FILE. The conductor asked that the recordings not be offered for download,
 *  so they are reached only through the player's `<audio>`, which has no native controls and so no
 *  "save" menu; nginx refuses a recording opened as a page (infra/nginx/prod.conf). That removes
 *  every visible route to the bytes. It cannot stop a reader with developer tools, since a browser
 *  that plays a file has already downloaded it.
 * @module lib/audio
 */
import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

const audioUrl = (file: string): string => `/audio/${file}`;

/** Every recording a concert's `excerpts.asset` may name — content.config validates against it. */
export const AUDIO_KEYS = ["pochwala-stworzenia-excerpts"] as const;

export type AudioAssetKey = (typeof AUDIO_KEYS)[number];

/** AAC in MP4, the one container every browser plays, with the index at the head of the file. */
export const AUDIO_ASSETS: Record<AudioAssetKey, string> = {
  "pochwala-stworzenia-excerpts": audioUrl("pochwala-stworzenia-excerpts.77d4a871.m4a"),
};

export const audioAsset = (key: AudioAssetKey): string => AUDIO_ASSETS[key];

/**
 * The recording's URL when its file is on this host, `undefined` when it is not — see the header.
 * `root` defaults to the working directory, which is `web/` for `astro build` and `astro dev`
 * alike, and `public/` is the served root, so a URL is also the file's path under it.
 */
export function hostedAudio(key: AudioAssetKey, root: string = process.cwd()): string | undefined {
  const url = AUDIO_ASSETS[key];
  if (existsSync(join(root, "public", url))) return url;
  // A file under the same key with another token is a mix uploaded without its literal, or a
  // literal pasted without its upload. Either way the page is about to lose its player in silence.
  const dir = join(root, "public", "audio");
  const others = existsSync(dir) ? readdirSync(dir).filter((name) => name.startsWith(`${key}.`)) : [];
  if (others.length > 0) {
    console.warn(
      `[audio] lib/audio.ts names ${url}, but public/audio/ holds ${others.join(", ")}. The player ` +
        `for "${key}" is hidden until the two agree (npm run audio:stamp).`,
    );
  }
  return undefined;
}
