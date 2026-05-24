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

  // group events by conflict_group for side-by-side rendering
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
    <div className="mb-8">
      <div className="sticky top-[64px] z-20 py-3 bg-[var(--color-surface-950)]/95 backdrop-blur-sm">
        <h2 className="text-lg font-bold text-[var(--color-text-primary)]">
          {day.label}
        </h2>
        <div className="text-xs text-[var(--color-text-muted)]">
          {day.events.length} events
        </div>
      </div>

      <div className="space-y-3 stagger-children">
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

          // conflict group: render side-by-side
          return (
            <div
              key={`group-${gi}`}
              className="rounded-xl border border-dashed border-[var(--color-conflict)]/30 p-2
                bg-[var(--color-conflict-bg)]/30"
            >
              <div className="text-xs text-[var(--color-conflict)] font-medium mb-2 px-1">
                ⚡ {group.events.length} overlapping events — pick one
              </div>
              <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(group.events.length, 2)}, 1fr)` }}>
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
