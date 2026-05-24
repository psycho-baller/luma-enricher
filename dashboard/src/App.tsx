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
    <div className="app-bg bg-[var(--color-surface-950)]">
      {/* top bar */}
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[var(--color-surface-950)]/90 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-6">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-[var(--color-accent-400)] text-[var(--color-surface-950)] flex items-center justify-center font-bold text-sm">
                EI
              </div>
              <div>
                <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Event Intelligence
                </h1>
                <p className="text-xs text-[var(--color-text-muted)] mt-0.5 font-mono">Toronto Tech Week / 2026</p>
              </div>
            </div>

            <nav className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-1.5 rounded-lg text-sm font-medium transition-all duration-200
                    ${activeTab === tab.key
                      ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-400)]"
                      : "text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-800)]"
                    }`}
                >
                  <span className="mr-2 opacity-70">{tab.icon}</span>
                  {tab.label}
                </button>
              ))}
            </nav>
          </div>
        </div>
      </header>

      {/* main content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        {activeTab === "timeline" && (
          <div className="space-y-8 animate-fade-in">
            <StatsBar stats={data.stats} />
            <div className="grid grid-cols-1 gap-12 mt-8">
              {data.days.map((day) => (
                <DayTimeline
                  key={day.date}
                  day={day}
                  selectedEventId={selectedEventId ?? undefined}
                  onSelectEvent={setSelectedEventId}
                />
              ))}
            </div>
          </div>
        )}

        {activeTab === "people" && (
          <div className="animate-fade-in">
            <PeopleExplorer onPersonClick={setSelectedPersonId} />
          </div>
        )}

        {activeTab === "schedule" && (
          <div className="animate-fade-in">
            <ScheduleView />
          </div>
        )}
      </main>

      {/* overlays */}
      <EventDetailPanel
        event={selectedEvent}
        onClose={() => setSelectedEventId(null)}
        onPersonClick={(id) => {
          setSelectedEventId(null);
          setSelectedPersonId(id);
        }}
      />

      <PersonModal
        person={selectedPerson}
        onClose={() => setSelectedPersonId(null)}
      />
    </div>
  );
}
