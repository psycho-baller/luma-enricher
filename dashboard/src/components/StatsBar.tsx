import type { GlobalStats } from "../lib/types";

export function StatsBar({ stats }: { stats: GlobalStats }) {
  const items = [
    { label: "Events", value: stats.total_events, icon: "📅" },
    { label: "Days", value: stats.total_days, icon: "🗓" },
    { label: "Unique Guests", value: stats.total_unique_guests.toLocaleString(), icon: "👥" },
    { label: "Your Connections", value: stats.total_warm_connections, icon: "🤝" },
    { label: "Guest Lists", value: `${Math.round((stats.guest_lists_available / stats.total_events) * 100)}%`, icon: "📋" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
      {items.map((item, i) => (
        <div
          key={item.label}
          className="glass-card-static p-4 flex flex-col items-start transition-colors hover:border-white/20"
        >
          <div className="text-xl mb-2">{item.icon}</div>
          <div className="text-2xl font-semibold text-[var(--color-text-primary)] mb-1">
            {item.value}
          </div>
          <div className="text-xs font-medium text-[var(--color-text-muted)] uppercase tracking-wider font-mono">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
}
