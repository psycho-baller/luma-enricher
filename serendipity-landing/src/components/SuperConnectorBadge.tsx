export function SuperConnectorBadge({ eventCount }: { eventCount: number }) {
  if (eventCount < 3) return null;
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
      bg-[var(--color-super-connector-bg)] text-[var(--color-super-connector)]
      border border-[var(--color-super-connector)]/20">
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor">
        <path d="M8 2l2 4 4.5.7-3.3 3.1.8 4.5L8 12.2 3.9 14.3l.8-4.5L1.5 6.7 6 6z" />
      </svg>
      {eventCount} events
    </span>
  );
}
