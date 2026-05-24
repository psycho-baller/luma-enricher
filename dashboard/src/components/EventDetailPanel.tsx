import type { EnrichedEvent } from "../lib/types";
import { useEventData } from "../hooks/useEventData";
import { useSchedule } from "../hooks/useSchedule";
import { SerendipityGauge } from "./SerendipityGauge";
import { ConnectionCard } from "./ConnectionCard";
import { SuperConnectorBadge } from "./SuperConnectorBadge";

export function EventDetailPanel({
  event,
  onClose,
  onPersonClick,
}: {
  event: EnrichedEvent | null;
  onClose: () => void;
  onPersonClick?: (apiId: string) => void;
}) {
  const { getPerson, getEvent } = useEventData();
  const { isPicked, pick, unpick } = useSchedule();

  if (!event) return null;

  const warmPeople = event.serendipity.warm_connections
    .map((id) => getPerson(id))
    .filter(Boolean);
  const scPeople = event.serendipity.super_connectors
    .map((id) => getPerson(id))
    .filter(Boolean)
    .filter((p) => !p!.is_your_connection);
  const guestIds = event.guest_list?.guests ?? [];
  const allGuests = guestIds
    .map((id) => getPerson(id))
    .filter(Boolean);
  const guestsWithBio = allGuests.filter((g) => g!.bio).slice(0, 10);

  const bd = event.serendipity.breakdown;
  const breakdownBars = [
    { label: "Warm Connections", value: bd.warm, color: "var(--color-connection)" },
    { label: "Guest Volume", value: bd.volume, color: "var(--color-accent-400)" },
    { label: "Guest Quality", value: bd.quality, color: "var(--color-super-connector)" },
    { label: "Super Connectors", value: bd.connectors, color: "#818cf8" },
    { label: "Topic Relevance", value: bd.relevance, color: "#38bdf8" },
  ];

  const picked = isPicked(event.id);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 transition-opacity"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-lg z-50
        bg-[var(--color-surface-900)] border-l border-[var(--color-surface-700)]
        overflow-y-auto animate-slide-in shadow-2xl shadow-black/40">

        {/* header */}
        <div className="sticky top-0 bg-[var(--color-surface-900)]/95 backdrop-blur-sm z-10 p-5 pb-4
          border-b border-[var(--color-surface-700)]/50">
          <div className="flex items-start justify-between gap-3">
            <div className="flex-1 min-w-0">
              <h2 className="text-lg font-bold text-[var(--color-text-primary)] leading-tight">
                {event.title}
              </h2>
              <div className="text-sm text-[var(--color-text-secondary)] mt-1">
                {event.time.start_local}
              </div>
              {event.location && (
                <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                  {event.location.address}
                </div>
              )}
              <div className="flex items-center gap-2 mt-2">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs text-[var(--color-accent-400)] hover:underline"
                >
                  View on Luma →
                </a>
                <span className="text-xs text-[var(--color-text-muted)]">
                  by {event.organizer}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <SerendipityGauge score={event.serendipity.score} size="md" />
              <button
                onClick={onClose}
                className="p-1.5 rounded-lg text-[var(--color-text-muted)]
                  hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-800)]
                  transition-colors"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <button
            onClick={() => picked ? unpick(event.id) : pick(event.id, event.conflicts)}
            className={`mt-3 w-full py-2 rounded-lg text-sm font-medium transition-all duration-200
              ${picked
                ? "bg-[var(--color-accent-400)]/20 text-[var(--color-accent-400)] border border-[var(--color-accent-400)]/30"
                : "bg-[var(--color-surface-800)] text-[var(--color-text-secondary)] border border-[var(--color-surface-700)] hover:border-[var(--color-accent-400)]/40"
              }`}
          >
            {picked ? "✓ Added to Schedule" : "+ Add to Schedule"}
          </button>
        </div>

        <div className="p-5 space-y-6">
          {/* score breakdown */}
          <section>
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
              Serendipity Breakdown
            </h3>
            <div className="space-y-2">
              {breakdownBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-3">
                  <span className="text-xs text-[var(--color-text-secondary)] w-32 flex-shrink-0">
                    {bar.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-700)]">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${bar.value}%`,
                        backgroundColor: bar.color,
                        boxShadow: `0 0 6px ${bar.color}40`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-mono text-[var(--color-text-muted)] w-8 text-right">
                    {Math.round(bar.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* warm connections */}
          {warmPeople.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-connection)] uppercase tracking-wider mb-3">
                Your Connections ({warmPeople.length})
              </h3>
              <div className="space-y-2 stagger-children">
                {warmPeople.map((p) => (
                  <ConnectionCard
                    key={p!.api_id}
                    person={p!}
                    onClick={() => onPersonClick?.(p!.api_id)}
                  />
                ))}
              </div>
            </section>
          )}

          {/* super connectors */}
          {scPeople.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-super-connector)] uppercase tracking-wider mb-3">
                Super Connectors ({scPeople.length})
              </h3>
              <div className="space-y-1.5">
                {scPeople.slice(0, 8).map((p) => (
                  <div
                    key={p!.api_id}
                    onClick={() => onPersonClick?.(p!.api_id)}
                    className="flex items-center gap-2 p-2 rounded-lg cursor-pointer
                      hover:bg-[var(--color-surface-800)] transition-colors"
                  >
                    {p!.avatar_url ? (
                      <img src={p!.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                    ) : (
                      <div className="w-7 h-7 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                        {p!.name.charAt(0)}
                      </div>
                    )}
                    <span className="text-sm text-[var(--color-text-primary)] flex-1 truncate">{p!.name}</span>
                    <SuperConnectorBadge eventCount={p!.events_attending.length} />
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* guest highlights */}
          {guestsWithBio.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3">
                Notable Guests
              </h3>
              <div className="space-y-1.5">
                {guestsWithBio.map((g) => (
                  <div
                    key={g!.api_id}
                    onClick={() => onPersonClick?.(g!.api_id)}
                    className="p-2 rounded-lg cursor-pointer hover:bg-[var(--color-surface-800)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {g!.avatar_url ? (
                        <img src={g!.avatar_url} alt="" className="w-7 h-7 rounded-full object-cover" />
                      ) : (
                        <div className="w-7 h-7 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center text-xs text-[var(--color-text-muted)]">
                          {g!.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{g!.name}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] mt-0.5 ml-9 line-clamp-2">{g!.bio}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* conflicts */}
          {event.conflicts.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-conflict)] uppercase tracking-wider mb-3">
                Conflicts ({event.conflicts.length})
              </h3>
              <div className="space-y-1.5">
                {event.conflicts.map((cid) => {
                  const ce = getEvent(cid);
                  if (!ce) return null;
                  return (
                    <div key={cid} className="flex items-center gap-3 p-2 rounded-lg
                      bg-[var(--color-conflict-bg)] border border-[var(--color-conflict)]/10">
                      <SerendipityGauge score={ce.serendipity.score} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-[var(--color-text-primary)] truncate">{ce.title}</div>
                        <div className="text-xs text-[var(--color-text-muted)]">
                          {ce.guest_list?.total_count ?? "?"} guests · {ce.serendipity.warm_connections.length} connections
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
        </div>
      </div>
    </>
  );
}
