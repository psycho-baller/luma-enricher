import { GuestListHiddenError, LumaApiError } from "./errors.js";
import type { LumaRequester } from "./requester.js";
import type {
  EndpointsCalled,
  LumaCurrentUser,
  LumaEventDetail,
  LumaGuest,
  LumaGuestsResult,
  LumaProfile,
  RsvpStatus,
} from "./types.js";

export type LumaApiClientOptions = {
  baseUrl?: string;
  maxGuestPages?: number;
  paginationLimit?: number;
};

export class LumaApiClient {
  readonly endpointsCalled: EndpointsCalled = {};
  private readonly baseUrl: string;
  private readonly maxGuestPages: number;
  private readonly paginationLimit: number;

  constructor(
    private readonly requester: LumaRequester,
    options: LumaApiClientOptions = {},
  ) {
    this.baseUrl = options.baseUrl ?? "https://api2.luma.com";
    this.maxGuestPages = options.maxGuestPages ?? 40;
    this.paginationLimit = options.paginationLimit ?? 50;
  }

  async getCurrentUser(): Promise<LumaCurrentUser> {
    const raw = await this.postJson<Record<string, unknown>>("/ping");
    const user = asRecord(raw.user) ?? raw;
    const apiId = pickString(user, ["api_id", "id", "user_api_id"]);
    if (!apiId) {
      throw new LumaApiError({
        status: 200,
        message: "Luma current-user response did not include user.api_id",
        url: "/ping",
      });
    }
    return {
      api_id: apiId,
      name: pickString(user, ["name", "full_name"]) ?? null,
      email: pickString(user, ["email"]) ?? null,
      username: pickString(user, ["username"]) ?? null,
    };
  }

  async getEvent(eventApiId: string): Promise<LumaEventDetail> {
    const raw = await this.getJson<Record<string, unknown>>(
      `/event/get?event_api_id=${encodeURIComponent(eventApiId)}`,
    );
    const event = asRecord(raw.event) ?? raw;
    const ticketInfo = asRecord(raw.ticket_info) ?? asRecord(event.ticket_info);
    const guestData = asRecord(raw.guest_data) ?? asRecord(raw.guestData);
    const hosts = arrayFrom(raw.hosts ?? event.hosts).map(normalizeProfile);
    const featuredGuests = arrayFrom(raw.featured_guests ?? event.featured_guests).map(
      normalizeProfile,
    );

    return {
      raw,
      event_api_id: eventApiId,
      event,
      ticket_info: ticketInfo,
      guest_data: guestData,
      role: pickString(raw, ["role"]) ?? null,
      hosts,
      featured_guests: featuredGuests,
      show_guest_list: pickBoolean(event, ["show_guest_list", "guest_list_public"]) ?? false,
    };
  }

  async getGuests(eventApiId: string, ticketKey?: string | null): Promise<LumaGuestsResult> {
    const guests: LumaGuest[] = [];
    let cursor: string | null = null;
    let totalCount: number | null = null;
    let goingCount: number | null = null;
    let waitlistCount: number | null = null;
    let pages = 0;
    let hasMore = true;

    while (hasMore && pages < this.maxGuestPages) {
      const params = new URLSearchParams({
        event_api_id: eventApiId,
        pagination_limit: String(this.paginationLimit),
      });
      if (cursor) params.set("pagination_cursor", cursor);

      let path: string;
      if (ticketKey) {
        params.set("ticket_key", ticketKey);
        path = `/event/get-guest-list?${params.toString()}`;
      } else {
        path = `/event/get-guests?${params.toString()}`;
      }

      let raw: Record<string, unknown>;
      try {
        raw = await this.getJson<Record<string, unknown>>(path);
      } catch (error) {
        if (error instanceof LumaApiError && error.status === 403) {
          throw new GuestListHiddenError(eventApiId);
        }
        throw error;
      }

      const pageGuests = arrayFrom(
        raw.guests ?? raw.entries ?? raw.items ?? raw.guest_list ?? raw.data,
      ).map(normalizeGuest);
      guests.push(...pageGuests);
      totalCount = pickNumber(raw, ["total_count", "guest_count", "count"]) ?? totalCount;
      goingCount = pickNumber(raw, ["going_count", "approved_count"]) ?? goingCount;
      waitlistCount = pickNumber(raw, ["waitlist_count", "waitlisted_count"]) ?? waitlistCount;
      cursor = pickString(raw, ["next_cursor", "pagination_cursor"]) ?? null;
      hasMore = pickBoolean(raw, ["has_more"]) ?? Boolean(cursor);
      pages += 1;
    }

    return {
      total_count: totalCount ?? guests.length,
      going_count: goingCount,
      waitlist_count: waitlistCount,
      guests,
      guests_truncated: hasMore,
      pagination_cap: hasMore ? this.maxGuestPages * this.paginationLimit : null,
    };
  }

