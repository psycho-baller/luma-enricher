export type EventTime = {
  start_utc: string;
  end_utc: string;
  start_toronto: string;
  end_toronto: string;
  start_calgary: string;
  duration_minutes: number;
  day_of_week: string;
};

export type EventOrganizer = {
  name: string | null;
  luma_email: string | null;
};

export type EventLocation = {
  address: string | null;
  city: string | null;
  geo_lat: number | null;
  geo_lon: number | null;
  google_maps_url: string | null;
};

export type ParsedEvent = {
  luma_event_id: string;
  title: string;
  url: string | null;
  slug: string | null;
  calendar_pk: string | null;
  time: EventTime;
  organizer: EventOrganizer;
  location: EventLocation;
  description: string;
  ics_status: string | null;
  ics_transparency: string | null;
  rami_rsvp_status_inferred?: string;
  rami_rsvp_status_note?: string;
  public_event_status: {
    source: string;
    status: string;
  };
  raw: {
    uid: string | null;
    description: string | null;
    properties: Record<string, string[]>;
  };
};

export type ParsedCalendar = {
  calendar_name: string | null;
  events: ParsedEvent[];
};

export type IcsFetchResult = {
  body: string;
  source: string;
  etag?: string | undefined;
  fetched_at_utc: string;
  is_local_file: boolean;
};
