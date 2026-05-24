// -- dashboard data shape --
// produced by build-dashboard-data.ts, consumed by the react app

export interface DashboardData {
  generated_at: string;
  user: { name: string; api_id: string };
  days: DaySchedule[];
  people: Record<string, PersonSummary>;
  stats: GlobalStats;
}

export interface GlobalStats {
  total_events: number;
  total_days: number;
  total_unique_guests: number;
  total_warm_connections: number;
  guest_lists_available: number;
  guest_lists_hidden: number;
}

export interface DaySchedule {
  date: string;
  label: string;
  events: EnrichedEvent[];
}

export interface EnrichedEvent {
  id: string;
  title: string;
  slug: string;
  url: string;
  description: string;
  time: EventTime;
  location: { address: string; city: string } | null;
  organizer: string;
  hosts: PersonSummary[];
  featured_guests: PersonSummary[];
  rsvp_status: string;
  guest_list: EventGuestList | null;
  serendipity: SerendipityScore;
  conflicts: string[];
  conflict_group: number | null;
}

export interface EventTime {
  start_utc: string;
  end_utc: string;
  start_local: string;
  end_local: string;
  duration_minutes: number;
}

export interface EventGuestList {
  available: boolean;
  hidden_reason: string | null;
  total_count: number;
  guests: string[]; // api_ids referencing people index
}

export interface SerendipityScore {
  score: number;
  warm_connections: string[];     // api_ids
  super_connectors: string[];    // api_ids
  guest_quality_pct: number;
  breakdown: ScoreBreakdown;
}

export interface ScoreBreakdown {
  warm: number;
  volume: number;
  quality: number;
  connectors: number;
  relevance: number;
}

export interface PersonSummary {
  api_id: string;
  name: string;
  bio: string | null;
  avatar_url: string | null;
  linkedin_slug: string | null;
  linkedin_url: string | null;
  twitter: string | null;
  instagram: string | null;
  website: string | null;
  is_your_connection: boolean;
  events_attending: string[];       // event ids
  last_messaged: string | null;     // ISO date
  linkedin_company: string | null;
  linkedin_position: string | null;
}
