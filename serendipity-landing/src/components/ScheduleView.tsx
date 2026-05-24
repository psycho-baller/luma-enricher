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
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <div className="w-16 h-16 rounded-full border border-dashed border-white/20 flex items-center justify-center mb-4 bg-white/5">
          <span className="text-2xl">📋</span>
        </div>
        <h2 className="text-lg font-semibold text-[var(--color-text-primary)] mb-1">
          No events added yet
        </h2>
        <p className="text-sm text-[var(--color-text-muted)] max-w-sm">
          Go to the Timeline view and select an event to add it to your schedule.
        </p>
      </div>
    );
  }

  return (
    <div className="pt-4 max-w-4xl mx-auto">
      {/* action bar */}
      <div className="glass-card-static p-4 mb-8 flex flex-col sm:flex-row items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-text-primary)]">
            My Schedule
          </h2>
          <div className="text-sm text-[var(--color-text-secondary)]">
            {totalPicked} events selected
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyMarkdown}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
          >
            Copy Markdown
          </button>
          <button
            onClick={handleDownloadJSON}
            className="px-3 py-1.5 rounded-lg text-xs font-medium border border-white/10 text-[var(--color-text-primary)] hover:bg-white/5 transition-colors"
          >
            Download JSON
          </button>
          <button
            onClick={clearAll}
            className="px-3 py-1.5 rounded-lg text-xs font-medium text-[var(--color-conflict)] hover:bg-[var(--color-conflict-bg)] transition-colors ml-2"
          >
            Clear All
          </button>
        </div>
      </div>

      {/* timeline */}
      <div className="space-y-10 relative">
        <div className="absolute left-6 top-4 bottom-4 w-px bg-white/10 hidden sm:block" />
        
        {pickedByDay.map((day) => (
          <div key={day.date} className="relative z-10">
            <div className="flex items-center gap-4 mb-4">
              <div className="hidden sm:flex w-12 h-12 rounded-xl bg-[var(--color-surface-800)] border border-white/10 items-center justify-center shadow-lg relative -left-6">
                <span className="text-sm font-semibold text-[var(--color-text-primary)]">
                  {day.date.split('-')[2]}
                </span>
              </div>
              <h3 className="font-semibold text-lg text-[var(--color-text-primary)]">
                {day.label}
              </h3>
            </div>
            
            <div className="space-y-3 sm:pl-10 stagger-children">
              {day.events.map((event) => (
                <div
                  key={event.id}
                  className="flex flex-col sm:flex-row sm:items-center gap-4 p-4 rounded-xl
                    glass-card-static hover:bg-white/5 hover:border-white/20 transition-all duration-200 group relative overflow-hidden"
                >
                  <div className="absolute top-0 bottom-0 left-0 w-1 bg-[var(--color-accent-400)]" />
                  
                  <div className="flex-shrink-0">
                    <SerendipityGauge score={event.serendipity.score} size="sm" />
                  </div>
                  
                  <div className="flex-1 min-w-0">
                    <h4 className="text-base font-semibold text-[var(--color-text-primary)] mb-1">{event.title}</h4>
                    
                    <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                      <span className="font-medium text-[var(--color-accent-400)]">{event.time.start_local}</span>
                      <span>·</span>
                      <span>{event.time.duration_minutes}m</span>
                      {event.location && (
                        <>
                          <span>·</span>
                          <span className="truncate max-w-[200px]">{event.location.address}</span>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 mt-2 sm:mt-0 sm:flex-col sm:items-end">
                    {(event.guest_list?.total_count ?? 0) > 0 && (
                      <span className="text-xs text-[var(--color-text-muted)] font-medium">
                        👥 {event.guest_list?.total_count}
                      </span>
                    )}
                    {event.serendipity.warm_connections.length > 0 && (
                      <span className="text-xs text-[var(--color-connection)] font-medium">
                        🤝 {event.serendipity.warm_connections.length}
                      </span>
                    )}
                  </div>
                  
                  <button
                    onClick={() => unpick(event.id)}
                    className="absolute top-2 right-2 sm:static sm:opacity-0 group-hover:opacity-100 p-2 rounded-lg text-[var(--color-text-muted)]
                      hover:text-[var(--color-conflict)] hover:bg-[var(--color-conflict-bg)]
                      transition-all"
                    title="Remove event"
                  >
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
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
