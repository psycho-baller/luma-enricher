import { useEffect, useRef } from "react";

function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-score-high)";
  if (score >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

const SIZES = {
  sm: { size: 44, stroke: 3, fontSize: "11px", fontWeight: "700" },
  md: { size: 64, stroke: 4, fontSize: "16px", fontWeight: "800" },
  lg: { size: 96, stroke: 5, fontSize: "24px", fontWeight: "800" },
} as const;

export function SerendipityGauge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const circleRef = useRef<SVGCircleElement>(null);
  const config = SIZES[size];
  const radius = (config.size - config.stroke * 2) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  useEffect(() => {
    const el = circleRef.current;
    if (!el) return;
    el.style.strokeDashoffset = String(circumference);
    requestAnimationFrame(() => {
      el.style.transition = "stroke-dashoffset 800ms cubic-bezier(0.4, 0, 0.2, 1)";
      el.style.strokeDashoffset = String(offset);
    });
  }, [circumference, offset]);

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: config.size, height: config.size }}>
      <svg width={config.size} height={config.size} className="-rotate-90">
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-700)"
          strokeWidth={config.stroke}
        />
        <circle
          ref={circleRef}
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference}
          style={{ filter: `drop-shadow(0 0 4px ${color}40)` }}
        />
      </svg>
      <span
        className="absolute font-mono text-[var(--color-text-primary)]"
        style={{ fontSize: config.fontSize, fontWeight: config.fontWeight }}
      >
        {Math.round(score)}
      </span>
    </div>
  );
}
