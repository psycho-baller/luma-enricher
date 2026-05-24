import type { PersonSummary } from "../lib/types";
import { SuperConnectorBadge } from "./SuperConnectorBadge";

function relativeDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function ConnectionCard({
  person,
  onClick,
}: {
  person: PersonSummary;
  onClick?: () => void;
}) {
  const lastMsg = relativeDate(person.last_messaged);

  return (
    <div
      onClick={onClick}
      className="flex items-center gap-3 p-3 rounded-lg cursor-pointer
        bg-[var(--color-surface-800)]/60 border border-[var(--color-surface-700)]/50
        border-l-2 border-l-[var(--color-connection)]
        transition-all duration-200 hover:bg-[var(--color-surface-700)]/60 hover:border-[var(--color-surface-600)]"
    >
      {person.avatar_url ? (
        <img
          src={person.avatar_url}
          alt={person.name}
          className="w-10 h-10 rounded-full object-cover flex-shrink-0 border border-[var(--color-surface-600)]"
        />
      ) : (
        <div className="w-10 h-10 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center flex-shrink-0 text-sm font-semibold text-[var(--color-text-muted)]">
          {person.name.charAt(0)}
        </div>
      )}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-[var(--color-text-primary)] truncate">
            {person.name}
          </span>
          <SuperConnectorBadge eventCount={person.events_attending.length} />
        </div>
        {(person.linkedin_company || person.linkedin_position) && (
          <div className="text-xs text-[var(--color-text-secondary)] truncate">
            {person.linkedin_position}{person.linkedin_position && person.linkedin_company ? " @ " : ""}{person.linkedin_company}
          </div>
        )}
        <div className="flex items-center gap-2 mt-0.5">
          {lastMsg && (
            <span className="text-xs text-[var(--color-text-muted)]">
              Messaged {lastMsg}
            </span>
          )}
        </div>
      </div>
      {person.linkedin_url && (
        <a
          href={person.linkedin_url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="flex-shrink-0 p-1.5 rounded-md text-[var(--color-text-muted)]
            hover:text-[var(--color-connection)] hover:bg-[var(--color-connection-bg)]
            transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        </a>
      )}
    </div>
  );
}
