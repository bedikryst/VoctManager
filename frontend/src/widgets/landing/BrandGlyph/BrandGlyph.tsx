/**
 * @file BrandGlyph.tsx
 * @description The candle mark — used in the threshold gate, the chrome brand, the
 * vault head, the gratitude & failure modals, and the QR placeholder.
 * Pure presentation: a single SVG with overridable stroke-width.
 * @architecture Enterprise SaaS 2026
 * @module widgets/landing/BrandGlyph
 */

export function BrandGlyph({
  strokeWidth = 1.3,
  className,
}: {
  readonly strokeWidth?: number;
  readonly className?: string;
}): React.JSX.Element {
  return (
    <svg
      viewBox="0 0 24 56"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      aria-hidden="true"
    >
      <path d="M12 3 V47" />
      <path d="M3.2 12.5 L12 36.5" />
      <path d="M20.8 12.5 L12 36.5" />
      <path d="M0.5 12.5 L5.5 12.5" />
      <path d="M18.5 12.5 L23.5 12.5" />
      <circle cx="12" cy="52" r="1.6" fill="currentColor" stroke="none" />
    </svg>
  );
}
