import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

// -- types matching dashboard/src/lib/types.ts --

interface DashboardData {
  generated_at: string;
  user: { name: string; api_id: string };
  days: DaySchedule[];
  people: Record<string, PersonSummary>;
  stats: GlobalStats;
}

interface GlobalStats {
  total_events: number;
  total_days: number;
  total_unique_guests: number;
  total_warm_connections: number;
  guest_lists_available: number;
  guest_lists_hidden: number;
}

interface DaySchedule {
  date: string;
  label: string;
  events: EnrichedEvent[];
}

interface EnrichedEvent {
  id: string;
  title: string;
  slug: string;
  url: string;
  description: string;
  time: { start_utc: string; end_utc: string; start_local: string; end_local: string; duration_minutes: number };
  location: { address: string; city: string } | null;
  organizer: string;
  hosts: PersonSummary[];
  featured_guests: PersonSummary[];
  rsvp_status: string;
  guest_list: { available: boolean; hidden_reason: string | null; total_count: number; guests: string[] } | null;
  serendipity: {
    score: number;
    warm_connections: string[];
    super_connectors: string[];
    guest_quality_pct: number;
    breakdown: { warm: number; volume: number; quality: number; connectors: number; relevance: number };
  };
  conflicts: string[];
  conflict_group: number | null;
}

interface PersonSummary {
  api_id: string;
  name: string;
  location: string | null;
  bio: string | null;
  avatar_url: string | null;
  linkedin_slug: string | null;
  linkedin_url: string | null;
  twitter: string | null;
  instagram: string | null;
  website: string | null;
  is_your_connection: boolean;
  events_attending: string[];
  last_messaged: string | null;
  linkedin_company: string | null;
  linkedin_position: string | null;
}

// -- keyword list for topic relevance --
const RELEVANCE_KEYWORDS = [
  "founder", "devrel", "developer relations", "content creator", "builder",
  "startup", "ai", "community", "open source", "mobile", "react native",
  "public speaking", "coaching", "mentorship", "expo", "ai agents",
  "claude code", "codex", "community building",
];

// -- helpers --

