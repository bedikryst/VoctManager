# VoctEnsemble site icon

Status: Discovery complete; responsive V study exists, final design and implementation pending (2026-09-29).

The subsequent optical proposals in `brand-lab/voctmanager-identity/directions-2026-09-29/` are also unapproved studies. `brand-lab/` is the local, git-ignored study lab shared with the app identity work; see that specification for its layout. The connected app identity work has an accepted community-role thesis and two fresh vector studies in `community-2026-09-29/`, with distinctiveness and small-size structure still unresolved. Its comparison reuses the existing site studies solely as labelled family references. No site favicon direction has been selected.

## Problem

`web/public/logo_icon.png` is a transparent 530 × 530 gold hairline with a flare. `web/src/layouts/BaseLayout.astro` uses it as the site's favicon and Apple touch icon on every page. Its main line is about 7 source pixels wide, so it almost disappears at 16 × 16. The shape's tiny-size failure is inherent to the asset rather than a CSS placement issue.

This is a secondary site icon. The main VoctEnsemble glyph in `web/public/voct-mark.svg` has split calligraphic arms, a long axial line, and a detached tilted note head; the site uses it in navigation, larger brand placements, its preloader, and the press pack. Those uses are outside this change.

## Next stage

1. Draw a compact vector sibling of the house glyph for the favicon, emphasizing a bold split and axial form that survives at 16 and 32 pixels. Preserve the detached note only if it resolves cleanly at those sizes.
2. Export and inspect 16 × 16 and 32 × 32 favicon renditions, plus an opaque Apple touch icon. Judge the actual browser tab and phone icon in the developer's browser and device.
3. Replace the two icon references in `web/src/layouts/BaseLayout.astro` and store the editable vector master under `web/public/`. Keep `voct-mark.svg`, its small raster master, and the preloader as they are.
4. Run the web project's existing build once after the assets and references are final.

The VoctManager app identity is a connected workstream in `docs/specs/voctmanager-app-identity-2026-09.md`. A source-contour responsive V study lives in `brand-lab/voctmanager-identity/`; it is a size baseline, not the final site favicon. Coordinate family resemblance, but do not use the same square app icon for both products.
