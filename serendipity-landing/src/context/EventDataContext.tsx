import { createContext, useContext, useMemo, type ReactNode } from "react";

import type { DashboardData, EnrichedEvent, PersonSummary } from "../lib/types";

interface EventDataContextValue {
  data: DashboardData;
  allEvents: EnrichedEvent[];
  allPeople: PersonSummary[];
  warmConnections: PersonSummary[];
  superConnectors: PersonSummary[];
  getEvent: (id: string) => EnrichedEvent | undefined;
  getPerson: (apiId: string) => PersonSummary | undefined;
  getPersonsForEvent: (eventId: string) => PersonSummary[];
}

const EventDataContext = createContext<EventDataContextValue | null>(null);

export function EventDataProvider({
  data,
  children,
}: {
  data: DashboardData;
  children: ReactNode;
}) {
  const value = useMemo(() => {
    const allEvents = data.days.flatMap((d) => d.events);
    const allPeople = Object.values(data.people);
    const warmConnections = allPeople.filter((p) => p.is_your_connection);
    const superConnectors = allPeople.filter((p) => p.events_attending.length >= 3);

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
  }, [data]);

  return <EventDataContext.Provider value={value}>{children}</EventDataContext.Provider>;
}

export function useEventData(): EventDataContextValue {
  const context = useContext(EventDataContext);
  if (!context) {
    throw new Error("useEventData must be used within EventDataProvider (e.g. on /demo).");
  }
  return context;
}
