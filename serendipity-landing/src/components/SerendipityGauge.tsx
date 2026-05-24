function scoreColor(score: number): string {
  if (score >= 70) return "var(--color-score-high)";
  if (score >= 40) return "var(--color-score-mid)";
  return "var(--color-score-low)";
}

const SIZES = {
  sm: { size: 48, stroke: 3, fontSize: "12px" },
  md: { size: 72, stroke: 4, fontSize: "18px" },
  lg: { size: 120, stroke: 6, fontSize: "32px" },
} as const;

export function SerendipityGauge({
  score,
  size = "md",
}: {
  score: number;
  size?: "sm" | "md" | "lg";
}) {
  const config = SIZES[size];
  const radius = (config.size - config.stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;
  const color = scoreColor(score);

  return (
    <div 
      className="relative inline-flex items-center justify-center rounded-full" 
      style={{ width: config.size, height: config.size }}
    >
      <svg width={config.size} height={config.size} className="-rotate-90">
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke="var(--color-surface-800)"
          strokeWidth={config.stroke}
        />
        <circle
          cx={config.size / 2}
          cy={config.size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={config.stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span
          className="font-semibold text-[var(--color-text-primary)]"
          style={{ fontSize: config.fontSize }}
        >
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
}
