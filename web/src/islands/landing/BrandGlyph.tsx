/**
 * @file BrandGlyph.tsx
 * @description The candle mark — used in the threshold gate, the chrome brand, the
 * vault head, the gratitude & failure modals, and the QR placeholder. The previous
 * implementation was a thin-line SVG; this one matches the rest of the chrome
 * (SiteChrome.brand-mark, StickyHeader.brand-glyph) by masking the gold logo PNG
 * with `currentColor`, so every host inherits the same brand silhouette plus the
 * radial halo elements its container already provides. The `strokeWidth` prop is
 * preserved purely for source-compat with existing call sites.
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
