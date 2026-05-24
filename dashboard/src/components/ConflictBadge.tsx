import { useState } from "react";

export function ConflictBadge({ count, conflictingTitles }: { count: number; conflictingTitles: string[] }) {
  const [showTooltip, setShowTooltip] = useState(false);

  if (count === 0) return null;

  return (
    <div className="relative inline-flex">
      <button
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className="flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium
          bg-[var(--color-conflict-bg)] text-[var(--color-conflict)]
          border border-[var(--color-conflict)]/20
          transition-colors hover:bg-[var(--color-conflict)]/20"
      >
        <svg width="12" height="12" viewBox="0 0 16 16" fill="currentColor">
          <path d="M8 1l7 14H1L8 1zm0 4v4m0 2v1" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
        </svg>
        {count} conflict{count > 1 ? "s" : ""}
      </button>

      {showTooltip && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 z-50
          bg-[var(--color-surface-800)] border border-[var(--color-surface-600)]
          rounded-lg p-3 shadow-xl min-w-48 max-w-64
          animate-fade-in"
        >
          <div className="text-xs font-medium text-[var(--color-text-muted)] mb-1.5">
            Overlapping events:
          </div>
          {conflictingTitles.map((t, i) => (
            <div key={i} className="text-sm text-[var(--color-text-secondary)] py-0.5 truncate">
              {t}
            </div>
          ))}
          <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-px
            border-4 border-transparent border-t-[var(--color-surface-600)]" />
        </div>
      )}
    </div>
  );
}
