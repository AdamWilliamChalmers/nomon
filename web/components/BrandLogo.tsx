type BrandLogoProps = {
  variant?: "full" | "icon";
  height?: number;
  className?: string;
  priority?: boolean;
  ghost?: boolean;
};

/**
 * Lumen mark — three concentric rings at decreasing opacity, set in a
 * rounded "dusk" square. Rendered as inline SVG so it sits correctly on the
 * near-white Diffuse surfaces.
 */
export default function BrandLogo({
  variant = "full",
  height,
  className = "",
  ghost = false,
}: BrandLogoProps) {
  const markSize = height ?? (variant === "full" ? 28 : 20);
  const radius = Math.round(markSize * 0.26);
  const glyph = Math.round(markSize * 0.55);
  const wordSize = Math.round(markSize * 0.64);

  const mark = (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: markSize,
        height: markSize,
        borderRadius: radius,
        background: "#1a1825",
        flexShrink: 0,
      }}
    >
      <svg width={glyph} height={glyph} viewBox="0 0 18 18" fill="none" aria-hidden="true">
        <circle cx="9" cy="9" r="3" fill="white" opacity="0.95" />
        <circle cx="9" cy="9" r="6" stroke="white" strokeWidth="1" opacity="0.3" />
        <circle cx="9" cy="9" r="8.5" stroke="white" strokeWidth="0.5" opacity="0.15" />
      </svg>
    </span>
  );

  if (variant === "icon") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", opacity: ghost ? 0.3 : 1 }}
        aria-label="Lumen"
      >
        {mark}
      </span>
    );
  }

  return (
    <span
      className={className}
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: Math.round(markSize * 0.32),
        opacity: ghost ? 0.3 : 1,
      }}
      aria-label="Lumen"
    >
      {mark}
      <span
        style={{
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          fontSize: wordSize,
          fontWeight: 600,
          color: "#1a1825",
          letterSpacing: "-0.02em",
          lineHeight: 1,
        }}
      >
        lumen
      </span>
    </span>
  );
}
