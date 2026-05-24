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
    { label: "Volume", value: bd.volume, color: "var(--color-accent-400)" },
    { label: "Quality", value: bd.quality, color: "var(--color-text-primary)" },
    { label: "Super Connectors", value: bd.connectors, color: "var(--color-super-connector)" },
    { label: "Relevance", value: bd.relevance, color: "var(--color-text-secondary)" },
  ];

  const picked = isPicked(event.id);

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 animate-backdrop-in"
        onClick={onClose}
      />
      <div className="fixed top-0 right-0 h-full w-full max-w-xl z-50
        bg-[var(--color-surface-950)] border-l border-white/10
        overflow-y-auto animate-slide-in shadow-2xl
        flex flex-col">
        
        {/* header */}
        <div className="sticky top-0 bg-[var(--color-surface-950)]/90 backdrop-blur-md z-30 p-6 pb-5
          border-b border-white/10 flex-shrink-0">
          <div className="flex items-start justify-between gap-6">
            <div className="flex-1 min-w-0">
              <h2 className="text-xl font-semibold text-[var(--color-text-primary)] leading-tight mb-2">
                {event.title}
              </h2>
              
              <div className="text-sm font-medium text-[var(--color-text-secondary)] mb-1">
                {event.time.start_local}
              </div>
              
              {event.location && (
                <div className="text-sm text-[var(--color-text-muted)] mt-1 flex items-start gap-1.5">
                  <span className="mt-0.5">📍</span>
                  {event.location.address}
                </div>
              )}
              
              <div className="flex items-center gap-3 mt-4">
                <a
                  href={event.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-4 py-2 rounded-lg bg-[var(--color-surface-800)] text-sm font-medium text-[var(--color-accent-400)] hover:bg-[var(--color-surface-700)] transition-colors border border-white/5"
                >
                  View on Luma ↗
                </a>
                <span className="text-xs text-[var(--color-text-muted)] font-medium">
                  By {event.organizer}
                </span>
              </div>
            </div>
            
            <div className="flex flex-col items-center gap-4">
              <button
                onClick={onClose}
                className="self-end p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-800)] transition-colors"
              >
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              </button>
              <SerendipityGauge score={event.serendipity.score} size="md" />
            </div>
          </div>

          <button
            onClick={() => picked ? unpick(event.id) : pick(event.id, event.conflicts)}
            className={`mt-6 w-full py-2.5 rounded-lg font-medium transition-all duration-200
              ${picked
                ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-400)] border border-[var(--color-accent-400)]/30"
                : "bg-[var(--color-surface-800)] text-[var(--color-text-primary)] border border-white/10 hover:bg-[var(--color-surface-700)]"
              }`}
          >
            {picked ? "Remove from Schedule" : "Add to Schedule"}
          </button>
        </div>

        <div className="p-6 space-y-8 flex-1 overflow-y-auto">
          {/* score breakdown */}
          <section className="glass-card-static p-5">
            <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-4 font-mono">
              Score Breakdown
            </h3>
            <div className="space-y-3">
              {breakdownBars.map((bar) => (
                <div key={bar.label} className="flex items-center gap-4">
                  <span className="text-xs text-[var(--color-text-secondary)] w-32 flex-shrink-0">
                    {bar.label}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-[var(--color-surface-800)] overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all duration-500 ease-out"
                      style={{
                        width: `${bar.value}%`,
                        backgroundColor: bar.color,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-[var(--color-text-muted)] w-8 text-right font-mono">
                    {Math.round(bar.value)}
                  </span>
                </div>
              ))}
            </div>
          </section>

          {/* warm connections */}
          {warmPeople.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-connection)] uppercase tracking-wider mb-3 flex items-center gap-2 font-mono">
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
              <h3 className="text-xs font-semibold text-[var(--color-super-connector)] uppercase tracking-wider mb-3 font-mono">
                Super Connectors ({scPeople.length})
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {scPeople.slice(0, 8).map((p) => (
                  <div
                    key={p!.api_id}
                    onClick={() => onPersonClick?.(p!.api_id)}
                    className="flex items-center gap-3 p-2.5 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    {p!.avatar_url ? (
                      <img src={p!.avatar_url} alt="" className="w-8 h-8 rounded-full object-cover" />
                    ) : (
                      <div className="w-8 h-8 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center font-medium text-[var(--color-text-muted)]">
                        {p!.name.charAt(0)}
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{p!.name}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">{p!.events_attending.length} events</div>
                    </div>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* guest highlights */}
          {guestsWithBio.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 font-mono">
                Notable Guests
              </h3>
              <div className="space-y-2">
                {guestsWithBio.map((g) => (
                  <div
                    key={g!.api_id}
                    onClick={() => onPersonClick?.(g!.api_id)}
                    className="p-3 rounded-lg border border-white/5 bg-white/5 hover:bg-white/10 cursor-pointer transition-colors"
                  >
                    <div className="flex items-center gap-2 mb-1.5">
                      {g!.avatar_url ? (
                        <img src={g!.avatar_url} alt="" className="w-5 h-5 rounded-full object-cover" />
                      ) : (
                        <div className="w-5 h-5 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center text-[10px] font-medium text-[var(--color-text-muted)]">
                          {g!.name.charAt(0)}
                        </div>
                      )}
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">{g!.name}</span>
                    </div>
                    <p className="text-xs text-[var(--color-text-secondary)] leading-relaxed pl-7 line-clamp-3">{g!.bio}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* conflicts */}
          {event.conflicts.length > 0 && (
            <section>
              <h3 className="text-xs font-semibold text-[var(--color-conflict)] uppercase tracking-wider mb-3 font-mono">
                Conflicts ({event.conflicts.length})
              </h3>
              <div className="space-y-2 border border-[var(--color-conflict)]/20 rounded-lg p-3 bg-[var(--color-conflict-bg)]">
                {event.conflicts.map((cid) => {
                  const ce = getEvent(cid);
                  if (!ce) return null;
                  return (
                    <div key={cid} className="flex items-center gap-3 p-2 border-b border-[var(--color-conflict)]/10 last:border-0">
                      <SerendipityGauge score={ce.serendipity.score} size="sm" />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-[var(--color-text-primary)] truncate">{ce.title}</div>
                        <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
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
