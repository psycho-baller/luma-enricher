import { useMemo } from "react";
import type { DashboardData, EnrichedEvent, PersonSummary } from "../lib/types";
import rawData from "../data/dashboard.json";

const data = rawData as unknown as DashboardData;

export function useEventData() {
  const allEvents = useMemo(
    () => data.days.flatMap((d) => d.events),
    []
  );

  const allPeople = useMemo(
    () => Object.values(data.people),
    []
  );

  const warmConnections = useMemo(
    () => allPeople.filter((p) => p.is_your_connection),
    [allPeople]
  );

  const superConnectors = useMemo(
    () => allPeople.filter((p) => p.events_attending.length >= 3),
    [allPeople]
  );

  function getEvent(id: string): EnrichedEvent | undefined {
    return allEvents.find((e) => e.id === id);
  }

  function getPerson(apiId: string): PersonSummary | undefined {
    return data.people[apiId];
  }

  function getPersonsForEvent(eventId: string): PersonSummary[] {
    const event = getEvent(eventId);
    if (!event?.guest_list?.guests) return [];
    return event.guest_list.guests
      .map((id) => data.people[id])
      .filter(Boolean) as PersonSummary[];
  }

  return {
    data,
    allEvents,
    allPeople,
    warmConnections,
    superConnectors,
    getEvent,
    getPerson,
    getPersonsForEvent,
  };
}
