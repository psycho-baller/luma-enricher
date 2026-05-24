import { useEventData } from "../hooks/useEventData";
import { useSchedule } from "../hooks/useSchedule";
import { SerendipityGauge } from "./SerendipityGauge";

export function ScheduleView() {
  const { data } = useEventData();
  const { pickedEvents, unpick, clearAll, exportMarkdown } = useSchedule();

  const pickedByDay = data.days
    .map((day) => ({
      ...day,
      events: day.events.filter((e) => pickedEvents.has(e.id)),
    }))
    .filter((day) => day.events.length > 0);

  const totalPicked = pickedByDay.reduce((sum, d) => sum + d.events.length, 0);

  const handleCopyMarkdown = () => {
    const md = exportMarkdown(data);
    navigator.clipboard.writeText(md);
  };

  const handleDownloadJSON = () => {
    const picked = data.days.flatMap((d) => d.events).filter((e) => pickedEvents.has(e.id));
    const blob = new Blob([JSON.stringify(picked, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "my-ttw-schedule.json";
    a.click();
    URL.revokeObjectURL(url);
  };

  if (totalPicked === 0) {
    return (
      <div className="text-center py-16">
        <div className="text-4xl mb-4">📋</div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-2">
          No events picked yet
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-md mx-auto">
          Go to the Timeline view and click the circle on any event card to add it to your schedule.
          When events conflict, picking one will automatically remove the others.
        </p>
      </div>
    );
  }

  return (
    <div>
      {/* actions bar */}
      <div className="flex items-center gap-3 mb-6">
        <span className="text-sm text-[var(--color-text-secondary)]">
          {totalPicked} event{totalPicked !== 1 ? "s" : ""} picked
        </span>
        <div className="ml-auto flex gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[var(--color-accent-400)]/20 text-[var(--color-accent-400)]
              border border-[var(--color-accent-400)]/30
              hover:bg-[var(--color-accent-400)]/30 transition-colors"
          >
            📋 Copy Markdown
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[var(--color-surface-800)] text-[var(--color-text-secondary)]
              border border-[var(--color-surface-700)]
              hover:bg-[var(--color-surface-700)] transition-colors"
          >
            ⬇ Download JSON
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium
              bg-[var(--color-surface-800)] text-[var(--color-conflict)]
              border border-[var(--color-surface-700)]
              hover:bg-[var(--color-conflict-bg)] transition-colors"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* clean schedule */}
      <div className="space-y-6">
        {pickedByDay.map((day) => (
          <div key={day.date}>
            <h3 className="text-sm font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              {day.label}
            </h3>
            <div className="space-y-2 stagger-children">
              {day.events.map((event) => (
                <div
                  key={event.id}
                  className="flex items-center gap-4 p-4 rounded-xl
                    bg-[var(--color-surface-800)]/70 border border-[var(--color-accent-400)]/20"
                >
                  <SerendipityGauge score={event.serendipity.score} size="sm" />
                  <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-semibold text-[var(--color-text-primary)]">{event.title}</h4>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                      {event.time.start_local} · {event.time.duration_minutes}m
                    </div>
                    {event.location && (
                      <div className="text-xs text-[var(--color-text-muted)]">{event.location.address}</div>
                    )}
                    <div className="flex gap-3 mt-1 text-xs text-[var(--color-text-secondary)]">
                      {(event.guest_list?.total_count ?? 0) > 0 && (
                        <span>👥 {event.guest_list?.total_count}</span>
                      )}
                      {event.serendipity.warm_connections.length > 0 && (
                        <span className="text-[var(--color-connection)]">
                          🤝 {event.serendipity.warm_connections.length} connections
                        </span>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => unpick(event.id)}
                    className="p-1.5 rounded-lg text-[var(--color-text-muted)]
                      hover:text-[var(--color-conflict)] hover:bg-[var(--color-conflict-bg)]
                      transition-colors flex-shrink-0"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
