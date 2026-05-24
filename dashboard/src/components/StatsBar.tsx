import type { GlobalStats } from "../lib/types";

export function StatsBar({ stats }: { stats: GlobalStats }) {
  const safeDivide = (numerator: number, denominator: number) =>
    denominator === 0 ? 0 : numerator / denominator;

  const eventsPerDay = safeDivide(stats.total_events, stats.total_days);
  const warmReachRatio = safeDivide(stats.total_warm_connections, stats.total_unique_guests);
  const listCoverageRatio = safeDivide(stats.guest_lists_available, stats.total_events);
  const warmPerEvent = safeDivide(stats.total_warm_connections, stats.total_events);

  const opportunityIndex = Math.round(
    Math.min(
      100,
      listCoverageRatio * 45 +
        Math.min(warmPerEvent / 3, 1) * 35 +
        Math.min(eventsPerDay / 6, 1) * 20
    ) * 100
  );

  const items = [
    {
      label: "Weekly Pace",
      value: `${stats.total_events}`,
      kicker: `${eventsPerDay.toFixed(1)} events/day across ${stats.total_days} days`,
      highlight: `${stats.total_days}-day sprint`,
      signal: Math.min(eventsPerDay / 8, 1),
    },
    {
      label: "Total Reach",
      value: stats.total_unique_guests.toLocaleString(),
      kicker: "unique people in your orbit this week",
      highlight: "network surface area",
      signal: Math.min(stats.total_unique_guests / 2500, 1),
    },
    {
      label: "Warm Intro Rate",
      value: `${Math.round(warmReachRatio * 100)}%`,
      kicker: `${stats.total_warm_connections} existing connections in-room`,
      highlight: "relationship leverage",
      signal: warmReachRatio,
    },
    {
      label: "List Visibility",
      value: `${Math.round(listCoverageRatio * 100)}%`,
      kicker: `${stats.guest_lists_available} open lists, ${stats.guest_lists_hidden} hidden`,
      highlight: "intel completeness",
      signal: listCoverageRatio,
    },
    {
      label: "Opportunity Index",
      value: `${opportunityIndex}/100`,
      kicker: `~${warmPerEvent.toFixed(1)} warm intros per event`,
      highlight: "action priority",
      signal: opportunityIndex / 100,
    },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item) => (
        <div
          key={item.label}
          className="glass-card-static p-4 flex flex-col gap-2 transition-all hover:border-white/20 hover:-translate-y-0.5"
        >
          <div className="text-[10px] font-mono uppercase tracking-[0.22em] text-[var(--color-accent-400)]">
            {item.highlight}
          </div>
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider font-mono">
            {item.label}
          </div>
          <div className="text-3xl leading-none font-semibold text-[var(--color-text-primary)]">
            {item.value}
          </div>
          <div className="text-xs text-[var(--color-text-secondary)] leading-snug min-h-8">
            {item.kicker}
          </div>
          <div className="w-full h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--color-accent-600)] via-[var(--color-accent-500)] to-[var(--color-accent-400)]"
              style={{ width: `${Math.max(8, Math.round(item.signal * 100))}%` }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}
