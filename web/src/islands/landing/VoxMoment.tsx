/**
 * @file VoxMoment.tsx
 * @description The heart of movement II (Vox memoriae): after the enforced silence beat
 *  (SilenceMoment's "tacet."), the actual voice — with image. The lead line is the page enacting
 *  its own motto: the reader just lived through the silence, now the voice enters (a mid-page
 *  reprise of the hero's title). One cinematic frame playing VOX_VIDEO
 *  (currently aliasing MODAL_VIDEO: one shared file with cross-surface resume; VideoPlayer
 *  owns the ambient duck/restore contract). Successor of the audio-only ListenMoment; the
 *  poster is optimized by the page (astro:assets) and passed in as a prop.
 *
 *  ITS WORDS ARRIVE AS PROPS, not from a hook. The island is server-rendered, so anything it reads
 *  from the document would be Polish during SSR and the page's own language on the client — a
 *  hydration mismatch, which React answers by throwing the server DOM away, taking the reveal
 *  classes an outside observer had already set with it. `lineHtml` has met `lib/typoHtml` before it
 *  got here (LandingPage.astro): the build's typographic pass copies island subtrees through
 *  untouched, and `<Typo>` pins string LEAVES, which an injected field does not have.
 * @architecture Astro islands 2026
 * @module islands/landing/VoxMoment
 */

import { VOX_VIDEO } from "../../data/landing/video";
import type { Locale } from "../../i18n/config";
import { VideoPlayer } from "./video/VideoPlayer";
import { Typo } from "./lib/Typo";

interface VoxMomentProps {
  /** Optimized poster URL, computed by LandingPage.astro via getImage. */
  readonly poster: string;
  /** The vernacular half of the `Vox ·` rubric, which also names the section. */
  readonly eyebrow: string;
  /** The page's motto reprised — an `HTML` field, already typographed. */
  readonly lineHtml: string;
  /** The film's caption, under the frame. */
  readonly caption: string;
  readonly lang: Locale;
}

export function VoxMoment({
  poster,
  eyebrow,
  lineHtml,
  caption,
  lang,
}: VoxMomentProps): React.JSX.Element {
  return (
    <Typo locale={lang}>
      <section className="vox" aria-label={eyebrow}>
        <div className="vox-inner">
          {/* The ink register reaches into this island: both classNames are constant strings, so
              React writes the attribute once and the shared observer's `.is-in` survives
              every re-render, and nothing here renders differently on the server than on the
              first client pass. Both conditions are required — see the footer's silent failure
              in docs/web-landing-guardrails.md. The player is deliberately left out: it owns a
              veiled state of its own, and a second veil over it would be two registers on one
              node. */}
          <p className="vox-eyebrow reveal">
            <span className="lat">Vox</span> · {eyebrow}
          </p>
          <p className="vox-line reveal" dangerouslySetInnerHTML={{ __html: lineHtml }} />
          <VideoPlayer
            src={VOX_VIDEO.src}
            srcAv1={VOX_VIDEO.srcAv1}
            poster={poster}
            caption={caption}
            lang={lang}
          />
        </div>
      </section>
    </Typo>
  );
}
