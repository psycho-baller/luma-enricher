import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { Logger } from "pino";
import { fetchIcs } from "../ics/fetcher.js";
import { parseIcsCalendar } from "../ics/parser.js";
import type { ParsedEvent } from "../ics/types.js";
import { LumaApiClient, type LumaApiClientOptions } from "../luma/api.js";
import { AuthExpiredError, GuestListHiddenError, RateLimitedError } from "../luma/errors.js";
import type { LumaRequester } from "../luma/requester.js";
import { defaultProfileDir, LumaSession } from "../luma/session.js";
import type { LumaCurrentUser } from "../luma/types.js";
import type { EnrichedEvent, EnrichedOutput } from "../output/schema.js";
import { ensurePrivateDirectory } from "../util/fs.js";
import { withRetry } from "../util/retry.js";
import { dayKey, parseDateInput, sleep, toIsoUtc } from "../util/time.js";
import { type GuestListMergeInput, mergeAuthenticated, toEnrichedBaseEvent } from "./merge.js";
import { runWorkerPool } from "./worker-pool.js";

export type EnrichOptions = {
  ics: string;
  from?: string | undefined;
  to?: string | undefined;
  includePast?: boolean | undefined;
  profileDir?: string | undefined;
  maxConcurrency?: number | undefined;
  rateLimitMs?: number | undefined;
  skipGuestList?: boolean | undefined;
  dryRun?: boolean | undefined;
  requester?: LumaRequester | undefined;
  apiOptions?: LumaApiClientOptions | undefined;
  logger?: Logger | undefined;
};

type EventDiagnostic = {
  event_api_id?: string | undefined;
  endpoint?: string | undefined;
  status?: number | undefined;
  message: string;
};

export async function enrich(options: EnrichOptions): Promise<EnrichedOutput> {
  const profileDir = options.profileDir ?? defaultProfileDir();
  const maxConcurrency = options.maxConcurrency ?? 3;
  const rateLimitMs = options.rateLimitMs ?? 400;
  const warnings: string[] = [];
  const errors: EventDiagnostic[] = [];
  let authVerifiedAt: string | null = null;
  let user: LumaCurrentUser | null = null;
  let session: LumaSession | null = null;

  const from = parseDateInput(options.from, "--from");
  const to = parseDateInput(options.to, "--to");
  if (from && to && from.getTime() >= to.getTime()) {
    throw new Error("--from must be earlier than --to");
  }
  const effectiveFrom = from ?? (options.includePast ? undefined : new Date());

  await ensurePrivateDirectory(profileDir);
  const fetchResult = await fetchIcs(options.ics);
  await cacheIcs(profileDir, fetchResult.body);

  const parsedCalendar = parseIcsCalendar(fetchResult.body);
  const parsedEvents = parsedCalendar.events.filter((event) =>
    eventWithinWindow(event, effectiveFrom, to),
  );

  let requester: LumaRequester;
  if (options.requester) {
    requester = options.requester;
  } else {
    session = new LumaSession(profileDir);
    requester = session;
  }
  const api = new LumaApiClient(requester, options.apiOptions);

  try {
    if (!options.dryRun) {
      user = await withRetry(() => api.getCurrentUser());
      authVerifiedAt = toIsoUtc();
    } else {
      warnings.push("dry-run enabled: authenticated Luma API calls were skipped");
    }

    const enrichedEvents = options.dryRun
      ? parsedEvents.map(toEnrichedBaseEvent)
      : await runWorkerPool(parsedEvents, maxConcurrency, async (event) => {
          return enrichOneEvent(event, api, {
            skipGuestList: options.skipGuestList ?? false,
            rateLimitMs,
            errors,
            ...(options.logger ? { logger: options.logger } : {}),
          });
        });

    return buildOutput({
      fetchResult,
      events: enrichedEvents,
      user,
      from: effectiveFrom ?? null,
      to: to ?? null,
      authVerifiedAt,
      endpointsCalled: api.endpointsCalled,
      errors,
      warnings,
    });
  } finally {
    await session?.close();
  }
}

async function enrichOneEvent(
  event: ParsedEvent,
  api: LumaApiClient,
  options: {
    skipGuestList: boolean;
    rateLimitMs: number;
    errors: EventDiagnostic[];
    logger?: Logger;
  },
): Promise<EnrichedEvent> {
  const base = toEnrichedBaseEvent(event);
  try {
    const detail = await withRetry(() => api.getEvent(event.luma_event_id), {
      attempts: 8,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      onRetry: (error, attempt, delayMs) => {
        options.logger?.warn(
          { error, attempt, delayMs, event: event.luma_event_id },
          `Encountered error or rate-limit fetching event details. Retrying (attempt ${attempt}/8) in ${delayMs}ms...`,
        );
      },
    });
    await sleep(options.rateLimitMs);

    const ticketKey = detail.guest_data
      ? (detail.guest_data.ticket_key ??
         detail.guest_data.ticket_type ??
         detail.guest_data.ticket_name) as string | undefined
      : undefined;

    const guestList = await resolveGuestList(
      event.luma_event_id,
      detail.show_guest_list,
      ticketKey,
      api,
      options,
    );
    base.authenticated = mergeAuthenticated(event, detail, guestList);
    return base;
  } catch (error) {
    if (error instanceof AuthExpiredError) throw error;
    const diagnostic = diagnosticFromError(error, event.luma_event_id);
    options.errors.push(diagnostic);
    options.logger?.warn(diagnostic, "event enrichment failed");
    return base;
  }
}

