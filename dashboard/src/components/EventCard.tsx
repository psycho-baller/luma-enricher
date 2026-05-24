import type { EnrichedEvent } from "../lib/types";
import { SerendipityGauge } from "./SerendipityGauge";
import { ConflictBadge } from "./ConflictBadge";
import { useEventData } from "../hooks/useEventData";

function formatTimeRange(event: EnrichedEvent): string {
  // extract just the time portion from the local strings
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
        relative rounded-xl p-4 cursor-pointer
        bg-[var(--color-surface-800)]/70 backdrop-blur-sm
        border transition-all duration-200
        hover:bg-[var(--color-surface-700)]/60 hover:shadow-lg hover:shadow-black/20
        hover:-translate-y-0.5
        ${isPicked
          ? "border-[var(--color-accent-400)]/60 shadow-md shadow-[var(--color-accent-400)]/10"
          : "border-[var(--color-surface-700)]/50"
        }
        ${isHidden ? "opacity-75" : ""}
      `}
      style={{
        borderLeftWidth: "3px",
        borderLeftColor: isPicked
          ? "var(--color-accent-400)"
          : event.serendipity.score >= 70
            ? "var(--color-score-high)"
            : event.serendipity.score >= 40
              ? "var(--color-score-mid)"
              : "var(--color-score-low)",
      }}
    >
      <div className="flex items-start gap-3">
        <SerendipityGauge score={event.serendipity.score} size="sm" />

        <div className="flex-1 min-w-0">
          <h3 className="text-sm font-semibold text-[var(--color-text-primary)] leading-tight line-clamp-2">
            {event.title}
          </h3>

          <div className="flex items-center gap-2 mt-1.5 text-xs text-[var(--color-text-muted)]">
            <span>{formatTimeRange(event)}</span>
            <span>·</span>
            <span>{event.time.duration_minutes}m</span>
          </div>

          <div className="flex items-center gap-2 mt-2 flex-wrap">
            {guestCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                bg-[var(--color-surface-700)]/60 text-[var(--color-text-secondary)]">
                👥 {guestCount}
              </span>
            )}

            {connectionCount > 0 && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                bg-[var(--color-connection-bg)] text-[var(--color-connection)]
                border border-[var(--color-connection)]/20">
                🤝 {connectionCount}
              </span>
            )}

            {isHidden && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs
                bg-[var(--color-surface-700)]/60 text-[var(--color-text-muted)]
                border border-dashed border-[var(--color-surface-600)]">
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
              flex-shrink-0 w-6 h-6 rounded-full border-2 transition-all duration-200
              flex items-center justify-center
              ${isPicked
                ? "bg-[var(--color-accent-400)] border-[var(--color-accent-400)] text-[var(--color-surface-950)]"
                : "border-[var(--color-surface-600)] hover:border-[var(--color-accent-400)]/60"
              }
            `}
          >
            {isPicked && (
              <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.5 4.5l-7 7L3 8" stroke="currentColor" strokeWidth="2" fill="none" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            )}
          </button>
        )}
      </div>
    </div>
  );
}
