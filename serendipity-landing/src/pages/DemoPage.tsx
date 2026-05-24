import { lazy, Suspense, useEffect, useState } from "react";
import { Link } from "react-router-dom";

import { EventDataProvider } from "../context/EventDataContext";
import type { DashboardData } from "../lib/types";

const DashboardExperience = lazy(() =>
  import("../components/DashboardExperience").then((module) => ({
    default: module.DashboardExperience,
  }))
);

function DemoLoading() {
  return (
    <div className="app-bg flex min-h-screen items-center justify-center bg-[var(--color-surface-950)]">
      <p className="font-mono text-sm uppercase tracking-[0.18em] text-[var(--color-text-muted)]">
        loading demo data…
      </p>
    </div>
  );
}

export function DemoPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    import("../data/dashboard.demo.json")
      .then((module) => {
        if (!cancelled) {
          setData(module.default as DashboardData);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Demo data failed to load.");
        }
      });

    return () => {
      cancelled = true;
    };
  }, []);

  if (error) {
    return (
      <div className="app-bg flex min-h-screen flex-col items-center justify-center gap-4 bg-[var(--color-surface-950)] px-6">
        <p className="text-[var(--color-text-secondary)]">{error}</p>
        <Link
          to="/"
          className="rounded-xl border border-[var(--color-surface-700)] px-5 py-3 text-sm font-medium uppercase tracking-[0.12em] text-[var(--color-text-primary)]"
        >
          back to landing
        </Link>
      </div>
    );
  }

  if (!data) {
    return <DemoLoading />;
  }

  return (
    <EventDataProvider data={data}>
      <Suspense fallback={<DemoLoading />}>
        <DashboardExperience />
      </Suspense>
    </EventDataProvider>
  );
}
