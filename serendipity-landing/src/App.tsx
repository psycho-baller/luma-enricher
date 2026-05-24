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
                for Toronto Tech Week
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
                toronto tech week
              </p>
              <h1 className="max-w-4xl text-5xl leading-[0.9] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] md:text-7xl">
                Stop guessing which events are worth your night.
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[var(--color-text-secondary)]">
                Serendipity looks at who's going, who you already know, and who could introduce you — then ranks
                events so you're not picking blindly.
              </p>
              <InlineWaitlistForm
                align="center"
                className="w-full max-w-[36rem]"
                caption="Want early access? Leave your email."
              />
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <button
                  onClick={() => setShowDashboard(true)}
                  className="w-full rounded-xl bg-[var(--color-accent-400)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-surface-950)] transition-colors hover:bg-[var(--color-accent-500)] sm:w-auto"
                >
                  try the demo
                </button>
                <a
                  href="#live-numbers"
                  className="w-full rounded-xl border border-[var(--color-surface-700)] px-5 py-3 text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-400)] sm:w-auto"
                >
                  see sample stats
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="live-numbers" className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="mb-6">
            <p className="value-kicker">from the demo data</p>
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
              <p className="value-kicker">event rankings</p>
              <h3>Pick the right room.</h3>
              <p>Each event gets a score based on who's there and who you could meet through someone you know.</p>
            </article>
            <article className="value-card">
              <p className="value-kicker">who's going</p>
              <h3>Show up knowing names.</h3>
              <p>See attendees, what they do, and whether you've messaged before.</p>
            </article>
            <article className="value-card">
              <p className="value-kicker">your calendar</p>
              <h3>Don't double-book the good ones.</h3>
              <p>Spot conflicts when two events overlap and decide which one to keep.</p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}
