import { useState, useMemo } from "react";
import { useEventData } from "../hooks/useEventData";
import { SuperConnectorBadge } from "./SuperConnectorBadge";
import type { PersonSummary } from "../lib/types";

export function PeopleExplorer({
  onPersonClick,
}: {
  onPersonClick: (apiId: string) => void;
}) {
  const { allPeople, getEvent } = useEventData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "connections" | "super" | "bio">("all");
  const [sortBy, setSortBy] = useState<"events" | "name">("events");

  function resolvePersonLocation(person: PersonSummary): string | null {
    if (person.location) return person.location;

    const cityCounts = new Map<string, number>();
    for (const eventId of person.events_attending) {
      const city = getEvent(eventId)?.location?.city?.trim();
      if (!city) continue;
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    }

    const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return topCity ?? null;
  }

  const filtered = useMemo(() => {
    let list = allPeople;

    if (filter === "connections") list = list.filter((p) => p.is_your_connection);
    else if (filter === "super") list = list.filter((p) => p.events_attending.length >= 3);
    else if (filter === "bio") list = list.filter((p) => p.bio);

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.linkedin_company?.toLowerCase().includes(q) ?? false) ||
          (p.bio?.toLowerCase().includes(q) ?? false) ||
          (p.linkedin_position?.toLowerCase().includes(q) ?? false) ||
          (resolvePersonLocation(p)?.toLowerCase().includes(q) ?? false)
      );
    }

    list.sort((a, b) => {
      if (sortBy === "events") return b.events_attending.length - a.events_attending.length;
      return a.name.localeCompare(b.name);
    });

    return list;
  }, [allPeople, search, filter, sortBy]);

  const [showCount, setShowCount] = useState(50);

  const filterButtons: { key: typeof filter; label: string; count: number }[] = [
    { key: "all", label: "All People", count: allPeople.length },
    { key: "connections", label: "My Connections", count: allPeople.filter((p) => p.is_your_connection).length },
    { key: "super", label: "Super Connectors", count: allPeople.filter((p) => p.events_attending.length >= 3).length },
    { key: "bio", label: "Has Bio", count: allPeople.filter((p) => p.bio).length },
  ];

  return (
    <div className="pt-4">
      <div className="mb-6">
        {/* search */}
        <div className="relative mb-4">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none text-[var(--color-text-muted)]">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.3-4.3"/></svg>
          </div>
          <input
            type="text"
            placeholder="Search by name, company, location, or bio..."
            value={search}
            onChange={(e) => { setSearch(e.target.value); setShowCount(50); }}
            className="w-full pl-11 pr-4 py-3 rounded-xl bg-white/5 text-[var(--color-text-primary)]
              border border-white/10 text-sm
              placeholder:text-[var(--color-text-muted)]
              focus:outline-none focus:border-[var(--color-accent-400)] focus:ring-1 focus:ring-[var(--color-accent-400)]/50
              transition-all"
          />
        </div>

        {/* filters */}
        <div className="flex flex-col sm:flex-row gap-4 justify-between items-start sm:items-center">
          <div className="flex flex-wrap gap-2">
            {filterButtons.map((fb) => (
              <button
                key={fb.key}
                onClick={() => { setFilter(fb.key); setShowCount(50); }}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
                  border ${filter === fb.key
                    ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-400)] border-[var(--color-accent-400)]/30"
                    : "bg-white/5 text-[var(--color-text-secondary)] border-transparent hover:bg-white/10"
                  }`}
              >
                {fb.label} <span className="opacity-60 ml-1">({fb.count})</span>
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-[var(--color-text-muted)] font-mono uppercase tracking-wider">Sort:</span>
            <button
              onClick={() => setSortBy(sortBy === "events" ? "name" : "events")}
              className="text-xs font-medium px-3 py-1.5 rounded-lg text-[var(--color-text-primary)]
                border border-white/10 bg-white/5 hover:bg-white/10 transition-colors"
            >
              {sortBy === "events" ? "By Events" : "Alphabetical"}
            </button>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between mb-4 text-sm font-medium text-[var(--color-text-secondary)]">
        <div>{filtered.length} results</div>
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, showCount).map((p) => (
          <PersonRow
            key={p.api_id}
            person={p}
            locationText={resolvePersonLocation(p)}
            onClick={() => onPersonClick(p.api_id)}
          />
        ))}
      </div>

      {showCount < filtered.length && (
        <button
          onClick={() => setShowCount((c) => c + 50)}
          className="w-full mt-6 py-3 rounded-xl text-sm font-medium
            border border-white/10 text-[var(--color-text-secondary)]
            hover:bg-white/5 hover:text-[var(--color-text-primary)]
            transition-all duration-200"
        >
          Load More ({filtered.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}

function PersonRow({
  person,
  locationText,
  onClick,
}: {
  person: PersonSummary;
  locationText: string | null;
  onClick: () => void;
}) {
  return (
    <div
      onClick={onClick}
      className="flex items-start gap-4 p-3.5 rounded-xl cursor-pointer group
        glass-card-static hover:bg-white/5 hover:border-white/20
        transition-all duration-200"
    >
      <div className="relative mt-0.5">
        {person.avatar_url ? (
          <img src={person.avatar_url} alt="" className="w-10 h-10 rounded-full object-cover" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center text-sm font-medium text-[var(--color-text-muted)]">
            {person.name.charAt(0)}
          </div>
        )}
      </div>
      
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">{person.name}</span>
          {person.is_your_connection && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-connection)] flex-shrink-0" />
          )}
        </div>

        {locationText && (
          <p className="text-[11px] text-[var(--color-text-muted)] mb-1">
            📍 {locationText}
          </p>
        )}
        
        {person.bio ? (
          <p className="text-xs text-[var(--color-text-muted)] truncate mb-1.5">{person.bio}</p>
        ) : person.linkedin_company ? (
          <p className="text-xs text-[var(--color-text-muted)] truncate mb-1.5">
            {person.linkedin_position ? `${person.linkedin_position} · ` : ""}{person.linkedin_company}
          </p>
        ) : null}
        
        <div className="flex items-center gap-2">
          {person.events_attending.length >= 3 ? (
            <SuperConnectorBadge eventCount={person.events_attending.length} />
          ) : (
            <span className="text-[10px] font-medium text-[var(--color-text-secondary)] bg-white/5 px-2 py-0.5 rounded-full border border-white/5">
              {person.events_attending.length} events
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
