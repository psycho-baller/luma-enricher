import { dayOfWeek, durationMinutes, formatInZone } from "../util/time.js";
import { resolveEventIds } from "./resolve.js";
import type { ParsedCalendar, ParsedEvent } from "./types.js";

type IcsProperty = {
  name: string;
  params: Record<string, string>;
  value: string;
};

export class IcsParseError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "IcsParseError";
  }
}

export function parseIcsCalendar(input: string): ParsedCalendar {
  const lines = unfoldLines(input);
  const calendarName = findFirstProperty(lines, "X-WR-CALNAME")?.value ?? null;
  const eventBlocks = collectEventBlocks(lines);
  const events = eventBlocks.map((block, index) => parseEventBlock(block, index));
  return { calendar_name: calendarName, events };
}

export function unfoldLines(input: string): string[] {
  const lines = input.replace(/\r\n/g, "\n").replace(/\r/g, "\n").split("\n");
  const unfolded: string[] = [];

  for (const line of lines) {
    if (/^[ \t]/.test(line) && unfolded.length > 0) {
      unfolded[unfolded.length - 1] = `${unfolded[unfolded.length - 1]}${line.slice(1)}`;
    } else if (line.length > 0) {
      unfolded.push(line);
    }
  }

  return unfolded;
}

function collectEventBlocks(lines: string[]): string[][] {
  const blocks: string[][] = [];
  let current: string[] | null = null;

  for (const line of lines) {
    if (line === "BEGIN:VEVENT") {
      current = [];
      continue;
    }
    if (line === "END:VEVENT") {
      if (!current) throw new IcsParseError("found END:VEVENT without BEGIN:VEVENT");
      blocks.push(current);
      current = null;
      continue;
    }
    if (current) current.push(line);
  }

  if (current) throw new IcsParseError("found BEGIN:VEVENT without END:VEVENT");
  return blocks;
}

function parseEventBlock(lines: string[], index: number): ParsedEvent {
  const props = new Map<string, IcsProperty[]>();
  for (const line of lines) {
    const prop = parseProperty(line);
    const existing = props.get(prop.name) ?? [];
    existing.push(prop);
    props.set(prop.name, existing);
  }

  const get = (name: string) => props.get(name)?.[0] ?? null;
  const uid = get("UID")?.value ?? null;
  const summary = get("SUMMARY")?.value;
  const description = get("DESCRIPTION")?.value ?? null;
  const organizer = get("ORGANIZER");
  const location = get("LOCATION")?.value ?? null;
  const geo = get("GEO")?.value ?? null;
  const status = get("STATUS")?.value ?? null;
  const transparency = get("TRANSP")?.value ?? "OPAQUE";
  const dtStart = get("DTSTART")?.value;
  const dtEnd = get("DTEND")?.value;

  if (!uid) throw new IcsParseError(`VEVENT ${index + 1} is missing UID`);
  if (!summary) throw new IcsParseError(`VEVENT ${index + 1} is missing SUMMARY`);
  if (!dtStart) throw new IcsParseError(`VEVENT ${index + 1} is missing DTSTART`);
  if (!dtEnd) throw new IcsParseError(`VEVENT ${index + 1} is missing DTEND`);

  const start = parseIcsDate(dtStart, "DTSTART", index);
  const end = parseIcsDate(dtEnd, "DTEND", index);
  const resolved = resolveEventIds(uid, description);
  const [geoLat, geoLon] = parseGeo(geo);
  const inferredInterested = transparency === "TRANSPARENT";

  return {
    luma_event_id: resolved.event_api_id ?? uid,
    title: summary,
    url: resolved.url,
    slug: resolved.slug,
    calendar_pk: resolved.calendar_pk,
    time: {
      start_utc: start.toISOString().replace(/\.\d{3}Z$/, "Z"),
      end_utc: end.toISOString().replace(/\.\d{3}Z$/, "Z"),
      start_toronto: formatInZone(start, "America/Toronto"),
      end_toronto: formatInZone(end, "America/Toronto"),
      start_calgary: formatInZone(start, "America/Edmonton"),
      duration_minutes: durationMinutes(start, end),
      day_of_week: dayOfWeek(start),
    },
    organizer: {
      name: organizer?.params.CN ?? null,
      luma_email: extractMailto(organizer?.value ?? null),
    },
    location: {
      address: location,
      city: inferCity(location),
      geo_lat: geoLat,
      geo_lon: geoLon,
      google_maps_url: geoLat !== null && geoLon !== null ? googleMapsUrl(geoLat, geoLon) : null,
    },
    description: cleanDescription(description),
    ics_status: status,
    ics_transparency: transparency,
    rami_rsvp_status_inferred: inferredInterested ? "interested_only" : "rsvp_in_calendar",
    rami_rsvp_status_note: inferredInterested
      ? "Appears in your Luma calendar feed with TRANSP:TRANSPARENT, which usually means Interested."
      : "Appears in your Luma calendar feed. Authenticated Luma data is needed to distinguish Going, Waitlisted, and Pending Approval.",
    public_event_status: {
      source: "deprecated_use_authenticated",
      status: "unknown",
    },
    raw: {
      uid,
      description,
      properties: propertiesToRecord(props),
    },
  };
}

