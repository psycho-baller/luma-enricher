import { useState, useMemo } from "react";
import { useEventData } from "../hooks/useEventData";
import { SuperConnectorBadge } from "./SuperConnectorBadge";
import type { PersonSummary } from "../lib/types";

export function PeopleExplorer({
  onPersonClick,
}: {
  onPersonClick: (apiId: string) => void;
}) {
  const { allPeople } = useEventData();
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<"all" | "connections" | "super" | "bio">("all");
  const [sortBy, setSortBy] = useState<"events" | "name">("events");

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
          (p.linkedin_position?.toLowerCase().includes(q) ?? false)
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
    { key: "all", label: "All", count: allPeople.length },
    { key: "connections", label: "My Connections", count: allPeople.filter((p) => p.is_your_connection).length },
    { key: "super", label: "Super Connectors", count: allPeople.filter((p) => p.events_attending.length >= 3).length },
    { key: "bio", label: "Has Bio", count: allPeople.filter((p) => p.bio).length },
  ];

  return (
    <div>
      {/* search */}
      <div className="mb-4">
        <input
          type="text"
          placeholder="Search by name, company, bio..."
          value={search}
          onChange={(e) => { setSearch(e.target.value); setShowCount(50); }}
          className="w-full px-4 py-2.5 rounded-xl text-sm
            bg-[var(--color-surface-800)] text-[var(--color-text-primary)]
            border border-[var(--color-surface-700)]
            placeholder:text-[var(--color-text-muted)]
            focus:outline-none focus:border-[var(--color-accent-400)]/50
            transition-colors"
        />
      </div>

      {/* filters */}
      <div className="flex gap-2 mb-3 flex-wrap">
        {filterButtons.map((fb) => (
          <button
            key={fb.key}
            onClick={() => { setFilter(fb.key); setShowCount(50); }}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all
              ${filter === fb.key
                ? "bg-[var(--color-accent-400)]/20 text-[var(--color-accent-400)] border border-[var(--color-accent-400)]/30"
                : "bg-[var(--color-surface-800)] text-[var(--color-text-secondary)] border border-[var(--color-surface-700)] hover:border-[var(--color-surface-600)]"
              }`}
          >
            {fb.label} ({fb.count})
          </button>
        ))}

        <div className="ml-auto flex items-center gap-1">
          <span className="text-xs text-[var(--color-text-muted)]">Sort:</span>
          <button
            onClick={() => setSortBy(sortBy === "events" ? "name" : "events")}
            className="px-2 py-1 rounded text-xs text-[var(--color-text-secondary)]
              bg-[var(--color-surface-800)] border border-[var(--color-surface-700)]
              hover:border-[var(--color-surface-600)] transition-colors"
          >
            {sortBy === "events" ? "By Events" : "By Name"}
          </button>
        </div>
      </div>

      <div className="text-xs text-[var(--color-text-muted)] mb-3">
        {filtered.length} people
      </div>

      {/* grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        {filtered.slice(0, showCount).map((p) => (
          <PersonRow key={p.api_id} person={p} onClick={() => onPersonClick(p.api_id)} />
        ))}
      </div>

      {showCount < filtered.length && (
        <button
          onClick={() => setShowCount((c) => c + 50)}
          className="w-full mt-3 py-2 rounded-lg text-sm
            bg-[var(--color-surface-800)] text-[var(--color-text-secondary)]
            border border-[var(--color-surface-700)]
            hover:bg-[var(--color-surface-700)] transition-colors"
        >
          Show more ({filtered.length - showCount} remaining)
        </button>
      )}
    </div>
  );
}

function PersonRow({ person, onClick }: { person: PersonSummary; onClick: () => void }) {
  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer
        bg-[var(--color-surface-800)]/50 border border-[var(--color-surface-700)]/40
        hover:bg-[var(--color-surface-700)]/50 hover:border-[var(--color-surface-600)]
        transition-all duration-200"
    >
      {person.avatar_url ? (
        <img src={person.avatar_url} alt="" className="w-9 h-9 rounded-full object-cover flex-shrink-0" />
      ) : (
        <div className="w-9 h-9 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center flex-shrink-0 text-sm text-[var(--color-text-muted)]">
          {person.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-[var(--color-text-primary)] truncate">{person.name}</span>
          {person.is_your_connection && (
            <span className="w-2 h-2 rounded-full bg-[var(--color-connection)] flex-shrink-0" />
          )}
        </div>
        {person.bio ? (
          <p className="text-xs text-[var(--color-text-muted)] truncate">{person.bio}</p>
        ) : person.linkedin_company ? (
          <p className="text-xs text-[var(--color-text-muted)] truncate">
            {person.linkedin_position ? `${person.linkedin_position} @ ` : ""}{person.linkedin_company}
          </p>
        ) : null}
      </div>
      <div className="flex items-center gap-1.5 flex-shrink-0">
        <SuperConnectorBadge eventCount={person.events_attending.length} />
        {person.events_attending.length < 3 && (
          <span className="text-xs text-[var(--color-text-muted)]">
            {person.events_attending.length}e
          </span>
        )}
      </div>
    </div>
  );
}
