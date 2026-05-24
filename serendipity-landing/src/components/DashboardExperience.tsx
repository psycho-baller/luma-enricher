import { useState } from "react";
import { Link } from "react-router-dom";

import { DayTimeline } from "./DayTimeline";
import { EventDetailPanel } from "./EventDetailPanel";
import { PeopleExplorer } from "./PeopleExplorer";
import { PersonModal } from "./PersonModal";
import { ScheduleView } from "./ScheduleView";
import { StatsBar } from "./StatsBar";
import { useEventData } from "../hooks/useEventData";

type Tab = "timeline" | "people" | "schedule";

export function DashboardExperience() {
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
      <div className="border-b border-[var(--color-accent-400)]/20 bg-[var(--color-accent-bg)]/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-6 py-2">
          <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-accent-400)]">
            demo mode — sample names and avatars only
          </p>
          <Link
            to="/"
            className="shrink-0 font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-text-primary)]"
          >
            back to landing
          </Link>
        </div>
      </div>
      <header className="sticky top-0 z-30 border-b border-white/5 bg-[var(--color-surface-950)]/90 backdrop-blur-md">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex h-16 items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--color-accent-400)] text-sm font-bold text-[var(--color-surface-950)]">
                SI
              </div>
              <div>
                <h1 className="text-base font-semibold text-[var(--color-text-primary)]">
                  Serendipity Intelligence
                </h1>
                <p className="mt-0.5 font-mono text-xs text-[var(--color-text-muted)]">
                  Toronto Tech Week / 2026 demo
                </p>
              </div>
            </div>

            <nav className="flex gap-2">
              {tabs.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all duration-200
                    ${activeTab === tab.key
                      ? "bg-[var(--color-accent-bg)] text-[var(--color-accent-400)]"
                      : "text-[var(--color-text-secondary)] hover:bg-[var(--color-surface-800)] hover:text-[var(--color-text-primary)]"
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

      <main className="mx-auto max-w-6xl px-6 py-8">
        {activeTab === "timeline" && (
          <div className="animate-fade-in space-y-8">
            <StatsBar stats={data.stats} />
            <div className="mt-8 grid grid-cols-1 gap-12">
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