function parseProperty(line: string): IcsProperty {
  const colonIndex = line.indexOf(":");
  if (colonIndex === -1) {
    throw new IcsParseError(`invalid ICS property line: ${line}`);
  }

  const head = line.slice(0, colonIndex);
  const value = unescapeIcsValue(line.slice(colonIndex + 1));
  const [namePart, ...paramParts] = splitPropertyHead(head);
  const name = namePart?.toUpperCase();
  if (!name) throw new IcsParseError(`invalid ICS property name: ${line}`);

  const params: Record<string, string> = {};
  for (const param of paramParts) {
    const eqIndex = param.indexOf("=");
    if (eqIndex === -1) continue;
    const key = param.slice(0, eqIndex).toUpperCase();
    const rawValue = param.slice(eqIndex + 1);
    params[key] = stripQuotes(rawValue);
  }

  return { name, params, value };
}

function splitPropertyHead(head: string): string[] {
  const parts: string[] = [];
  let current = "";
  let quoted = false;

  for (const char of head) {
    if (char === '"') quoted = !quoted;
    if (char === ";" && !quoted) {
      parts.push(current);
      current = "";
    } else {
      current += char;
    }
  }
  parts.push(current);
  return parts;
}

function stripQuotes(value: string): string {
  return value.replace(/^"|"$/g, "");
}

function findFirstProperty(lines: string[], name: string): IcsProperty | null {
  for (const line of lines) {
    const prop = parseProperty(line);
    if (prop.name === name) return prop;
  }
  return null;
}

function parseIcsDate(value: string, field: string, index: number): Date {
  const match = value.match(/^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})Z$/);
  if (!match) {
    throw new IcsParseError(`VEVENT ${index + 1} has unsupported ${field}: ${value}`);
  }
  const [, year, month, day, hour, minute, second] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  );
}

function parseGeo(value: string | null): [number | null, number | null] {
  if (!value) return [null, null];
  const [latRaw, lonRaw] = value.split(";");
  const lat = Number(latRaw);
  const lon = Number(lonRaw);
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return [null, null];
  return [lat, lon];
}

function extractMailto(value: string | null): string | null {
  if (!value) return null;
  const match = value.match(/^MAILTO:(.+)$/i);
  return match?.[1] ?? value;
}

function inferCity(location: string | null): string | null {
  if (!location || /^https:\/\/luma\.com\/join\//i.test(location)) return null;
  const match = location.match(
    /\b(Toronto|North York|Scarborough|Etobicoke|Mississauga|Waterloo|Kitchener|Gananoque|Calgary|Vancouver|Montreal),\s*(ON|AB|BC|QC)\b/i,
  );
  if (!match?.[1] || !match[2]) return null;
  return `${match[1]}, ${match[2].toUpperCase()}`;
}

function googleMapsUrl(lat: number, lon: number): string {
  return `https://www.google.com/maps?q=${lat},${lon}`;
}

function cleanDescription(value: string | null): string {
  if (!value) return "";
  return value
    .split("\n")
    .filter((line) => !/^Get up-to-date information at:/i.test(line.trim()))
    .filter((line) => !/^Click to join:/i.test(line.trim()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function unescapeIcsValue(value: string): string {
  return value
    .replace(/\\n/gi, "\n")
    .replace(/\\,/g, ",")
    .replace(/\\;/g, ";")
    .replace(/\\\\/g, "\\");
}

function propertiesToRecord(props: Map<string, IcsProperty[]>): Record<string, string[]> {
  const record: Record<string, string[]> = {};
  for (const [key, values] of props.entries()) {
    record[key] = values.map((value) => value.value);
  }
  return record;
}
