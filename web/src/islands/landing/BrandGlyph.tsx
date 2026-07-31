/**
 * @file BrandGlyph.tsx
 * @description The house mark — used in the threshold, the chrome brand, the vault head,
 * the gratitude & failure modals, and the QR placeholder. It matches the rest of the
 * chrome (SiteChrome.brand-mark, StickyHeader.brand-glyph) by masking the house mark
 * with `currentColor`, so every host inherits the same silhouette plus the radial halo
 * elements its container already provides. Every one of these hosts sits under the
 * ~110px optical-size crossover, so the mask is the raster master — see the note on
 * `.brand-glyph-shape` in styles/base.css. The `strokeWidth` prop is preserved purely
 * for source-compat with existing call sites.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/BrandGlyph
 */

export function BrandGlyph({
  className,
}: {
  /** Legacy: kept for source-compat with the prior SVG implementation; ignored. */
  readonly strokeWidth?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <span
      className={`brand-glyph-shape${className ? ` ${className}` : ""}`}
      aria-hidden="true"
    />
  );
}