  private async getJson<T>(path: string): Promise<T> {
    const endpoint = path.split("?")[0] ?? path;
    this.endpointsCalled[endpoint] = (this.endpointsCalled[endpoint] ?? 0) + 1;
    return this.requester.getJson<T>(`${this.baseUrl}${path}`);
  }

  private async postJson<T>(path: string, body?: unknown): Promise<T> {
    const endpoint = path.split("?")[0] ?? path;
    this.endpointsCalled[endpoint] = (this.endpointsCalled[endpoint] ?? 0) + 1;
    return this.requester.postJson<T>(`${this.baseUrl}${path}`, body);
  }
}

export function mapApprovalToRsvp(
  guestData: Record<string, unknown> | null | undefined,
  icsTransparency: string | null | undefined,
): RsvpStatus {
  if (!guestData) {
    return icsTransparency === "TRANSPARENT" ? "interested" : "unknown";
  }

  const approvalStatus = pickString(guestData, ["approval_status", "status"]);
  switch (approvalStatus) {
    case "approved":
      return "going";
    case "pending_approval":
      return "pending_approval";
    case "waitlist":
    case "waitlisted":
      return "waitlisted";
    case "declined":
      return "declined";
    case "invited":
      return "not_going";
    default:
      return "unknown";
  }
}

export function normalizeProfile(raw: unknown): LumaProfile {
  const record = asRecord(raw) ?? {};
  const user = asRecord(record.user) ?? asRecord(record.profile) ?? record;
  const social = normalizeSocial(user);
  const profile: LumaProfile = {
    raw,
  };

  assignIfDefined(profile, "api_id", pickString(user, ["api_id", "id", "user_api_id"]));
  assignIfDefined(profile, "name", pickString(user, ["name", "full_name"]));
  assignIfDefined(profile, "username", pickString(user, ["username"]));
  assignIfDefined(profile, "avatar_url", pickString(user, ["avatar_url", "avatar"]));
  assignIfDefined(profile, "is_verified", pickBoolean(user, ["is_verified", "verified"]));
  if (Object.keys(social).length > 0) profile.social = social;

  return profile;
}

function normalizeGuest(raw: unknown): LumaGuest {
  const record = asRecord(raw) ?? {};
  const guest = normalizeProfile(record.user ?? record.guest ?? raw) as LumaGuest;
  assignIfDefined(guest, "approval_status", pickString(record, ["approval_status", "status"]));
  assignIfDefined(
    guest,
    "registered_at_utc",
    pickString(record, ["registered_at", "registered_at_utc", "created_at"]),
  );
  return guest;
}

function normalizeSocial(record: Record<string, unknown>): NonNullable<LumaProfile["social"]> {
  const socialRecord = asRecord(record.social) ?? record;
  const social: NonNullable<LumaProfile["social"]> = {};
  assignIfDefined(social, "twitter", pickString(socialRecord, ["twitter", "twitter_handle"]));
  assignIfDefined(social, "linkedin", pickString(socialRecord, ["linkedin", "linkedin_url"]));
  assignIfDefined(social, "instagram", pickString(socialRecord, ["instagram", "instagram_handle"]));
  assignIfDefined(social, "website", pickString(socialRecord, ["website", "website_url"]));
  return social;
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function arrayFrom(value: unknown): unknown[] {
  return Array.isArray(value) ? value : [];
}

function pickString(record: Record<string, unknown>, keys: string[]): string | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.length > 0) return value;
  }
  return undefined;
}

function pickNumber(record: Record<string, unknown>, keys: string[]): number | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

function pickBoolean(record: Record<string, unknown>, keys: string[]): boolean | undefined {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "boolean") return value;
  }
  return undefined;
}

function assignIfDefined<T extends object, K extends keyof T>(
  target: T,
  key: K,
  value: T[K] | undefined,
): void {
  if (value !== undefined) target[key] = value;
}