function parseCSV(text: string): Record<string, string>[] {
  const lines = text.split("\n");
  if (lines.length < 2) return [];
  const headers = parseCSVLine(lines[0]);
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    const values = parseCSVLine(line);
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j++) {
      row[headers[j]] = values[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function parseCSVLine(line: string): string[] {
  const result: string[] = [];
  let current = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        result.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  result.push(current.trim());
  return result;
}

function extractLinkedInSlug(handle: string | null | undefined): string | null {
  if (!handle) return null;
  const slug = handle.replace(/^\/in\//, "").replace(/^\/company\//, "").replace(/\/$/, "").toLowerCase();
  return slug || null;
}

function normalizePersonName(name: string | null | undefined): string | null {
  if (!name) return null;
  const normalized = name
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
  return normalized || null;
}

function timeOverlaps(a: { start_utc: string; end_utc: string }, b: { start_utc: string; end_utc: string }): boolean {
  return a.start_utc < b.end_utc && b.start_utc < a.end_utc;
}

function computeRelevanceScore(text: string): number {
  const lower = text.toLowerCase();
  let hits = 0;
  for (const kw of RELEVANCE_KEYWORDS) {
    if (lower.includes(kw)) hits++;
  }
  return Math.min(hits / 5, 1.0) * 100;
}

// -- main --

function main() {
  console.log("Building dashboard data...");

  // 1. read luma data
  const lumaRaw = JSON.parse(readFileSync("/tmp/luma-enriched.json", "utf-8"));
  const lumaEvents: any[] = lumaRaw.events ?? [];
  const lumaUser = lumaRaw.user ?? {};
  console.log(`  Luma events: ${lumaEvents.length}`);

  // 2. read linkedin connections
  const connectionsText = readFileSync(
    resolve("/Users/rami/Documents/life-os/network/linkedin-data-export/Connections.csv"),
    "utf-8"
  );
  // skip first 3 notice lines
  const connectionsCSV = connectionsText.split("\n").slice(3).join("\n");
  const connections = parseCSV(connectionsCSV);
  console.log(`  LinkedIn connections: ${connections.length}`);

  // build slug -> connection map
  const slugToConnection: Map<string, { firstName: string; lastName: string; company: string; position: string; url: string }> = new Map();
  for (const c of connections) {
    const url = c["URL"] ?? "";
    if (url.includes("/in/")) {
      const slug = url.split("/in/")[1]?.replace(/\/$/, "").toLowerCase();
      if (slug) {
        slugToConnection.set(slug, {
          firstName: c["First Name"] ?? "",
          lastName: c["Last Name"] ?? "",
          company: c["Company"] ?? "",
          position: c["Position"] ?? "",
          url,
        });
      }
    }
  }
  console.log(`  LinkedIn slugs indexed: ${slugToConnection.size}`);

  // 3. read linkedin messages for recency
  const messagesText = readFileSync(
    resolve("/Users/rami/Documents/life-os/network/linkedin-data-export/messages.csv"),
    "utf-8"
  );
  const messages = parseCSV(messagesText);
  console.log(`  LinkedIn messages: ${messages.length}`);

  // build slug -> last message date
  const slugToLastMessage: Map<string, string> = new Map();
  for (const msg of messages) {
    const date = msg["DATE"] ?? "";
    if (!date) continue;

    const profileUrls = [
      msg["SENDER PROFILE URL"] ?? "",
      ...(msg["RECIPIENT PROFILE URLS"] ?? "").split(","),
    ];

    for (const pu of profileUrls) {
      const trimmed = pu.trim();
      if (trimmed.includes("/in/")) {
        const slug = trimmed.split("/in/")[1]?.replace(/\/$/, "").toLowerCase();
        if (slug && slug !== "rami-m") {
          const existing = slugToLastMessage.get(slug);
          if (!existing || date > existing) {
            slugToLastMessage.set(slug, date);
          }
        }
      }
    }
  }
  console.log(`  Message recency indexed: ${slugToLastMessage.size} people`);

  // 3b. read custom connection locations
  const connectionLocationsText = readFileSync(
    resolve("/Users/rami/Documents/life-os/network/custom-data/connection_locations.csv"),
    "utf-8"
  );
  const connectionLocations = parseCSV(connectionLocationsText);
  const nameToLocation: Map<string, string> = new Map();
  for (const row of connectionLocations) {
    const normalizedName = normalizePersonName(row["Name"]);
    const location = (row["Location"] ?? "").trim();
    if (!normalizedName || !location || location.toLowerCase() === "unknown") continue;
    if (!nameToLocation.has(normalizedName)) {
      nameToLocation.set(normalizedName, location);
    }
  }
  console.log(`  Connection locations indexed: ${nameToLocation.size}`);

  function findLocationForPerson(personNames: Array<string | null | undefined>): string | null {
    for (const personName of personNames) {
      const normalized = normalizePersonName(personName);
      if (!normalized) continue;
      const location = nameToLocation.get(normalized);
      if (location) return location;
    }
    return null;
  }

  // 4. build people index from all guests across all events
  const peopleIndex: Map<string, PersonSummary> = new Map();
  const personEventMap: Map<string, Set<string>> = new Map();

  for (const event of lumaEvents) {
    const auth = event.authenticated ?? {};
    const gl = auth.guest_list ?? {};
    const guests: any[] = gl.guests ?? [];

    for (const g of guests) {
      const raw = g.raw ?? g;
      const apiId = raw.api_id ?? g.api_id;
      if (!apiId) continue;

      if (!personEventMap.has(apiId)) {
        personEventMap.set(apiId, new Set());
      }
      personEventMap.get(apiId)!.add(event.luma_event_id);

      if (!peopleIndex.has(apiId)) {
        const linkedinHandle = raw.linkedin_handle ?? null;
        const slug = extractLinkedInSlug(linkedinHandle);
        const conn = slug ? slugToConnection.get(slug) : null;
        const lastMsg = slug ? slugToLastMessage.get(slug) : null;

        peopleIndex.set(apiId, {
          api_id: apiId,
          name: raw.name ?? g.name ?? "",
          location: findLocationForPerson([
            raw.name ?? g.name ?? "",
            conn ? `${conn.firstName} ${conn.lastName}` : null,
          ]),
          bio: raw.bio_short ?? null,
          avatar_url: raw.avatar_url ?? g.avatar_url ?? null,
          linkedin_slug: slug,
          linkedin_url: slug ? `https://www.linkedin.com/in/${slug}` : null,
          twitter: raw.twitter_handle ?? g.social?.twitter ?? null,
          instagram: raw.instagram_handle ?? g.social?.instagram ?? null,
          website: raw.website ?? g.social?.website ?? null,
          is_your_connection: !!conn,
          events_attending: [], // filled later
          last_messaged: lastMsg ?? null,
          linkedin_company: conn?.company ?? null,
          linkedin_position: conn?.position ?? null,
        });
      }
    }

    // also index hosts and featured guests
    for (const h of auth.hosts ?? []) {
      const raw = h.raw ?? h;
      const apiId = raw.api_id ?? h.api_id;
      if (apiId && !peopleIndex.has(apiId)) {
        const linkedinHandle = raw.linkedin_handle ?? null;
        const slug = extractLinkedInSlug(linkedinHandle);
        const conn = slug ? slugToConnection.get(slug) : null;
        const lastMsg = slug ? slugToLastMessage.get(slug) : null;
        peopleIndex.set(apiId, {
          api_id: apiId,
          name: raw.name ?? h.name ?? "",
          location: findLocationForPerson([
            raw.name ?? h.name ?? "",
            conn ? `${conn.firstName} ${conn.lastName}` : null,
          ]),
          bio: raw.bio_short ?? null,
          avatar_url: raw.avatar_url ?? h.avatar_url ?? null,
          linkedin_slug: slug,
          linkedin_url: slug ? `https://www.linkedin.com/in/${slug}` : null,
          twitter: raw.twitter_handle ?? h.social?.twitter ?? null,
          instagram: raw.instagram_handle ?? h.social?.instagram ?? null,
          website: raw.website ?? h.social?.website ?? null,
          is_your_connection: !!conn,
          events_attending: [],
          last_messaged: lastMsg ?? null,
          linkedin_company: conn?.company ?? null,
          linkedin_position: conn?.position ?? null,
        });
      }
    }
  }

  // fill events_attending
  for (const [apiId, eventIds] of personEventMap) {
    const person = peopleIndex.get(apiId);
    if (person) {
      person.events_attending = [...eventIds];
    }
  }

  console.log(`  People indexed: ${peopleIndex.size}`);
  const warmCount = [...peopleIndex.values()].filter((p) => p.is_your_connection).length;
  console.log(`  Warm connections: ${warmCount}`);

  // identify super connectors (3+ events)
  const superConnectorIds = new Set<string>();
  for (const [apiId, person] of peopleIndex) {
    if (person.events_attending.length >= 3) {
      superConnectorIds.add(apiId);
    }
  }
  console.log(`  Super connectors (3+ events): ${superConnectorIds.size}`);

  // 5. build enriched events with conflicts and serendipity scores
  // first detect conflicts
  interface EventTimeInfo {
    id: string;
    start_utc: string;
    end_utc: string;
  }
  const eventTimes: EventTimeInfo[] = lumaEvents.map((e: any) => ({
    id: e.luma_event_id,
    start_utc: e.time?.start_utc ?? "",
    end_utc: e.time?.end_utc ?? "",
  }));

  const conflictMap: Map<string, string[]> = new Map();
  for (let i = 0; i < eventTimes.length; i++) {
    const conflicts: string[] = [];
    for (let j = 0; j < eventTimes.length; j++) {
      if (i === j) continue;
      if (timeOverlaps(eventTimes[i], eventTimes[j])) {
        conflicts.push(eventTimes[j].id);
      }
    }
    conflictMap.set(eventTimes[i].id, conflicts);
  }

  // assign conflict groups via union-find
  const conflictGroupMap: Map<string, number> = new Map();
  let nextGroup = 0;
  const visited = new Set<string>();
  for (const et of eventTimes) {
    if (visited.has(et.id)) continue;
    const conflicts = conflictMap.get(et.id) ?? [];
    if (conflicts.length === 0) continue;

    const group = nextGroup++;
    const queue = [et.id];
    while (queue.length > 0) {
      const current = queue.pop()!;
      if (visited.has(current)) continue;
      visited.add(current);
      conflictGroupMap.set(current, group);
      for (const c of conflictMap.get(current) ?? []) {
        if (!visited.has(c)) queue.push(c);
      }
    }
  }

  // build enriched events grouped by day
  const dayMap: Map<string, EnrichedEvent[]> = new Map();

  for (const e of lumaEvents) {
    const eventId = e.luma_event_id;
    const auth = e.authenticated ?? {};
    const gl = auth.guest_list ?? {};
    const guests: any[] = gl.guests ?? [];
    const guestApiIds = guests.map((g: any) => g.raw?.api_id ?? g.api_id).filter(Boolean);

    // find warm connections at this event
    const warmHere: string[] = [];
    for (const gid of guestApiIds) {
      const person = peopleIndex.get(gid);
      if (person?.is_your_connection) warmHere.push(gid);
    }

    // find super connectors at this event
    const scHere: string[] = [];
    for (const gid of guestApiIds) {
      if (superConnectorIds.has(gid)) scHere.push(gid);
    }

    // guest quality
    const withLinkedin = guestApiIds.filter((gid: string) => peopleIndex.get(gid)?.linkedin_slug).length;
    const withBio = guestApiIds.filter((gid: string) => peopleIndex.get(gid)?.bio).length;
    const totalGuests = guestApiIds.length;
    const pctLinkedin = totalGuests > 0 ? withLinkedin / totalGuests : 0;
    const pctBio = totalGuests > 0 ? withBio / totalGuests : 0;
    const guestQualityPct = pctLinkedin * 0.6 + pctBio * 0.4;

    // topic relevance
    const descText = e.description ?? "";
    const bioText = guests.map((g: any) => (g.raw?.bio_short ?? "")).join(" ");
    const relevanceInput = descText + " " + bioText;

    const isAvailable = gl.available === true;

    // score components
    const warmScore = Math.min(warmHere.length / 5, 1.0) * 100;
    const volumeScore = Math.min(totalGuests / 300, 1.0) * 100;
    const qualityScore = guestQualityPct * 100;
    const connectorScore = Math.min(scHere.length / 3, 1.0) * 100;
    const relevanceScore = computeRelevanceScore(relevanceInput);

    let score = warmScore * 0.30 + volumeScore * 0.20 + qualityScore * 0.20 + connectorScore * 0.15 + relevanceScore * 0.15;

    // cap score for hidden guest lists
    if (!isAvailable) {
      // still give partial score from description relevance and hosts
      const hostBios = (auth.hosts ?? []).map((h: any) => h.raw?.bio_short ?? "").join(" ");
      const partialRelevance = computeRelevanceScore(descText + " " + hostBios);
      score = Math.min(partialRelevance * 0.4, 40);
    }

    score = Math.round(score * 10) / 10;

    // build host PersonSummary references
    const hostSummaries: PersonSummary[] = (auth.hosts ?? []).map((h: any) => {
      const raw = h.raw ?? h;
      const apiId = raw.api_id ?? h.api_id;
      return peopleIndex.get(apiId) ?? {
        api_id: apiId ?? "",
        name: raw.name ?? h.name ?? "",
        location: null,
        bio: raw.bio_short ?? null,
        avatar_url: raw.avatar_url ?? h.avatar_url ?? null,
        linkedin_slug: null,
        linkedin_url: null,
        twitter: null,
        instagram: null,
        website: null,
        is_your_connection: false,
        events_attending: [],
        last_messaged: null,
        linkedin_company: null,
        linkedin_position: null,
      };
    });

    const featuredSummaries: PersonSummary[] = (auth.featured_guests ?? []).map((fg: any) => {
      const raw = fg.raw ?? fg;
      const apiId = raw.api_id ?? fg.api_id;
      return peopleIndex.get(apiId) ?? {
        api_id: apiId ?? "",
        name: raw.name ?? fg.name ?? "",
        location: null,
        bio: raw.bio_short ?? null,
        avatar_url: raw.avatar_url ?? fg.avatar_url ?? null,
        linkedin_slug: null,
        linkedin_url: null,
        twitter: null,
        instagram: null,
        website: null,
        is_your_connection: false,
        events_attending: [],
        last_messaged: null,
        linkedin_company: null,
        linkedin_position: null,
      };
    });

    const startUtc = e.time?.start_utc ?? "";
    const date = startUtc.slice(0, 10);

    const enriched: EnrichedEvent = {
      id: eventId,
      title: e.title ?? "",
      slug: e.slug ?? "",
      url: e.url ?? "",
      description: e.description ?? "",
      time: {
        start_utc: startUtc,
        end_utc: e.time?.end_utc ?? "",
        start_local: e.time?.start_toronto ?? "",
        end_local: e.time?.end_toronto ?? "",
        duration_minutes: e.time?.duration_minutes ?? 0,
      },
      location: e.location ? { address: e.location.address ?? "", city: e.location.city ?? "" } : null,
      organizer: e.organizer?.name ?? "",
      hosts: hostSummaries,
      featured_guests: featuredSummaries,
      rsvp_status: e.rami_rsvp_status_inferred ?? "unknown",
      guest_list: isAvailable
        ? {
            available: true,
            hidden_reason: null,
            total_count: gl.total_count ?? totalGuests,
            guests: guestApiIds,
          }
        : {
            available: false,
            hidden_reason: gl.hidden_reason ?? "unknown",
            total_count: 0,
            guests: [],
          },
      serendipity: {
        score,
        warm_connections: warmHere,
        super_connectors: scHere,
        guest_quality_pct: Math.round(guestQualityPct * 1000) / 10,
        breakdown: {
          warm: Math.round(warmScore * 10) / 10,
          volume: Math.round(volumeScore * 10) / 10,
          quality: Math.round(qualityScore * 10) / 10,
          connectors: Math.round(connectorScore * 10) / 10,
          relevance: Math.round(relevanceScore * 10) / 10,
        },
      },
      conflicts: conflictMap.get(eventId) ?? [],
      conflict_group: conflictGroupMap.get(eventId) ?? null,
    };

    if (!dayMap.has(date)) dayMap.set(date, []);
    dayMap.get(date)!.push(enriched);
  }

  // sort days and events within days
  const sortedDates = [...dayMap.keys()].sort();
  const days: DaySchedule[] = sortedDates.map((date, i) => {
    const events = dayMap.get(date)!.sort((a, b) => a.time.start_utc.localeCompare(b.time.start_utc));
    const d = new Date(date + "T12:00:00Z");
    const dayName = d.toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric" });
    return {
      date,
      label: `${dayName} — Day ${i + 1}`,
      events,
    };
  });

  // build final output
  const peopleObj: Record<string, PersonSummary> = {};
  for (const [id, person] of peopleIndex) {
    peopleObj[id] = person;
  }

  const guestListsAvailable = lumaEvents.filter((e: any) => e.authenticated?.guest_list?.available).length;

  const output: DashboardData = {
    generated_at: new Date().toISOString(),
    user: { name: lumaUser.name ?? "Rami", api_id: lumaUser.api_id ?? "" },
    days,
    people: peopleObj,
    stats: {
      total_events: lumaEvents.length,
      total_days: sortedDates.length,
      total_unique_guests: peopleIndex.size,
      total_warm_connections: warmCount,
      guest_lists_available: guestListsAvailable,
      guest_lists_hidden: lumaEvents.length - guestListsAvailable,
    },
  };

  const outPath = resolve(import.meta.dir, "dashboard.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2));
  console.log(`\nWrote ${outPath}`);
  console.log(`  File size: ${(readFileSync(outPath).length / 1024 / 1024).toFixed(2)} MB`);

  // summary
  const allScores = days.flatMap((d) => d.events.map((e) => e.serendipity.score));
  console.log(`\n=== Summary ===`);
  console.log(`  Events: ${output.stats.total_events}`);
  console.log(`  Days: ${output.stats.total_days}`);
  console.log(`  Unique guests: ${output.stats.total_unique_guests}`);
  console.log(`  Warm connections: ${output.stats.total_warm_connections}`);
  console.log(`  Guest lists: ${output.stats.guest_lists_available} available, ${output.stats.guest_lists_hidden} hidden`);
  console.log(`  Score range: ${Math.min(...allScores)} - ${Math.max(...allScores)}`);
  console.log(`  Top 5 events by score:`);
  const ranked = days.flatMap((d) => d.events).sort((a, b) => b.serendipity.score - a.serendipity.score);
  for (const e of ranked.slice(0, 5)) {
    console.log(`    ${e.serendipity.score} - ${e.title.slice(0, 50)} (${e.serendipity.warm_connections.length} connections)`);
  }
}

main();
