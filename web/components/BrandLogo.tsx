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
 * Nomon brand lockup — the four-dot mark, optionally paired with the wordmark.
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

  const mark = <LumenMark size={markSize} animate={animate} title="Nomon" />;

  if (variant === "icon") {
    return (
      <span
        className={className}
        style={{ display: "inline-flex", opacity: ghost ? 0.3 : 1 }}
        aria-label="Nomon"
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
      aria-label="Nomon"
    >
      {mark}
      <span
        style={{
          fontFamily: "Georgia, 'Times New Roman', serif",
          fontSize: wordSize,
          fontWeight: 400,
          color: "#1a1825",
          letterSpacing: "0.32em",
          marginLeft: "0.32em",
          textTransform: "uppercase",
          lineHeight: 1,
        }}
      >
        Nomon
      </span>
    </span>
  );
}
