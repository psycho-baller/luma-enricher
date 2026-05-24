import type { PersonSummary } from "../lib/types";
import { useEventData } from "../hooks/useEventData";
import { SuperConnectorBadge } from "./SuperConnectorBadge";

function relativeDate(isoDate: string | null): string | null {
  if (!isoDate) return null;
  const date = new Date(isoDate);
  const now = new Date();
  const days = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (days < 1) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  if (days < 365) return `${Math.floor(days / 30)}mo ago`;
  return `${Math.floor(days / 365)}y ago`;
}

export function PersonModal({
  person,
  onClose,
}: {
  person: PersonSummary | null;
  onClose: () => void;
}) {
  const { getEvent } = useEventData();
  if (!person) return null;

  const events = person.events_attending
    .map((id) => getEvent(id))
    .filter(Boolean);

  const socials = [
    person.linkedin_url && { label: "LinkedIn", url: person.linkedin_url, icon: "in" },
    person.twitter && { label: "Twitter", url: `https://twitter.com/${person.twitter}`, icon: "X" },
    person.instagram && { label: "Instagram", url: `https://instagram.com/${person.instagram}`, icon: "IG" },
    person.website && { label: "Website", url: person.website.startsWith("http") ? person.website : `https://${person.website}`, icon: "🌐" },
  ].filter(Boolean) as { label: string; url: string; icon: string }[];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/70 backdrop-blur-sm z-50"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="bg-[var(--color-surface-900)] border border-[var(--color-surface-700)]
            rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl
            animate-fade-in"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6">
            {/* avatar and name */}
            <div className="flex items-center gap-4 mb-4">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.name}
                  className="w-16 h-16 rounded-full object-cover border-2 border-[var(--color-surface-600)]"
                />
              ) : (
                <div className="w-16 h-16 rounded-full bg-[var(--color-surface-700)] flex items-center justify-center text-xl font-bold text-[var(--color-text-muted)]">
                  {person.name.charAt(0)}
                </div>
              )}
              <div>
                <h2 className="text-lg font-bold text-[var(--color-text-primary)]">{person.name}</h2>
                {(person.linkedin_company || person.linkedin_position) && (
                  <p className="text-sm text-[var(--color-text-secondary)]">
                    {person.linkedin_position}{person.linkedin_position && person.linkedin_company ? " @ " : ""}{person.linkedin_company}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-1">
                  {person.is_your_connection && (
                    <span className="px-2 py-0.5 rounded text-xs font-medium
                      bg-[var(--color-connection-bg)] text-[var(--color-connection)]
                      border border-[var(--color-connection)]/20">
                      Your Connection
                    </span>
                  )}
                  <SuperConnectorBadge eventCount={person.events_attending.length} />
                </div>
              </div>
            </div>

            {/* bio */}
            {person.bio && (
              <p className="text-sm text-[var(--color-text-secondary)] mb-4 leading-relaxed">
                {person.bio}
              </p>
            )}

            {/* last messaged */}
            {person.last_messaged && (
              <div className="text-xs text-[var(--color-text-muted)] mb-4">
                Last messaged on LinkedIn: {relativeDate(person.last_messaged)}
              </div>
            )}

            {/* social links */}
            {socials.length > 0 && (
              <div className="flex gap-2 mb-5">
                {socials.map((s) => (
                  <a
                    key={s.label}
                    href={s.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-3 py-1.5 rounded-lg text-xs font-medium
                      bg-[var(--color-surface-800)] text-[var(--color-text-secondary)]
                      border border-[var(--color-surface-700)]
                      hover:border-[var(--color-accent-400)]/40 hover:text-[var(--color-accent-400)]
                      transition-colors"
                  >
                    {s.icon} {s.label}
                  </a>
                ))}
              </div>
            )}

            {/* events attending */}
            {events.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-2">
                  Attending {events.length} of your events
                </h3>
                <div className="space-y-1.5">
                  {events.map((ev) => (
                    <div key={ev!.id} className="flex items-center gap-2 p-2 rounded-lg
                      bg-[var(--color-surface-800)]/60">
                      <span className="text-xs font-mono font-bold text-[var(--color-text-muted)] w-6">
                        {Math.round(ev!.serendipity.score)}
                      </span>
                      <span className="text-sm text-[var(--color-text-primary)] truncate">{ev!.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="border-t border-[var(--color-surface-700)] p-4">
            <button
              onClick={onClose}
              className="w-full py-2 rounded-lg text-sm font-medium
                bg-[var(--color-surface-800)] text-[var(--color-text-secondary)]
                border border-[var(--color-surface-700)]
                hover:bg-[var(--color-surface-700)] transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
