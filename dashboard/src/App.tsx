import { useState } from "react";
import { useEventData } from "./hooks/useEventData";
import { StatsBar } from "./components/StatsBar";
import { DayTimeline } from "./components/DayTimeline";
import { EventDetailPanel } from "./components/EventDetailPanel";
import { PersonModal } from "./components/PersonModal";
import { PeopleExplorer } from "./components/PeopleExplorer";
import { ScheduleView } from "./components/ScheduleView";

type Tab = "timeline" | "people" | "schedule";

export default function App() {
  const { data, getEvent, getPerson } = useEventData();
  const [activeTab, setActiveTab] = useState<Tab>("timeline");
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [selectedPersonId, setSelectedPersonId] = useState<string | null>(null);

  const selectedEvent = selectedEventId ? getEvent(selectedEventId) ?? null : null;
  const selectedPerson = selectedPersonId ? getPerson(selectedPersonId) ?? null : null;

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "timeline", label: "Timeline", icon: "📅" },
    { key: "people", label: "People", icon: "👥" },
    { key: "schedule", label: "My Schedule", icon: "✓" },
  ];

  return (
    <div className="min-h-screen bg-[var(--color-surface-950)]">
      {/* top bar */}
      <header className="sticky top-0 z-30 bg-[var(--color-surface-950)]/95 backdrop-blur-md
        border-b border-[var(--color-surface-700)]/50">
        <div className="max-w-6xl mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-[var(--color-accent-400)] to-[var(--color-accent-600)]
                flex items-center justify-center text-sm font-bold text-[var(--color-surface-950)]">
                EI
              </div>
              <div>
                <h1 className="text-sm font-bold text-[var(--color-text-primary)] leading-tight">
                  Event Intelligence
                </h1>
                <p className="text-xs text-[var(--color-text-muted)]">Toronto Tech Week 2026</p>
              </div>
            </div>

            <nav className="flex gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-2 rounded-lg text-sm font-medium transition-all
                    ${activeTab === tab.key
                      ? "bg-[var(--color-accent-400)]/15 text-[var(--color-accent-400)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-800)]"
                    }`}
                >
                  <span className="mr-1.5">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* stats bar */}
      <div className="max-w-6xl mx-auto px-4 py-4">
        <StatsBar stats={data.stats} />
      </div>

      {/* main content */}
      <main className="max-w-6xl mx-auto px-4 pb-12">
        {activeTab === "timeline" && (
          <div>
            {data.days.map((day) => (
              <DayTimeline
                key={day.date}
                day={day}
                selectedEventId={selectedEventId ?? undefined}
                onSelectEvent={setSelectedEventId}
              />
            ))}
          </div>
        )}

        {activeTab === "people" && (
          <PeopleExplorer onPersonClick={setSelectedPersonId} />
        )}

        {activeTab === "schedule" && (
          <ScheduleView />
        )}
      </main>

      {/* event detail panel */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEventId(null)}
        onPersonClick={(id) => {
          setSelectedEventId(null);
          setSelectedPersonId(id);
        }}
      />

      {/* person modal */}
      <PersonModal
        person={selectedPerson}
        onClose={() => setSelectedPersonId(null)}
      />
    </div>
  );
}
