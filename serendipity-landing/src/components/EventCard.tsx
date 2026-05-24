import type { EnrichedEvent } from "../lib/types";
import { SerendipityGauge } from "./SerendipityGauge";
import { ConflictBadge } from "./ConflictBadge";
import { useEventData } from "../hooks/useEventData";

function formatTimeRange(event: EnrichedEvent): string {
  const startMatch = event.time.start_local.match(/at\s+(.+)/);
  const endMatch = event.time.end_local.match(/at\s+(.+)/);
  const start = startMatch?.[1] ?? event.time.start_local;
  const end = endMatch?.[1] ?? event.time.end_local;
  return `${start} — ${end}`;
}

export function EventCard({
  event,
  isPicked,
  onPick,
  onSelect,
}: {
  event: EnrichedEvent;
  isPicked?: boolean;
  onPick?: () => void;
  onSelect?: () => void;
}) {
  const { getEvent } = useEventData();
  const conflictTitles = event.conflicts.map((id) => getEvent(id)?.title ?? id);
  const guestCount = event.guest_list?.total_count ?? 0;
  const connectionCount = event.serendipity.warm_connections.length;
  const isHidden = !event.guest_list?.available;

  return (
    <div
      onClick={onSelect}
      className={`
        relative p-5 cursor-pointer group
        transition-all duration-200
        glass-card
        hover:-translate-y-0.5 hover:shadow-lg
        ${isHidden ? "opacity-75" : ""}
      `}
      style={{
        borderColor: isPicked 
          ? "var(--color-accent-400)" 
          : "rgba(255, 255, 255, 0.08)",
        backgroundColor: isPicked ? "var(--color-accent-bg)" : undefined
      }}
    >
      <div className="flex items-start gap-4">
        <SerendipityGauge score={event.serendipity.score} size="sm" />

        <div className="flex-1 min-w-0">
          <h3 className="text-base font-semibold text-[var(--color-text-primary)] leading-tight line-clamp-2 mb-1.5">
            {event.title}
          </h3>

          <div className="flex items-center gap-2 text-xs font-mono text-[var(--color-text-secondary)]">
            <span>{formatTimeRange(event)}</span>
            <span className="opacity-50">·</span>
            <span>{event.time.duration_minutes}m</span>
          </div>

          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {guestCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-[11px] font-medium text-[var(--color-text-secondary)] border border-white/10">
                👥 {guestCount}
              </span>
            )}

            {connectionCount > 0 && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-[var(--color-connection-bg)] text-[11px] font-medium text-[var(--color-connection)] border border-[var(--color-connection)]/20">
                🤝 {connectionCount}
              </span>
            )}

            {isHidden && (
              <span className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-white/5 text-[11px] font-medium text-[var(--color-text-muted)] border border-dashed border-white/20">
                Limited data
              </span>
            )}

            <ConflictBadge count={event.conflicts.length} conflictingTitles={conflictTitles} />
          </div>
        </div>

        {onPick && (
          <button
            onClick={(e) => { e.stopPropagation(); onPick(); }}
            className={`
              flex-shrink-0 w-7 h-7 rounded-full border transition-all duration-200
              flex items-center justify-center ml-2
              ${isPicked
                ? "bg-[var(--color-accent-400)] border-[var(--color-accent-400)] text-[var(--color-surface-950)]"
                : "border-[var(--color-surface-500)] text-transparent group-hover:border-[var(--color-accent-400)]"
              }
            `}
          >
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className={isPicked ? "text-[var(--color-surface-950)]" : "text-transparent group-hover:text-[var(--color-accent-400)] transition-colors"}>
              <path d="M13.5 4.5l-7 7L3 8" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}
