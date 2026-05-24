import { useMemo, useState } from "react";

import { DashboardExperience } from "./components/DashboardExperience";
import { InlineWaitlistForm } from "./components/InlineWaitlistForm";
import { useEventData } from "./hooks/useEventData";

export default function App() {
  const { data } = useEventData();
  const [showDashboard, setShowDashboard] = useState(false);

  const momentumStats = useMemo(() => {
    const events = data.days.flatMap((day) => day.events);
    const highSerendipity = events.filter((event) => event.serendipity.score >= 70).length;
    const warmIntros = events.reduce((sum, event) => sum + event.serendipity.warm_connections.length, 0);
    const averageScore = Math.round(
      events.reduce((sum, event) => sum + event.serendipity.score, 0) / Math.max(events.length, 1)
    );

    return {
      eventsWithSignal: highSerendipity,
      warmIntroMoments: warmIntros,
      averageScore,
    };
  }, [data.days]);

  if (showDashboard) {
    return <DashboardExperience />;
  }

  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--color-accent-400)] text-[var(--color-surface-950)]">
              <span className="font-semibold tracking-tight">S</span>
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Serendipity</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                Toronto Tech Week Intelligence
              </p>
            </div>
          </div>
          <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] md:block">
            private alpha
          </p>
        </div>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-glow" aria-hidden />
          <div className="mx-auto w-full max-w-5xl px-6 pb-22 pt-28 text-center md:pt-36">
            <div className="mx-auto flex max-w-4xl flex-col items-center gap-8">
              <p className="inline-flex rounded-full border border-[var(--color-surface-700)] bg-black/25 px-4 py-2 font-mono text-xs uppercase tracking-[0.2em] text-[var(--color-accent-400)]">
                project serendipity
              </p>
              <h1 className="max-w-4xl text-5xl leading-[0.9] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] md:text-7xl">
                Make every Toronto Tech Week room feel pre-won.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[var(--color-text-secondary)]">
                Serendipity ranks events by relationship upside, surfaces your warmest intro paths, and tells you
                where your time compounds.
              </p>
              <InlineWaitlistForm
                align="center"
                className="w-full max-w-[36rem]"
                caption="Join the private alpha and test Serendipity before launch."
              />
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <button
                  onClick={() => setShowDashboard(true)}
                  className="w-full rounded-xl bg-[var(--color-accent-400)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-surface-950)] transition-colors hover:bg-[var(--color-accent-500)] sm:w-auto"
                >
                  open interactive dashboard
                </button>
                <a
                  href="#live-numbers"
                  className="w-full rounded-xl border border-[var(--color-surface-700)] px-5 py-3 text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-400)] sm:w-auto"
                >
                  see live numbers
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="live-numbers" className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="mb-6">
            <p className="value-kicker">live numbers from your current dataset</p>
          </div>
          <div className="grid gap-4 md:grid-cols-4">
            <article className="stat-card">
              <p className="text-sm text-[var(--color-text-muted)]">events mapped</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{data.stats.total_events}</p>
            </article>
            <article className="stat-card">
              <p className="text-sm text-[var(--color-text-muted)]">unique guests</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">
                {data.stats.total_unique_guests.toLocaleString()}
              </p>
            </article>
            <article className="stat-card">
              <p className="text-sm text-[var(--color-text-muted)]">avg serendipity score</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{momentumStats.averageScore}</p>
            </article>
            <article className="stat-card">
              <p className="text-sm text-[var(--color-text-muted)]">warm intro paths</p>
              <p className="mt-2 text-3xl font-semibold text-[var(--color-text-primary)]">{momentumStats.warmIntroMoments}</p>
            </article>
          </div>
          <div className="mt-6 grid gap-4 md:grid-cols-3">
            <article className="value-card">
              <p className="value-kicker">signal-first scoring</p>
              <h3>Know what is worth your evening.</h3>
              <p>Every event is ranked by relationship upside and intro quality.</p>
            </article>
            <article className="value-card">
              <p className="value-kicker">relationship context</p>
              <h3>Walk in with context.</h3>
              <p>See people, role context, and recency so outreach is intentional.</p>
            </article>
            <article className="value-card">
              <p className="value-kicker">schedule control</p>
              <h3>Protect your highest-leverage slots.</h3>
              <p>Avoid overlap traps and choose the room with the biggest upside.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
