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
  if (days < 30) return `${days} days ago`;
  if (days < 365) return `${Math.floor(days / 30)} months ago`;
  return `${Math.floor(days / 365)} years ago`;
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

  const resolvedLocation = (() => {
    if (person.location) return person.location;

    const cityCounts = new Map<string, number>();
    for (const event of events) {
      const city = event?.location?.city?.trim();
      if (!city) continue;
      cityCounts.set(city, (cityCounts.get(city) ?? 0) + 1);
    }

    const topCity = [...cityCounts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
    return topCity ? `${topCity} (event city)` : null;
  })();

  const socials = [
    person.linkedin_url && { label: "LinkedIn", url: person.linkedin_url, icon: "🔗" },
    person.twitter && { label: "Twitter", url: `https://twitter.com/${person.twitter}`, icon: "𝕏" },
    person.instagram && { label: "Instagram", url: `https://instagram.com/${person.instagram}`, icon: "📸" },
    person.website && { label: "Website", url: person.website.startsWith("http") ? person.website : `https://${person.website}`, icon: "🌐" },
  ].filter(Boolean) as { label: string; url: string; icon: string }[];

  return (
    <>
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-backdrop-in"
        onClick={onClose}
      />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 pointer-events-none">
        <div
          className="bg-[var(--color-surface-900)] border border-white/10 rounded-2xl w-full max-w-xl max-h-[90vh] overflow-y-auto shadow-2xl pointer-events-auto
            animate-slide-in relative"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="p-6 sm:p-8">
            {/* close button */}
            <div className="absolute top-4 right-4">
              <button onClick={onClose} className="p-2 rounded-lg text-[var(--color-text-muted)] hover:text-[var(--color-text-primary)] hover:bg-[var(--color-surface-800)] transition-colors">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M18 6L6 18M6 6l12 12" /></svg>
              </button>
            </div>

            {/* avatar and name */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5 mb-8 text-center sm:text-left">
              {person.avatar_url ? (
                <img
                  src={person.avatar_url}
                  alt={person.name}
                  className="w-24 h-24 rounded-full object-cover shadow-lg border-2 border-white/10"
                />
              ) : (
                <div className="w-24 h-24 rounded-full bg-[var(--color-surface-800)] flex items-center justify-center text-4xl font-semibold text-[var(--color-text-muted)] border-2 border-white/10">
                  {person.name.charAt(0)}
                </div>
              )}
              
              <div className="flex-1 min-w-0 mt-2 sm:mt-0">
                <h2 className="text-2xl font-bold text-[var(--color-text-primary)] mb-1">{person.name}</h2>
                {(person.linkedin_company || person.linkedin_position) && (
                  <p className="text-sm font-medium text-[var(--color-text-secondary)]">
                    {person.linkedin_position}{person.linkedin_position && person.linkedin_company ? " at " : ""}<span className="text-[var(--color-text-primary)]">{person.linkedin_company}</span>
                  </p>
                )}
                {resolvedLocation && (
                  <p className="text-sm text-[var(--color-text-muted)] mt-1">
                    📍 {resolvedLocation}
                  </p>
                )}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 mt-3">
                  {person.is_your_connection && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-connection)] bg-[var(--color-connection-bg)] px-2.5 py-1 rounded-full border border-[var(--color-connection)]/20">
                      🤝 Connection
                    </span>
                  )}
                  {person.events_attending.length >= 3 && (
                    <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[var(--color-super-connector)] bg-[var(--color-super-connector-bg)] px-2.5 py-1 rounded-full border border-[var(--color-super-connector)]/20">
                      🌟 Super Connector
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* bio */}
            {person.bio && (
              <div className="mb-8 p-4 rounded-xl bg-[var(--color-surface-800)] border border-white/5">
                <p className="text-sm text-[var(--color-text-secondary)] leading-relaxed">
                  {person.bio}
                </p>
              </div>
            )}

            {/* comms / social */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 mb-8">
              {person.last_messaged && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 font-mono">Communication</h3>
                  <div className="text-sm text-[var(--color-text-primary)] flex items-center gap-2">
                    <span className="text-[var(--color-connection)]">✉️</span> Messaged {relativeDate(person.last_messaged)}
                  </div>
                </div>
              )}
              
              {socials.length > 0 && (
                <div>
                  <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 font-mono">Links</h3>
                  <div className="flex flex-wrap gap-2">
                    {socials.map((s) => (
                      <a
                        key={s.label}
                        href={s.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-3 py-1.5 text-xs font-medium text-[var(--color-text-secondary)]
                          border border-white/10 rounded-lg bg-[var(--color-surface-800)]
                          hover:bg-[var(--color-surface-700)] hover:text-[var(--color-text-primary)]
                          transition-all duration-200 flex items-center gap-1.5"
                      >
                        <span>{s.icon}</span> {s.label}
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* events attending */}
            {events.length > 0 && (
              <div>
                <h3 className="text-xs font-semibold text-[var(--color-text-muted)] uppercase tracking-wider mb-3 font-mono">
                  Attending Events ({events.length})
                </h3>
                <div className="space-y-2">
                  {events.map((ev) => (
                    <div key={ev!.id} className="flex items-center gap-4 p-3 rounded-xl border border-white/5 bg-white/5 hover:bg-white/10 transition-colors">
                      <div className="flex flex-col items-center justify-center w-10 h-10 rounded-lg bg-[var(--color-surface-800)] border border-white/10">
                        <span className="text-sm font-bold text-[var(--color-accent-400)]">
                          {Math.round(ev!.serendipity.score)}
                        </span>
                      </div>
                      <span className="text-sm font-medium text-[var(--color-text-primary)] truncate flex-1">{ev!.title}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </>
  );
}
