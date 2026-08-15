/**
 * @file VoxMoment.tsx
 * @description "Zobacz i usłysz" — the heart of movement II (Vox memoriae): after the
 *  enforced silence beat (SilenceMoment's "tacet."), the actual voice — with image. The
 *  lead line "Z tej ciszy — głos." is the page enacting its own motto: the reader just
 *  lived through the silence, now the voice enters (a mid-page reprise of the hero's
 *  "Z ciszy głos."). One cinematic frame playing VOX_VIDEO
 *  (currently aliasing MODAL_VIDEO: one shared file with cross-surface resume; VideoPlayer
 *  owns the ambient duck/restore contract). Successor of the audio-only ListenMoment; the
 *  poster is optimized by the page (astro:assets) and passed in as a prop.
 * @architecture Astro islands 2026
 * @module islands/landing/VoxMoment
 */

import { VOX_VIDEO } from "../../data/landing/video";
import { VideoPlayer } from "./video/VideoPlayer";
import { Typo } from "./lib/Typo";

interface VoxMomentProps {
  /** Optimized poster URL, computed by index.astro via getImage. */
  readonly poster: string;
}

export function VoxMoment({ poster }: VoxMomentProps): React.JSX.Element {
  return (
    <Typo>
      <section className="vox" aria-label="Zobacz i usłysz">
        <div className="vox-inner">
          {/* The ink register reaches into this island: both classNames are constant strings, so
              React writes the attribute once and the shared observer's `.is-in` survives
              every re-render, and nothing here renders differently on the server than on the
              first client pass. Both conditions are required — see the footer's silent failure
              in docs/web-landing-guardrails.md. The player is deliberately left out: it owns a
              veiled state of its own, and a second veil over it would be two registers on one
              node. */}
          <p className="vox-eyebrow reveal">
            <span className="lat">Vox</span> · Zobacz i usłysz
          </p>
          <p className="vox-line reveal">
            Z tej ciszy — <em>głos.</em>
          </p>
          <VideoPlayer
            src={VOX_VIDEO.src}
            srcAv1={VOX_VIDEO.srcAv1}
            poster={poster}
            caption={VOX_VIDEO.caption}
          />
        </div>
      </section>
    </Typo>
  );
}
