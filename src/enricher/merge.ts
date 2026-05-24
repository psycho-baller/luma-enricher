import type { ParsedEvent } from "../ics/types.js";
import { mapApprovalToRsvp } from "../luma/api.js";
import type { LumaEventDetail, LumaGuestsResult } from "../luma/types.js";
import type { AuthenticatedBlock, EnrichedEvent } from "../output/schema.js";
import { toIsoUtc } from "../util/time.js";

export type GuestListMergeInput =
  | { kind: "available"; result: LumaGuestsResult }
  | { kind: "hidden"; reason: string }
  | { kind: "skipped"; reason: string };

export function toEnrichedBaseEvent(event: ParsedEvent): EnrichedEvent {
  const { raw: _raw, ...base } = event;
  return base;
}

export function mergeAuthenticated(
  event: ParsedEvent,
  detail: LumaEventDetail,
  guestList: GuestListMergeInput,
): AuthenticatedBlock {
  const ticketInfo = detail.ticket_info ?? {};
  const guestData = detail.guest_data;
  const role = detail.role;
  const availableGuests = guestList.kind === "available" ? guestList.result : null;

  return {
    fetched_at_utc: toIsoUtc(),
    rsvp: {
      status: mapApprovalToRsvp(guestData, event.ics_transparency),
      ticket_type: pickString(guestData, ["ticket_type", "ticket_name", "ticket_key"]) ?? null,
      approval_status: pickString(guestData, ["approval_status", "status"]) ?? null,
      registered_at_utc:
        pickString(guestData, ["registered_at_utc", "registered_at", "created_at"]) ?? null,
      checked_in: pickBoolean(guestData, ["checked_in"]) ?? false,
      checked_in_at_utc: pickString(guestData, ["checked_in_at", "checked_in_at_utc"]) ?? null,
    },
    event: {
      is_user_host: role === "host" || role === "manager",
      is_user_co_host: role === "co_host",
      capacity: pickNumber(detail.event, ["capacity", "guest_limit"]) ?? null,
      spots_remaining: pickNumber(ticketInfo, ["spots_remaining"]) ?? null,
      is_near_capacity: pickBoolean(ticketInfo, ["is_near_capacity"]) ?? null,
      is_sold_out: pickBoolean(ticketInfo, ["is_sold_out"]) ?? null,
      waitlist_active: isWaitlistActive(detail.event),
      require_approval: pickBoolean(ticketInfo, ["require_approval"]) ?? null,
      is_free: pickBoolean(ticketInfo, ["is_free"]) ?? null,
      price_cents: pickPriceCents(ticketInfo),
      currency: pickString(ticketInfo, ["currency"]) ?? null,
    },
    hosts: detail.hosts,
    featured_guests: detail.featured_guests,
    guest_list: {
      available: guestList.kind === "available",
      hidden_reason: guestList.kind === "available" ? null : guestList.reason,
      total_count: availableGuests?.total_count ?? null,
      going_count: availableGuests?.going_count ?? null,
      waitlist_count: availableGuests?.waitlist_count ?? null,
      guests: availableGuests?.guests ?? [],
      guests_truncated: availableGuests?.guests_truncated ?? false,
      pagination_cap: availableGuests?.pagination_cap ?? null,
    },
  };
}

function isWaitlistActive(event: Record<string, unknown>): boolean | null {
  const raw = event.waitlist_status;
  if (raw === "enabled") return true;
  if (raw === "disabled") return false;
  return pickBoolean(event, ["waitlist_active", "has_waitlist"]) ?? null;
}

function pickPriceCents(ticketInfo: Record<string, unknown>): number | null {
  const direct = pickNumber(ticketInfo, ["price_cents"]);
  if (direct !== undefined) return direct;
  const price = ticketInfo.price;
  if (typeof price === "number") return Math.round(price * 100);
  if (typeof price === "object" && price !== null && "cents" in price) {
    const cents = (price as { cents?: unknown }).cents;
    if (typeof cents === "number") return cents;
  }
  return null;
}

function pickString(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): string | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function pickNumber(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): number | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function pickBoolean(
  record: Record<string, unknown> | null | undefined,
  keys: string[],
): boolean | undefined {
  if (!record) return undefined;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}
