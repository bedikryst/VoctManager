/**
 * @file VoxMoment.tsx
 * @description "Zobacz i usłysz" — the heart of movement II (Vox memoriae): after the
 *  silence beat, the actual voice — with image. One cinematic frame playing VOX_VIDEO
 *  (currently aliasing MODAL_VIDEO: one shared file with cross-surface resume; VideoPlayer
 *  owns the ambient duck/restore contract). Successor of the audio-only ListenMoment; the
 *  poster is optimized by the page (astro:assets) and passed in as a prop.
 * @architecture Astro islands 2026
 * @module islands/landing/VoxMoment
 */

import { VOX_VIDEO } from "../../data/landing/video";
import { VideoPlayer } from "./video/VideoPlayer";

interface VoxMomentProps {
  /** Optimized poster URL, computed by index.astro via getImage. */
  readonly poster: string;
}

export function VoxMoment({ poster }: VoxMomentProps): React.JSX.Element {
  return (
    <section className="vox" aria-label="Zobacz i usłysz">
      <div className="vox-inner">
        <p className="vox-eyebrow">
          <span className="lat">Vox</span> · Zobacz i usłysz
        </p>
        <p className="vox-line">
          Zanim przeczytasz — <em>usłysz.</em>
        </p>
        <VideoPlayer src={VOX_VIDEO.src} poster={poster} caption={VOX_VIDEO.caption} />
      </div>
    </section>
  );
}
