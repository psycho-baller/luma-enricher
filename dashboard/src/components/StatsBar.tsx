import type { GlobalStats } from "../lib/types";

export function StatsBar({ stats }: { stats: GlobalStats }) {
  const items = [
    { label: "Events", value: stats.total_events, icon: "📅" },
    { label: "Days", value: stats.total_days, icon: "🗓" },
    { label: "Unique Guests", value: stats.total_unique_guests.toLocaleString(), icon: "👥" },
    { label: "Your Connections", value: stats.total_warm_connections, icon: "🤝" },
    { label: "Guest Lists", value: `${stats.guest_lists_available}/${stats.total_events}`, icon: "📋" },
  ];

  return (
    <div className="flex gap-3 overflow-x-auto pb-2 px-1">
      {items.map((item) => (
        <div
          key={item.label}
          className="flex items-center gap-3 px-5 py-3 rounded-xl min-w-fit
            bg-[var(--color-surface-800)]/60 backdrop-blur-sm
            border border-[var(--color-surface-700)]/50
            transition-all duration-200 hover:border-[var(--color-surface-600)]"
        >
          <span className="text-lg">{item.icon}</span>
          <div>
            <div className="text-xl font-bold font-mono text-[var(--color-text-primary)]">
              {item.value}
            </div>
            <div className="text-xs text-[var(--color-text-muted)] uppercase tracking-wider">
              {item.label}
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
