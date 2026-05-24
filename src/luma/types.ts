import { z } from "zod";

export const RsvpStatusSchema = z.enum([
  "going",
  "waitlisted",
  "pending_approval",
  "declined",
  "not_going",
  "interested",
  "unknown",
]);

export type RsvpStatus = z.infer<typeof RsvpStatusSchema>;

export type LumaCurrentUser = {
  api_id: string;
  name: string | null;
  email: string | null;
  username: string | null;
};

export type LumaSocial = {
  twitter?: string | null;
  linkedin?: string | null;
  instagram?: string | null;
  website?: string | null;
};

export type LumaProfile = {
  api_id?: string | null;
  name?: string | null;
  username?: string | null;
  avatar_url?: string | null;
  is_verified?: boolean | null;
  social?: LumaSocial;
  raw?: unknown;
};

export type LumaEventDetail = {
  raw: unknown;
  event_api_id: string;
  event: Record<string, unknown>;
  ticket_info: Record<string, unknown> | null;
  guest_data: Record<string, unknown> | null;
  role: string | null;
  hosts: LumaProfile[];
  featured_guests: LumaProfile[];
  show_guest_list: boolean;
};

export type LumaGuest = LumaProfile & {
  approval_status?: string | null;
  registered_at_utc?: string | null;
};

export type LumaGuestsResult = {
  total_count: number | null;
  going_count: number | null;
  waitlist_count: number | null;
  guests: LumaGuest[];
  guests_truncated: boolean;
  pagination_cap: number | null;
};

export type EndpointsCalled = Record<string, number>;