async function resolveGuestList(
  eventApiId: string,
  showGuestList: boolean,
  ticketKey: string | undefined,
  api: LumaApiClient,
  options: {
    skipGuestList: boolean;
    rateLimitMs: number;
    errors: EventDiagnostic[];
    logger?: Logger;
  },
): Promise<GuestListMergeInput> {
  if (options.skipGuestList) return { kind: "skipped", reason: "skipped_by_flag" };
  if (!showGuestList) return { kind: "hidden", reason: "host_disabled" };

  try {
    const result = await withRetry(() => api.getGuests(eventApiId, ticketKey), {
      attempts: 8,
      baseDelayMs: 1000,
      maxDelayMs: 30000,
      onRetry: (error, attempt, delayMs) => {
        options.logger?.warn(
          { error, attempt, delayMs, event: eventApiId },
          `Encountered error or rate-limit fetching guest list. Retrying (attempt ${attempt}/8) in ${delayMs}ms...`,
        );
      },
    });
    await sleep(options.rateLimitMs);
    return { kind: "available", result };
  } catch (error) {
    if (error instanceof GuestListHiddenError) {
      return { kind: "hidden", reason: "host_disabled" };
    }
    if (error instanceof AuthExpiredError) throw error;
    options.errors.push(diagnosticFromError(error, eventApiId, "/event/get-guest-list"));
    return { kind: "hidden", reason: fetchErrorReason(error) };
  }
}

function eventWithinWindow(
  event: ParsedEvent,
  from: Date | undefined,
  to: Date | undefined,
): boolean {
  const start = new Date(event.time.start_utc);
  if (from && start.getTime() < from.getTime()) return false;
  if (to && start.getTime() >= to.getTime()) return false;
  return true;
}

async function cacheIcs(profileDir: string, body: string): Promise<void> {
  const cacheDir = join(profileDir, "cache");
  await mkdir(cacheDir, { recursive: true, mode: 0o700 });
  await writeFile(join(cacheDir, "last.ics"), body, "utf8");
}

function buildOutput(args: {
  fetchResult: Awaited<ReturnType<typeof fetchIcs>>;
  events: EnrichedEvent[];
  user: LumaCurrentUser | null;
  from: Date | null;
  to: Date | null;
  authVerifiedAt: string | null;
  endpointsCalled: Record<string, number>;
  errors: EventDiagnostic[];
  warnings: string[];
}): EnrichedOutput {
  const eventsByDay: Record<string, number> = {};
  const byRsvpStatus: Record<string, number> = {};
  let guestListsRetrieved = 0;
  let guestListsHidden = 0;
  let hosting = 0;
  let interestedOnly = 0;

  for (const event of args.events) {
    const key = dayKey(new Date(event.time.start_utc));
    eventsByDay[key] = (eventsByDay[key] ?? 0) + 1;
    if (event.ics_transparency === "TRANSPARENT") interestedOnly += 1;
    const authenticated = event.authenticated;
    if (!authenticated) continue;
    byRsvpStatus[authenticated.rsvp.status] = (byRsvpStatus[authenticated.rsvp.status] ?? 0) + 1;
    if (authenticated.guest_list.available) guestListsRetrieved += 1;
    if (
      !authenticated.guest_list.available &&
      authenticated.guest_list.hidden_reason === "host_disabled"
    ) {
      guestListsHidden += 1;
    }
    if (authenticated.event.is_user_host) hosting += 1;
  }

  const source = {
    ics_url: args.fetchResult.source,
    ics_fetched_at_utc: args.fetchResult.fetched_at_utc,
    ...(args.fetchResult.etag ? { ics_etag: args.fetchResult.etag } : {}),
  };

  return {
    schema_version: "1.0",
    _notice: "This file contains attendee data from Luma. Treat as confidential.",
    generated_at_utc: toIsoUtc(),
    source,
    user: args.user,
    window: {
      from_utc: args.from ? toIsoUtc(args.from) : null,
      to_utc: args.to ? toIsoUtc(args.to) : null,
    },
    summary: {
      total_events: args.events.length,
      events_by_day_count: eventsByDay,
      by_rsvp_status: byRsvpStatus,
      guest_lists_retrieved: guestListsRetrieved,
      guest_lists_hidden_by_host: guestListsHidden,
      events_user_is_hosting: hosting,
      events_marked_interested_only: interestedOnly,
    },
    run_diagnostics: {
      auth_method: "persistent_playwright_context",
      auth_verified_at_utc: args.authVerifiedAt,
      endpoints_called: args.endpointsCalled,
      errors: args.errors,
      warnings: args.warnings,
    },
    events: args.events,
  };
}

function diagnosticFromError(
  error: unknown,
  eventApiId: string,
  endpoint?: string,
): EventDiagnostic {
  const maybeStatus =
    typeof error === "object" && error !== null ? (error as { status?: number }).status : undefined;
  const message = error instanceof Error ? error.message : String(error);
  return {
    event_api_id: eventApiId,
    ...(endpoint ? { endpoint } : {}),
    ...(typeof maybeStatus === "number" ? { status: maybeStatus } : {}),
    message,
  };
}

function fetchErrorReason(error: unknown): string {
  const status =
    typeof error === "object" && error !== null ? (error as { status?: number }).status : undefined;
  return typeof status === "number" ? `fetch_error_${status}` : "fetch_error";
}
