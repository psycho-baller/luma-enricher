import { Link } from "react-router-dom";

import { InlineWaitlistForm } from "../components/InlineWaitlistForm";
import { StatsBar } from "../components/StatsBar";
import logo from "../assets/just-serendipity-logo.svg";
import landingStats from "../data/landing-stats.json";
import type { GlobalStats } from "../lib/types";

const demoStats = landingStats as GlobalStats;
const REPO_URL = "https://github.com/psycho-baller/luma-enricher";

export function LandingPage() {
  return (
    <div className="landing-shell">
      <header className="landing-header">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between px-6 py-4">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Serendipity logo" className="h-9 w-9 rounded-xl object-cover" />
            <div>
              <p className="text-sm font-semibold text-[var(--color-text-primary)]">Serendipity</p>
              <p className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
                for Toronto Tech Week
              </p>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <p className="hidden font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-muted)] md:block">
              private alpha
            </p>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--color-text-secondary)] transition-colors hover:text-[var(--color-accent-400)]"
              aria-label="luma-enricher on GitHub"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-3.795-.735-.525-1.335-1.275-1.695-1.275-1.695-1.05-.72.075-.705.075-.705 1.155.075 1.77 1.185 1.77 1.185 1.035 1.77 2.715 1.26 3.375.96.105-.75.405-1.26.735-1.545-2.55-.285-5.235-1.275-5.235-5.685 0-1.26.45-2.28 1.185-3.09-.12-.285-.525-1.44.12-2.985 0 0 .975-.315 3.195 1.17 1.005-.27 2.085-.405 3.15-.405 1.065 0 2.145.135 3.15.405 2.22-1.5 3.195-1.17 3.195-1.17.645 1.545.24 2.7.12 2.985.735.81 1.185 1.83 1.185 3.09 0 4.425-2.7 5.385-5.25 5.655.405.345.765 1.02.765 2.07 0 1.5-.015 2.7-.015 3.075 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
              </svg>
              GitHub
            </a>
          </div>
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
              <h1 className="mx-auto flex max-w-4xl flex-col gap-4 text-5xl leading-[0.95] font-semibold tracking-[-0.045em] text-[var(--color-text-primary)] md:gap-5 md:text-7xl">
                <span>Engineering serendipity.</span>
                <span className="text-3xl font-medium leading-[1.05] tracking-[-0.03em] text-[var(--color-text-secondary)] md:text-4xl">
                  Pick the events worth showing up to.
                </span>
              </h1>
              <p className="max-w-3xl text-lg leading-8 text-[var(--color-text-secondary)]">
                Powered by your LinkedIn export. Serendipity matches event guest lists to your connections and
                messages, then ranks what's worth your time.
              </p>
              <InlineWaitlistForm
                align="center"
                className="w-full max-w-[36rem]"
                caption="Want early access? Leave your email. If 10 people sign up, I'll open it to the public."
              />
              <div className="flex flex-col items-center gap-3 sm:flex-row">
                <Link
                  to="/demo"
                  className="w-full rounded-xl bg-[var(--color-accent-400)] px-5 py-3 text-center text-sm font-semibold uppercase tracking-[0.12em] text-[var(--color-surface-950)] transition-colors hover:bg-[var(--color-accent-500)] sm:w-auto"
                >
                  try the demo
                </Link>
                <a
                  href={REPO_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="w-full rounded-xl border border-[var(--color-surface-700)] px-5 py-3 text-center text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-text-primary)] transition-colors hover:border-[var(--color-accent-400)] hover:text-[var(--color-accent-400)] sm:w-auto"
                >
                  self-host
                </a>
              </div>
            </div>
          </div>
        </section>

        <section id="live-numbers" className="mx-auto w-full max-w-6xl px-6 pb-20">
          <div className="mb-6">
            <p className="value-kicker">from the demo data</p>
          </div>
          <StatsBar stats={demoStats} />
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
