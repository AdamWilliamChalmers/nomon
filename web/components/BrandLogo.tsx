import LumenMark from "./LumenMark";

type BrandLogoProps = {
  variant?: "full" | "icon";
  height?: number;
  className?: string;
  priority?: boolean;
  ghost?: boolean;
  animate?: "none" | "loop" | "once";
};

/**
 * Lumen brand lockup — the four-dot mark, optionally paired with the "lumen"
 * wordmark.
 */
export default function BrandLogo({
  variant = "full",
  height,
  className = "",
  ghost = false,
  animate = "none",
}: BrandLogoProps) {
  const markSize = height ?? (variant === "full" ? 28 : 20);
  const wordSize = Math.round(markSize * 0.64);

  const mark = <LumenMark size={markSize} animate={animate} />;

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
