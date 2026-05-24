import { z } from "zod";
import { RsvpStatusSchema } from "../luma/types.js";

export const SocialSchema = z
  .object({
    twitter: z.string().nullable().optional(),
    linkedin: z.string().nullable().optional(),
    instagram: z.string().nullable().optional(),
    website: z.string().nullable().optional(),
  })
  .strict();

export const ProfileSchema = z
  .object({
    api_id: z.string().nullable().optional(),
    name: z.string().nullable().optional(),
    username: z.string().nullable().optional(),
    avatar_url: z.string().nullable().optional(),
    is_verified: z.boolean().nullable().optional(),
    social: SocialSchema.optional(),
  })
  .passthrough();

export const GuestSchema = ProfileSchema.extend({
  approval_status: z.string().nullable().optional(),
  registered_at_utc: z.string().nullable().optional(),
});

export const AuthenticatedBlockSchema = z
  .object({
    fetched_at_utc: z.string(),
    rsvp: z.object({
      status: RsvpStatusSchema,
      ticket_type: z.string().nullable().optional(),
      approval_status: z.string().nullable().optional(),
      registered_at_utc: z.string().nullable().optional(),
      checked_in: z.boolean().nullable().optional(),
      checked_in_at_utc: z.string().nullable().optional(),
    }),
    event: z.object({
      is_user_host: z.boolean(),
      is_user_co_host: z.boolean(),
      capacity: z.number().nullable().optional(),
      spots_remaining: z.number().nullable().optional(),
      is_near_capacity: z.boolean().nullable().optional(),
      is_sold_out: z.boolean().nullable().optional(),
      waitlist_active: z.boolean().nullable().optional(),
      require_approval: z.boolean().nullable().optional(),
      is_free: z.boolean().nullable().optional(),
      price_cents: z.number().nullable().optional(),
      currency: z.string().nullable().optional(),
    }),
    hosts: z.array(ProfileSchema),
    featured_guests: z.array(ProfileSchema),
    guest_list: z.object({
      available: z.boolean(),
      hidden_reason: z.string().nullable(),
      total_count: z.number().nullable(),
      going_count: z.number().nullable(),
      waitlist_count: z.number().nullable(),
      guests: z.array(GuestSchema),
      guests_truncated: z.boolean(),
      pagination_cap: z.number().nullable(),
    }),
  })
  .strict();

export const EnrichedEventSchema = z
  .object({
    luma_event_id: z.string(),
    title: z.string(),
    url: z.string().nullable(),
    slug: z.string().nullable(),
    calendar_pk: z.string().nullable(),
    time: z.object({
      start_utc: z.string(),
      end_utc: z.string(),
      start_toronto: z.string(),
      end_toronto: z.string(),
      start_calgary: z.string(),
      duration_minutes: z.number(),
      day_of_week: z.string(),
    }),
    organizer: z.object({
      name: z.string().nullable(),
      luma_email: z.string().nullable(),
    }),
    location: z.object({
      address: z.string().nullable(),
      city: z.string().nullable(),
      geo_lat: z.number().nullable(),
      geo_lon: z.number().nullable(),
      google_maps_url: z.string().nullable(),
    }),
    description: z.string(),
    ics_status: z.string().nullable(),
    ics_transparency: z.string().nullable(),
    rami_rsvp_status_inferred: z.string().optional(),
    rami_rsvp_status_note: z.string().optional(),
    public_event_status: z.record(z.string(), z.unknown()),
    authenticated: AuthenticatedBlockSchema.optional(),
  })
  .strict();

export const OutputSchema = z
  .object({
    schema_version: z.literal("1.0"),
    _notice: z.string(),
    generated_at_utc: z.string(),
    source: z.object({
      ics_url: z.string(),
      ics_etag: z.string().optional(),
      ics_fetched_at_utc: z.string(),
    }),
    user: z
      .object({
        api_id: z.string(),
        name: z.string().nullable(),
        email: z.string().nullable(),
        username: z.string().nullable(),
      })
      .nullable(),
    window: z.object({
      from_utc: z.string().nullable(),
      to_utc: z.string().nullable(),
    }),
    summary: z.object({
      total_events: z.number(),
      events_by_day_count: z.record(z.string(), z.number()),
      by_rsvp_status: z.record(z.string(), z.number()),
      guest_lists_retrieved: z.number(),
      guest_lists_hidden_by_host: z.number(),
      events_user_is_hosting: z.number(),
      events_marked_interested_only: z.number(),
    }),
    run_diagnostics: z.object({
      auth_method: z.string(),
      auth_verified_at_utc: z.string().nullable(),
      endpoints_called: z.record(z.string(), z.number()),
      errors: z.array(
        z.object({
          event_api_id: z.string().optional(),
          endpoint: z.string().optional(),
          status: z.number().optional(),
          message: z.string(),
        }),
      ),
      warnings: z.array(z.string()),
    }),
    events: z.array(EnrichedEventSchema),
  })
  .strict();

export type EnrichedEvent = z.infer<typeof EnrichedEventSchema>;
export type EnrichedOutput = z.infer<typeof OutputSchema>;
export type AuthenticatedBlock = z.infer<typeof AuthenticatedBlockSchema>;
