import { describe, expect, it } from "vitest";
import { type EnrichedOutput, OutputSchema } from "../../src/output/schema.js";

describe("OutputSchema", () => {
  it("accepts a minimal valid output", () => {
    const output: EnrichedOutput = {
      schema_version: "1.0",
      _notice: "confidential",
      generated_at_utc: "2026-05-23T18:34:12Z",
      source: {
        ics_url: "/tmp/sample.ics",
        ics_fetched_at_utc: "2026-05-23T18:34:12Z",
      },
      user: null,
      window: {
        from_utc: null,
        to_utc: null,
      },
      summary: {
        total_events: 0,
        events_by_day_count: {},
        by_rsvp_status: {},
        guest_lists_retrieved: 0,
        guest_lists_hidden_by_host: 0,
        events_user_is_hosting: 0,
        events_marked_interested_only: 0,
      },
      run_diagnostics: {
        auth_method: "persistent_playwright_context",
        auth_verified_at_utc: null,
        endpoints_called: {},
        errors: [],
        warnings: [],
      },
      events: [],
    };

    expect(OutputSchema.parse(output)).toEqual(output);
  });

  it("rejects an invalid RSVP status", () => {
    const result = OutputSchema.safeParse({
      schema_version: "1.0",
      _notice: "confidential",
      generated_at_utc: "2026-05-23T18:34:12Z",
      source: { ics_url: "x", ics_fetched_at_utc: "2026-05-23T18:34:12Z" },
      user: null,
      window: { from_utc: null, to_utc: null },
      summary: {
        total_events: 0,
        events_by_day_count: {},
        by_rsvp_status: {},
        guest_lists_retrieved: 0,
        guest_lists_hidden_by_host: 0,
        events_user_is_hosting: 0,
        events_marked_interested_only: 0,
      },
      run_diagnostics: {
        auth_method: "persistent_playwright_context",
        auth_verified_at_utc: null,
        endpoints_called: {},
        errors: [],
        warnings: [],
      },
      events: [
        {
          luma_event_id: "evt",
          title: "bad",
          url: null,
          slug: null,
          calendar_pk: null,
          time: {
            start_utc: "2026-05-23T18:34:12Z",
            end_utc: "2026-05-23T19:34:12Z",
            start_toronto: "x",
            end_toronto: "x",
            start_calgary: "x",
            duration_minutes: 60,
            day_of_week: "Saturday",
          },
          organizer: { name: null, luma_email: null },
          location: {
            address: null,
            city: null,
            geo_lat: null,
            geo_lon: null,
            google_maps_url: null,
          },
          description: "",
          ics_status: null,
          ics_transparency: null,
          public_event_status: {},
          authenticated: {
            fetched_at_utc: "2026-05-23T18:34:12Z",
            rsvp: { status: "bad" },
            event: { is_user_host: false, is_user_co_host: false },
            hosts: [],
            featured_guests: [],
            guest_list: {
              available: false,
              hidden_reason: "host_disabled",
              total_count: null,
              going_count: null,
              waitlist_count: null,
              guests: [],
              guests_truncated: false,
              pagination_cap: null,
            },
          },
        },
      ],
    });

    expect(result.success).toBe(false);
  });
});
