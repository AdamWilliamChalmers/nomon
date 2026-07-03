type LumenMarkProps = {
  size?: number;
  /** "none" = static, "loop" = continuous (hero), "once" = single play */
  animate?: "none" | "loop" | "once";
  className?: string;
  title?: string;
};

/**
 * Lumen mark — four dots in a T formation: green / amber / purple across the
 * top, blue below centre. Pure CSS (no SVG) so it scales and animates crisply
 * at any size. Each dot carries its rest (T) and expanded (diamond) offsets as
 * custom properties; the processing loop converges, pulses, orbits, and returns.
 * Colours are the fixed brand palette. On light surfaces we keep the dots opaque
 * (no mix-blend-mode).
 */
const DOTS = [
  { c: "#5ba85c", rx: -0.37, ry: -0.2, ex: 0, ey: -0.35 }, // green  → N
  { c: "#e5a33d", rx: 0, ry: -0.2, ex: 0.35, ey: 0 }, // amber  → E
  { c: "#8e44ad", rx: 0.37, ry: -0.2, ex: 0, ey: 0.35 }, // purple → S
  { c: "#5b9bd5", rx: 0, ry: 0.17, ex: -0.35, ey: 0 }, // blue   → W
];

export default function LumenMark({
  size = 40,
  animate = "none",
  className = "",
  title = "Lumen",
}: LumenMarkProps) {
  const d = size * 0.25;
  const animClass =
    animate === "loop" ? " is-loop" : animate === "once" ? " is-active" : "";

  return (
    <span
      className={`lumen-mark${animClass}${className ? ` ${className}` : ""}`}
      style={{
        position: "relative",
        display: "inline-block",
        width: size,
        height: size,
        flexShrink: 0,
      }}
      role="img"
      aria-label={title}
    >
      <span className="lm-spin" style={{ position: "absolute", inset: 0 }}>
        {DOTS.map((dot, i) => (
          <span
            key={i}
            className="lm-dot"
            style={
              {
                position: "absolute",
                top: "50%",
                left: "50%",
                width: d,
                height: d,
                margin: `${-d / 2}px 0 0 ${-d / 2}px`,
                borderRadius: "50%",
                background: dot.c,
                ["--rx" as string]: `${dot.rx * size}px`,
                ["--ry" as string]: `${dot.ry * size}px`,
                ["--ex" as string]: `${dot.ex * size}px`,
                ["--ey" as string]: `${dot.ey * size}px`,
              } as React.CSSProperties
            }
          />
        ))}
      </span>
    </span>
  );
}
