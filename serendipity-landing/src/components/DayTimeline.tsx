import type { DaySchedule } from "../lib/types";
import { useSchedule } from "../hooks/useSchedule";
import { EventCard } from "./EventCard";

export function DayTimeline({
  day,
  selectedEventId,
  onSelectEvent,
}: {
  day: DaySchedule;
  selectedEventId?: string;
  onSelectEvent: (id: string) => void;
}) {
  const { isPicked, pick } = useSchedule();

  const groups: { groupId: number | null; events: typeof day.events }[] = [];
  const usedIds = new Set<string>();

  for (const event of day.events) {
    if (usedIds.has(event.id)) continue;

    if (event.conflict_group !== null) {
      const groupEvents = day.events.filter(
        (e) => e.conflict_group === event.conflict_group && !usedIds.has(e.id)
      );
      for (const ge of groupEvents) usedIds.add(ge.id);
      groups.push({ groupId: event.conflict_group, events: groupEvents });
    } else {
      usedIds.add(event.id);
      groups.push({ groupId: null, events: [event] });
    }
  }

  return (
    <div className="relative pl-6">
      <div className="absolute left-0 top-12 bottom-0 w-px bg-white/10" />

      <div className="sticky top-[64px] z-20 py-4 bg-[var(--color-surface-950)]/90 backdrop-blur-md mb-4 -ml-6 pl-6">
        <div className="absolute left-[-2px] top-1/2 -translate-y-1/2 w-1 h-4 bg-[var(--color-accent-400)] rounded-r" />
        <h2 className="text-xl font-semibold text-[var(--color-text-primary)]">
          {day.label}
        </h2>
        <div className="text-xs text-[var(--color-text-muted)] font-mono mt-0.5">
          {day.events.length} events
        </div>
      </div>

      <div className="space-y-4 stagger-children">
        {groups.map((group, gi) => {
          if (group.events.length === 1) {
            const event = group.events[0];
            return (
              <EventCard
                key={event.id}
                event={event}
                isPicked={isPicked(event.id)}
                onPick={() => pick(event.id, event.conflicts)}
                onSelect={() => onSelectEvent(event.id)}
              />
            );
          }

          return (
            <div
              key={`group-${gi}`}
              className="rounded-xl border border-[var(--color-conflict)]/30 p-3
                bg-[var(--color-conflict-bg)]/20"
            >
              <div className="text-xs font-medium text-[var(--color-conflict)] mb-3 px-1 flex items-center gap-1.5">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                {group.events.length} overlapping events — pick one
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {group.events.map((event) => (
                  <EventCard
                    key={event.id}
                    event={event}
                    isPicked={isPicked(event.id)}
                    onPick={() => pick(event.id, event.conflicts)}
                    onSelect={() => onSelectEvent(event.id)}
                  />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
