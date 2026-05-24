# Luma Calendar Enrichment Service — Implementation Spec

**Version:** 1.0
**Author:** Drafted with Rami for hand-off to implementing engineer
**Target stack:** TypeScript + Playwright (Node.js)
**Delivery:** CLI tool, designed as a library underneath so a web frontend can wrap it later

---

## 1. Executive summary

Build a CLI that takes a user's personal Luma ICS feed URL, authenticates as that user via a persistent Playwright browser profile, and produces a single enriched JSON document containing:

- All events from the ICS feed (filterable by date window)
- For each event: the user's **personal RSVP status** (Going / Waitlisted / Pending Approval / Declined / Not Going)
- For each event: the **public attendee list** when the host has it enabled, plus aggregated attendee counts
- All useful event metadata Luma exposes to a logged-in user (capacity, spots remaining, ticket types, hosts with social handles, featured guests, etc.)

The auth strategy is "log in once through a real browser, persist the session profile to disk." Every later run reuses the same profile, no re-login. If the session does expire, the CLI gives a clear prompt and a `login` command to reopen the browser for manual re-auth.

The output JSON shape is a strict superset of the v0 file Rami already has — existing fields stay, new authenticated fields slot in beside them. A future web frontend will read this JSON.

## 2. Goals and non-goals

### Goals (v1)

- Read any Luma personal ICS URL passed as input.
- Parse all VEVENT entries, filter by an optional date window.
- For each event, fetch the authenticated event detail and (where available) the guest list.
- Produce a single JSON output file with deterministic schema (versioned).
- Persist the Luma session in a Playwright user-data-dir so the same login carries across CLI invocations and across server restarts.
- Surface a clear distinction in the output between data from the ICS, data from Luma's authenticated API, and data inferred by the tool.
- Exit non-zero with a helpful message if auth is missing or expired.

### Non-goals (v1)

- No web UI. (That comes later and reads the JSON this tool emits.)
- No multi-user support. One CLI install = one Luma account profile. (Multi-profile support is a v1.5 add.)
- No write operations to Luma (no RSVPing, no event creation, no cancellations).
- No long-running daemon. Each invocation is a discrete run.
- No bypassing of Luma anti-bot measures. If Luma blocks the session, the tool surfaces it and exits.
- No paid Luma API integration. This tool exists specifically to avoid that.

## 3. Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│  CLI (yargs/commander)                                              │
│  Commands: login, whoami, enrich, doctor                            │
└─────┬───────────────────────────────────────────────────────────────┘
      │
      ▼
┌──────────────┐   ┌──────────────────┐   ┌────────────────────────┐
│  ics-fetcher │──▶│  ics-parser      │──▶│  event-resolver        │
│  fetch URL   │   │  → Event[]       │   │  derive slug, api_id   │
└──────────────┘   └──────────────────┘   └────────────┬───────────┘
                                                       │
                                                       ▼
┌──────────────────────────────────────────────────────────────────┐
│  luma-client (the auth-bearing layer)                            │
│                                                                  │
│  ┌──────────────────────┐   ┌────────────────────────────────┐  │
│  │ session-manager      │   │ api-client                     │  │
│  │  - launches Chromium │──▶│  - uses context.request        │  │
│  │  - persistent ctx    │   │  - cookies attach automatically│  │
│  │  - login flow        │   │  - retry + backoff             │  │
│  └──────────────────────┘   └────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
                                                       │
                                                       ▼
                                          ┌──────────────────────┐
                                          │  enricher            │
                                          │  joins ICS + API     │
                                          │  → EnrichedEvent[]   │
                                          └──────────┬───────────┘
                                                     ▼
                                          ┌──────────────────────┐
                                          │  json-writer         │
                                          │  → output.json       │
                                          └──────────────────────┘
```

### Module responsibilities

| Module | Responsibility |
|---|---|
| `cli/` | Argument parsing, command routing, human-readable stdout |
| `ics/fetcher.ts` | HTTP GET the ICS URL with sane timeouts and User-Agent |
| `ics/parser.ts` | Pure-function ICS parser (use `node-ical` or `ical.js`); unfold lines, extract VEVENT fields including non-standard `X-` properties |
| `ics/resolve.ts` | From a parsed VEVENT, derive: `event_api_id` (the `evt-XXX@events.lu.ma` UID), `slug` (from DESCRIPTION URL), `calendar_pk` |
| `luma/session.ts` | Owns the persistent Playwright context; exposes `getContext()`, `isAuthenticated()`, `runInteractiveLogin()` |
| `luma/api.ts` | Typed wrappers around each Luma endpoint we call; throws typed errors |
| `luma/types.ts` | TypeScript interfaces matching Luma's JSON responses (see §8) |
| `enricher/index.ts` | The join: takes parsed events + API client, returns enriched events with provenance tags |
| `output/schema.ts` | Output JSON schema definition (Zod) — also used for validation |
| `output/writer.ts` | Writes the final JSON, pretty-printed, with stable key ordering |
| `tests/` | Unit + integration + smoke tests (see §15) |

## 4. Authentication approach

### Why persistent context

Playwright's `chromium.launchPersistentContext(userDataDir, options)` gives us a real Chrome user profile saved to disk. Cookies, localStorage, IndexedDB, service workers — all persist across runs. This is exactly the "log in once, stay logged in" experience the user wants, and it survives server restarts because the profile lives in a regular filesystem directory.

### Profile location

Default: `~/.luma-enricher/profile` (or `$LUMA_ENRICHER_HOME/profile` if set).
Override via `--profile-dir <path>` on any command.
The directory should be created with `0700` permissions (owner-only).

### Login flow (`luma-enricher login`)

1. Launch persistent context with `headless: false`. This MUST be visible — the user needs to interact with the email OTP flow.
2. Navigate to `https://luma.com/signin`.
3. Print to stdout:
   > A browser window has opened. Sign in to Luma, then return to this terminal.
   > Press Enter once you see your Luma home page.
4. Wait for either: (a) the user pressing Enter, or (b) successful navigation to `https://luma.com/home` (whichever first). Use `page.waitForURL` with a 5-minute timeout.
5. Verify auth by calling `https://api.lu.ma/user/get-current-user` through `context.request.get(...)`. A 200 with a non-null `user.api_id` confirms success.
6. Print the resolved user (name + email) so the user knows the session is correct.
7. Close the browser. The profile is persisted to disk.

### Authenticated API calls

After `login`, all later commands reuse the persistent context in **headless mode**. We make API calls via `context.request.get(...)` — this is a Playwright API that issues HTTP requests using the context's cookie jar but without opening a page. It's faster than navigating in a page and avoids loading any UI assets.

Cookies of interest (Luma may rename these; verify by inspecting the browser):
- `luma.auth-session-key` (primary session cookie)
- `__cf_bm` (Cloudflare bot management — preserve verbatim)

### Auth expiry handling

Before any enrichment run, call `whoami` internally. If it returns 401 / null, the CLI exits with code `2` and prints:

> Your Luma session has expired. Run `luma-enricher login` to refresh.

This must NOT happen silently — never partially scrape and silently fail.

### What if Luma changes the login URL or flow?

This is a known fragility. The `login` command should tolerate any starting URL on luma.com — it watches for the `luma.auth-session-key` cookie to appear regardless of which page the user logs in from.

## 5. Input specification

### CLI input

```
luma-enricher enrich \
  --ics <ICS_URL_OR_FILE_PATH> \
  --out <OUTPUT_JSON_PATH> \
  [--from <ISO_DATE>] \
  [--to <ISO_DATE>] \
  [--include-past] \
  [--profile-dir <PATH>] \
  [--max-concurrency <N>] \
  [--rate-limit-ms <MS>] \
  [--skip-guest-list] \
  [--dry-run]
```

| Flag | Default | Meaning |
|---|---|---|
| `--ics` | required | URL like `http://api2.luma.com/ics/get?entity=user&id=icssk-...` OR a local `.ics` path |
| `--out` | required | Output JSON path; parent dir created if missing |
| `--from` | none | Only include events with `start_at >= from`. ISO-8601. |
| `--to` | none | Only include events with `start_at < to`. ISO-8601. |
| `--include-past` | false | If neither `--from` nor `--to` set, default to `now` onward. This flag overrides. |
| `--profile-dir` | `~/.luma-enricher/profile` | Where the persistent browser profile lives |
| `--max-concurrency` | `3` | How many event API calls in flight at once |
| `--rate-limit-ms` | `400` | Minimum delay between API calls (per worker) |
| `--skip-guest-list` | false | Skip the guest-list endpoint (faster runs when only RSVP status is needed) |
| `--dry-run` | false | Parse ICS, list what would be fetched, do not call Luma's API |

### ICS feed assumptions

- The feed is `text/calendar; charset=utf-8`.
- Lines may be folded (continuation lines start with a space). The parser MUST unfold first.
- The relevant fields per VEVENT:
  - `UID` — format `evt-XXXXXXX@events.lu.ma`. Strip `@events.lu.ma` to get `event_api_id`.
  - `DTSTART` / `DTEND` — UTC, format `YYYYMMDDTHHMMSSZ`.
  - `SUMMARY` — event title.
  - `DESCRIPTION` — contains a `https://luma.com/<slug>?pk=<calendar_pk>` URL on the first line. Extract slug + pk.
  - `LOCATION` — address string OR a `https://luma.com/join/...` URL for virtual events.
  - `GEO` — `lat;lon`, optional.
  - `ORGANIZER` — `CN="Name":MAILTO:calendar-invite@lu.ma` (the email is always the same; name is what we want).
  - `STATUS` — usually `TENTATIVE`; not a reliable RSVP indicator.
  - `TRANSP` — when `TRANSPARENT`, the user marked "Interested" rather than RSVPing.

## 6. Output specification

Top-level shape (full JSON Schema in §8):

```jsonc
{
  "schema_version": "1.0",
  "generated_at_utc": "2026-05-23T18:34:12Z",
  "source": {
    "ics_url": "http://api2.luma.com/ics/get?entity=user&id=icssk-...",
    "ics_etag": "...",                  // if returned, for cache validation
    "ics_fetched_at_utc": "..."
  },
  "user": {
    "api_id": "usr-...",                // from /user/get-current-user
    "name": "Rami Maalouf",
    "email": "rami@example.com",
    "username": "..."
  },
  "window": {
    "from_utc": "2026-05-25T00:00:00Z",
    "to_utc":   "2026-06-01T06:00:00Z"
  },
  "summary": {
    "total_events": 33,
    "events_by_day_count": { "Monday 2026-05-25": 8, ... },
    "by_rsvp_status": {
      "going": 28,
      "waitlisted": 3,
      "pending_approval": 1,
      "interested_only": 1
    },
    "guest_lists_retrieved": 18,
    "guest_lists_hidden_by_host": 14,
    "events_user_is_hosting": 0
  },
  "run_diagnostics": {
    "auth_method": "persistent_playwright_context",
    "auth_verified_at_utc": "...",
    "endpoints_called": { "/user/get-current-user": 1, "/event/get": 33, "/event/get-guests": 18 },
    "errors": [
      { "event_api_id": "evt-...", "endpoint": "/event/get-guests", "status": 403, "message": "guest list hidden" }
    ],
    "warnings": []
  },
  "events": [ /* EnrichedEvent[] — see below */ ]
}
```

### EnrichedEvent shape

Each event is the v0 shape (Rami's existing JSON) plus a new `authenticated` block. Existing fields keep their names so the future frontend doesn't need to re-map anything.

```jsonc
{
  "luma_event_id": "evt-N4cugDK8G6gzJOL",
  "title": "Toronto Tech Week Kickoff Party, ...",
  "url": "https://luma.com/ttwkickoffparty",
  "slug": "ttwkickoffparty",
  "calendar_pk": "g-6WXWBr6lVTZWBtw",

  "time": { /* unchanged from v0 */ },
  "organizer": { /* unchanged */ },
  "location": { /* unchanged */ },
  "description": "...",
  "ics_status": "TENTATIVE",
  "ics_transparency": "OPAQUE",

  // NEW — replaces the speculative rami_rsvp_status_inferred block
  "authenticated": {
    "fetched_at_utc": "2026-05-23T18:34:30Z",
    "rsvp": {
      "status": "going",   // enum: going | waitlisted | pending_approval | declined | not_going | interested | unknown
      "ticket_type": "General Admission",
      "approval_status": "approved",        // raw value from Luma
      "registered_at_utc": "2026-05-10T14:22:00Z",
      "checked_in": false,
      "checked_in_at_utc": null
    },
    "event": {
      "is_user_host": false,
      "is_user_co_host": false,
      "capacity": 250,
      "spots_remaining": 12,
      "is_near_capacity": true,
      "is_sold_out": false,
      "waitlist_active": true,
      "require_approval": false,
      "is_free": true,
      "price_cents": null,
      "currency": null
    },
    "hosts": [
      {
        "api_id": "usr-...",
        "name": "Georgian",
        "username": "georgian",
        "avatar_url": "...",
        "is_verified": true,
        "social": {
          "twitter": "georgianio",
          "linkedin": "/company/georgian-io",
          "instagram": null,
          "website": "https://georgian.io"
        }
      }
    ],
    "featured_guests": [ /* same shape as hosts */ ],
    "guest_list": {
      "available": true,                    // false if host hides it OR endpoint errored
      "hidden_reason": null,                // e.g. "host_disabled" | "fetch_error_403"
      "total_count": 247,
      "going_count": 230,
      "waitlist_count": 17,
      "guests": [                           // ordered as Luma returns them
        {
          "api_id": "usr-...",
          "name": "Jane Doe",
          "username": "janedoe",
          "avatar_url": "...",
          "approval_status": "approved",
          "registered_at_utc": "...",
          "social": { /* same shape as hosts */ }
        }
      ],
      "guests_truncated": false,            // true if we hit a pagination cap
      "pagination_cap": null                // the cap if truncated
    }
  },

  // v0 fields preserved for back-compat:
  "public_event_status": { /* what we used to show, now degrades to "deprecated_use_authenticated" */ }
}
```

A field is OMITTED (not set to `null`) when the API didn't return it. Use `null` only when Luma explicitly returned null. This distinction matters for the frontend.

## 7. Pipeline / data flow

End-to-end for a single `enrich` invocation:

1. **Validate args.** Reject impossible windows, unreadable paths, etc.
2. **Verify auth.** Hit `GET /user/get-current-user`. On 401, exit 2 with the login hint.
3. **Fetch ICS.** GET the URL with `Accept: text/calendar`, 30s timeout, follow up to 3 redirects. Cache the body to `<profile-dir>/cache/last.ics` for debugging.
4. **Parse ICS.** Yield typed `ParsedEvent[]`.
5. **Filter by window.** Default `from=now`, no upper bound, unless flags set it.
6. **Resolve event identifiers.** Compute `event_api_id`, `slug`, `calendar_pk` for each.
7. **Build the work queue.** One job per event.
8. **Worker pool.** `--max-concurrency` workers consume the queue. Each worker:
   - GETs `/event/get?event_api_id=evt-XXX` → event detail + the user's RSVP info
   - If `event.show_guest_list === true` AND `--skip-guest-list` is not set, GET the guests endpoint with pagination
   - Sleeps `--rate-limit-ms` between calls (per worker)
   - Catches errors per event; never aborts the whole run for one bad event
9. **Merge.** Build `EnrichedEvent[]` from ICS data + API data.
10. **Validate output against Zod schema.** If validation fails, write the file with `schema_version: "1.0-INVALID"` and exit 3.
11. **Write JSON.** Pretty-printed, UTF-8, trailing newline.
12. **Print summary.** Counts, errors, duration. Exit 0.

Logging: structured (pino), to stderr by default. `--verbose` ups level to debug. The JSON output to stdout is never polluted by logs.

## 8. Luma endpoint reference

**Important caveat for the implementer:** these endpoints are inferred from Luma's URL conventions and what their web app appears to call. **Verify each one before implementing** by opening Luma in Chrome, opening DevTools → Network, filtering to `api.lu.ma`, and observing what gets called when you view an event, the guest list, etc. Document any discrepancies in the PR.

The values shown for response fields are the names this spec uses internally — the Luma response may use slightly different keys, in which case the `luma/types.ts` interfaces and `luma/api.ts` transformers handle the mapping.

### `GET /user/get-current-user`
- **Purpose:** auth verification + identifying the user
- **Auth:** session cookie required
- **Response:** `{ user: { api_id, name, email, username, ... } }`
- **Error modes:** 401 if logged out; 5xx if Luma is down

### `GET /event/get?event_api_id=evt-XXX`
- **Purpose:** full event detail, including the calling user's `guest_data`
- **Auth:** session cookie required
- **Notable response fields:**
  - `event` — the event itself (name, start_at, end_at, location, capacity, etc.)
  - `hosts` — array of host profiles with social handles
  - `featured_guests` — array
  - `ticket_info` — `{ is_free, is_sold_out, is_near_capacity, spots_remaining, require_approval, price, ... }`
  - `guest_data` — **the key field for our purpose**: `{ approval_status, ticket_key, payment_status, ... }`. This is the calling user's RSVP record. When null, the user hasn't RSVPd (means they probably marked Interested only).
  - `event.show_guest_list` — boolean controlling whether to attempt the guests endpoint
  - `event.waitlist_status` — `"disabled" | "enabled"`
  - `role` — `null | "host" | "co_host" | "manager"` for the calling user
- **Error modes:** 404 if event was deleted; 403 if user lost access

### `GET /event/get-guests?event_api_id=evt-XXX&pagination_limit=50&pagination_cursor=<cursor>`
- **Purpose:** paginated public guest list (when host enabled it)
- **Auth:** session cookie required
- **Pagination:** cursor-based. Response includes `has_more` and `next_cursor`. Stop when `has_more === false` OR after `MAX_PAGES = 40` (2000 guests cap — configurable).
- **Notable response fields per guest:** `api_id`, `name`, `username`, `avatar_url`, `approval_status` (only `approved` usually visible to non-hosts), social handles
- **Error modes:** 403 means "guest list hidden by host" — log and mark `guest_list.available = false`, do not retry

### `GET /calendar/get-items?calendar_api_id=...` (optional, future)
- **Purpose:** Luma's own list view of a calendar
- **Use case for v1:** discovery/debugging only — useful for the `doctor` command to cross-check that ICS and API agree on event count
- **Skip in main pipeline unless ICS parsing is unreliable**

### Mapping Luma's `approval_status` to our `rsvp.status` enum

| Luma `guest_data` shape                                 | Our `rsvp.status` |
|---|---|
| `null` AND ICS has `TRANSP:TRANSPARENT`                 | `interested` |
| `null` AND ICS does not have TRANSP                     | `unknown` |
| `{ approval_status: "approved" }`                       | `going` |
| `{ approval_status: "pending_approval" }`               | `pending_approval` |
| `{ approval_status: "waitlist" }`                       | `waitlisted` |
| `{ approval_status: "declined" }`                       | `declined` |
| `{ approval_status: "invited" }` (no response)          | `not_going` |
| anything else                                           | `unknown` (log warning, include raw value in `rsvp.approval_status`) |

This mapping table MUST live in `luma/api.ts` as a single source of truth, with the raw Luma value preserved in the output for forensics.

## 9. CLI interface

```
luma-enricher <command> [options]

Commands:
  login           Open a browser to sign in to Luma. Persists session to profile dir.
  whoami          Print the currently authenticated user (or exit 2 if not auth'd).
  enrich          Run the full ICS-to-enriched-JSON pipeline.
  doctor          Diagnostic checks: profile dir, auth, network, endpoint reachability.
  logout          Delete the persistent profile (with confirmation prompt).

Global options:
  --profile-dir <path>   Persistent profile location (default: ~/.luma-enricher/profile)
  --verbose, -v          Debug logging
  --quiet, -q            Errors only
  --json-logs            Logs to stderr as JSON lines (for piping into observability)
  --version              Print version
  --help, -h             Help
```

### Command-specific options

`enrich` options: as listed in §5.

`doctor` options: `--check <name>` to run a single check. Available checks: `profile`, `auth`, `network`, `endpoints`, `ics`. Default: all.

### Exit codes

| Code | Meaning |
|---|---|
| 0 | Success |
| 1 | Generic error (bad args, file I/O) |
| 2 | Auth required (run `login`) |
| 3 | Output schema validation failed |
| 4 | Luma API returned 5xx repeatedly (their problem) |
| 5 | Rate-limited / blocked by Luma (back off and retry later) |
| 6 | Network failure (DNS, timeout, TLS) |
| 130 | Interrupted (Ctrl-C) — partial output flushed if possible |

## 10. Project structure

```
luma-enricher/
├── package.json
├── tsconfig.json
├── biome.json                      # or eslint+prettier
├── README.md
├── SPEC.md                         # this document
├── src/
│   ├── cli/
│   │   ├── index.ts                # entrypoint, command routing
│   │   ├── commands/
│   │   │   ├── login.ts
│   │   │   ├── whoami.ts
│   │   │   ├── enrich.ts
│   │   │   ├── doctor.ts
│   │   │   └── logout.ts
│   │   └── output.ts               # stdout/stderr helpers, colors
│   ├── ics/
│   │   ├── fetcher.ts
│   │   ├── parser.ts
│   │   └── resolve.ts
│   ├── luma/
│   │   ├── session.ts              # persistent Playwright context
│   │   ├── api.ts                  # typed endpoint wrappers
│   │   ├── types.ts                # Zod schemas + inferred TS types
│   │   └── errors.ts               # typed error classes (AuthExpiredError, etc.)
│   ├── enricher/
│   │   ├── index.ts                # orchestrator
│   │   ├── worker-pool.ts          # concurrency control
│   │   └── merge.ts                # ICS + API → EnrichedEvent
│   ├── output/
│   │   ├── schema.ts               # output JSON schema (Zod)
│   │   └── writer.ts
│   ├── util/
│   │   ├── rate-limiter.ts
│   │   ├── retry.ts                # exponential backoff w/ jitter
│   │   └── logger.ts               # pino setup
│   └── index.ts                    # library entrypoint (for future web frontend)
├── tests/
│   ├── unit/
│   │   ├── ics-parser.test.ts
│   │   ├── rsvp-mapping.test.ts
│   │   ├── output-schema.test.ts
│   │   └── retry.test.ts
│   ├── integration/
│   │   ├── ics-fetch.test.ts       # hits real ICS URL (sample feed)
│   │   └── luma-api-mocked.test.ts # MSW-mocked Luma responses
│   ├── e2e/
│   │   ├── enrich.smoke.test.ts    # requires real auth; opt-in via env
│   │   └── auth-flow.test.ts
│   └── fixtures/
│       ├── sample.ics              # 5-event ICS for parser tests
│       ├── luma-get-event.json     # canned API responses
│       ├── luma-get-guests-p1.json
│       └── luma-get-guests-p2.json
└── scripts/
    ├── verify-endpoints.ts         # one-shot script to probe & document Luma endpoints
    └── snapshot-luma-response.ts   # capture a real Luma response for fixtures
```

## 11. Tech stack and dependencies

| Concern | Choice | Notes |
|---|---|---|
| Runtime | Node.js >= 20 LTS | for `fetch`, `Object.groupBy`, etc. |
| Language | TypeScript 5.x, strict mode | `"strict": true`, `"noUncheckedIndexedAccess": true` |
| Browser | Playwright `chromium` channel | `chromium` (not `chrome`) for reproducibility |
| CLI | `commander` or `yargs` | implementer's pick |
| HTTP for ICS | native `fetch` | no axios dependency |
| ICS parsing | `node-ical` | well-tested; if it pulls too much, hand-roll a parser |
| Schema validation | `zod` | one library for both `luma/types.ts` and `output/schema.ts` |
| Logging | `pino` + `pino-pretty` | structured, fast |
| Concurrency | hand-rolled worker pool over `Promise` | tiny, no extra dep |
| Tests | `vitest` | unit + integration |
| API mocking | `msw` (Node) | for `integration/luma-api-mocked.test.ts` |
| Lint/format | `biome` | one tool, fast |

Pin Playwright to a specific version in `package.json` and check in the Chromium revision via `npx playwright install chromium` in a postinstall script.

## 12. Key implementation details

### Persistent context lifecycle

```ts
// src/luma/session.ts (sketch)
import { chromium, type BrowserContext } from 'playwright';
import path from 'node:path';
import { mkdir, chmod } from 'node:fs/promises';

export class LumaSession {
  private ctx: BrowserContext | null = null;

  constructor(private profileDir: string) {}

  async open({ headless }: { headless: boolean }): Promise<BrowserContext> {
    if (this.ctx) return this.ctx;
    await mkdir(this.profileDir, { recursive: true, mode: 0o700 });
    await chmod(this.profileDir, 0o700);

    this.ctx = await chromium.launchPersistentContext(this.profileDir, {
      headless,
      viewport: { width: 1280, height: 800 },
      userAgent:
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 13_0) ' +
        'AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      // Match a typical real browser fingerprint; don't lie blatantly.
    });
    return this.ctx;
  }

  async close() {
    await this.ctx?.close();
    this.ctx = null;
  }

  /** Authenticated GET that returns parsed JSON. Throws AuthExpiredError on 401. */
  async getJson<T>(url: string): Promise<T> {
    const ctx = await this.open({ headless: true });
    const res = await ctx.request.get(url, {
      headers: { Accept: 'application/json' },
      timeout: 20_000,
    });
    if (res.status() === 401) throw new AuthExpiredError();
    if (!res.ok()) throw new LumaApiError(res.status(), await res.text());
    return res.json() as Promise<T>;
  }
}
```

### Worker pool with rate limit

A simple async semaphore is enough. Per-worker rate limit means each worker waits N ms between its own calls, not globally — easier to reason about and gives `concurrency * (1000/rate)` global throughput.

### Retry policy

- Retry on: `5xx`, `429`, network errors (ECONNRESET, ETIMEDOUT)
- Do NOT retry on: `401` (re-auth needed), `403` (permission, won't change), `404` (gone, won't change)
- Backoff: `400ms * 2^attempt` with full jitter, max 4 attempts
- Respect `Retry-After` header if present on `429`

### Schema-first output

The output schema lives in `output/schema.ts` as Zod schemas. Every JSON write goes through `schema.parse(obj)` first. This catches drift between what the code produces and the documented shape.

```ts
// src/output/schema.ts (sketch)
import { z } from 'zod';

export const RsvpStatus = z.enum([
  'going', 'waitlisted', 'pending_approval', 'declined',
  'not_going', 'interested', 'unknown'
]);

export const AuthenticatedBlock = z.object({
  fetched_at_utc: z.string().datetime(),
  rsvp: z.object({
    status: RsvpStatus,
    ticket_type: z.string().nullable(),
    approval_status: z.string().nullable(),
    registered_at_utc: z.string().datetime().nullable(),
    checked_in: z.boolean(),
    checked_in_at_utc: z.string().datetime().nullable(),
  }),
  event: z.object({ /* ... */ }),
  hosts: z.array(/* HostSchema */),
  featured_guests: z.array(/* GuestSchema */),
  guest_list: z.object({ /* ... */ }),
});

export const EnrichedEvent = z.object({
  // ... all v0 fields preserved
  authenticated: AuthenticatedBlock.optional(),
});

export const Output = z.object({
  schema_version: z.literal('1.0'),
  generated_at_utc: z.string().datetime(),
  // ... etc
});
```

## 13. Error handling and resilience

| Class | When | Behavior |
|---|---|---|
| `AuthExpiredError` | API call returns 401 | Abort the whole run, exit 2 |
| `LumaApiError` | API returns 4xx/5xx other than 401 | Recorded per-event in `run_diagnostics.errors`, continue |
| `GuestListHiddenError` | Guest endpoint returns 403 | `guest_list.available = false`, `hidden_reason = "host_disabled"` |
| `RateLimitedError` | Repeated 429s | Exit 5 with timestamp of last successful call so the user knows when to try again |
| `IcsParseError` | Malformed ICS | Exit 1 with the byte offset of the failure |
| `NetworkError` | Connection failure | Retry per policy; exit 6 if exhausted |
| `OutputSchemaError` | Zod validation fails | Write file with `schema_version: "1.0-INVALID"`, exit 3 |

Every error path writes to `run_diagnostics.errors` so the output JSON itself documents what went wrong. Partial output is better than no output.

## 14. Rate limiting and politeness

- Default concurrency: 3. Default delay per worker: 400ms. → ~7 RPS sustained, which is conservative for a logged-in user browsing.
- Set a recognizable User-Agent: `luma-enricher/1.0 (+https://github.com/rami/luma-enricher) Chromium/120`.
- Honor `Retry-After` on 429.
- If three consecutive 429s arrive across all workers, abort with exit code 5.
- Do not parallelize across multiple Luma accounts (out of scope; would also look like abuse).
- No automated re-runs from inside the tool — the user invokes when needed.

## 15. Testing and validation strategy

This is what Rami asked about specifically. The strategy has four layers; each layer is independently runnable so the user can validate quickly during development.

### Layer 1 — `luma-enricher doctor` (built into the tool)

A first-class CLI command, not just a test. Runs five checks and prints a colored pass/fail for each:

1. **`profile`** — does `<profile-dir>` exist? Is it readable/writable by the current user? Is it the right shape (contains `Default/`, `Cookies` SQLite, etc.)?
2. **`auth`** — open the persistent context headlessly, GET `/user/get-current-user`. Pass = 200 with a user object. Print the user's name + email.
3. **`network`** — DNS resolve `api.lu.ma`, `luma.com`, `api2.luma.com`. TCP connect to each on 443. TLS handshake.
4. **`endpoints`** — for each endpoint in §8, send a probe request (with a known good event ID, configured via `LUMA_TEST_EVENT_ID`). Record status, response time, response shape (keys present). Useful for spotting when Luma changes their API.
5. **`ics`** — fetch the configured ICS URL, parse it, report the count of events and the date range.

Output format (each check):
```
[PASS] auth         User: Rami Maalouf <rami@example.com>           (412ms)
[FAIL] endpoints    /event/get-guests returned 403 (host disabled)  (820ms)
[WARN] ics          Feed has 0 events in the next 7 days
```

Exit 0 if all PASS, 1 if any FAIL, 0 with warnings if only WARN.

This is the user's main "is this thing connected" tool. Run it after `login`, run it before any `enrich`, run it whenever something feels off.

### Layer 2 — Unit tests

| Test file | What it covers |
|---|---|
| `ics-parser.test.ts` | Parser handles folded lines, escaped commas, GEO with no value, missing optional fields, UTF-8, etc. Uses fixture `sample.ics`. |
| `rsvp-mapping.test.ts` | Every row of the table in §8 → produces the expected enum. Includes "unknown" passthrough. |
| `output-schema.test.ts` | Valid output passes Zod; mutated outputs fail with clear errors. |
| `retry.test.ts` | Backoff math, jitter bounds, Retry-After honored, 4xx not retried. |

Run with `vitest`. Should be < 1s total. No network, no browser.

### Layer 3 — Integration tests (mocked Luma)

Uses MSW to stand up a fake Luma. Tests:

- `enrich` against a 5-event mock calendar produces the expected output JSON byte-for-byte (snapshot test).
- Auth expiry mid-run: third event returns 401 → run aborts with exit 2, partial output flushed with errors recorded.
- Guest list 403: marked correctly in output.
- Pagination: 3 pages of 50 guests each = 150 guests in output, `guests_truncated: false`.
- Pagination cap: configure `MAX_PAGES = 2`, get 100 guests + `guests_truncated: true`.
- Rate limit: 429 → backoff → success.

These can run in CI without any Luma access.

### Layer 4 — End-to-end smoke (real Luma, opt-in)

Gated behind `LUMA_E2E=1`. Implementer should NOT run these in CI by default — they require a real account. Rami runs them locally after development.

The fixture is a tiny dedicated test calendar — Rami creates a Luma calendar with 2-3 events he hosts (so he controls them and can guarantee they exist), gets its ICS URL, and sets `LUMA_E2E_ICS=...` in his env. The smoke test:

1. Runs `whoami` — must succeed.
2. Runs `enrich --ics $LUMA_E2E_ICS --out /tmp/smoke.json`.
3. Asserts:
   - Output validates against schema.
   - `summary.total_events` matches what's actually in the calendar.
   - For at least one event the user is hosting, `authenticated.event.is_user_host === true`.
   - For at least one event the user has RSVPd to, `authenticated.rsvp.status === "going"`.
   - At least one `authenticated.guest_list.available === true` exists.

### Manual validation checklist for Rami

After the implementer ships, this is the checklist Rami runs to convince himself it works:

1. `luma-enricher login` — browser opens, log in with email OTP, terminal confirms session captured.
2. `luma-enricher whoami` — prints your name and email.
3. `luma-enricher doctor` — all checks PASS.
4. **Stop the terminal. Reopen it. Run `whoami` again.** The session must still work — this is the persistence test.
5. `luma-enricher enrich --ics <your-personal-ICS-URL> --from 2026-05-25 --to 2026-06-01 --out /tmp/test.json` — produces the JSON.
6. Open `/tmp/test.json` and verify by spot-check:
   - At least one event has `rsvp.status: "going"` and you can confirm in the Luma app that you really are Going.
   - For an event you know is full / has a waitlist, `rsvp.status: "waitlisted"` or `event.is_sold_out: true`.
   - For an event whose host hides the guest list (try the BetaKit one), `guest_list.available: false` with `hidden_reason: "host_disabled"`.
   - For a public event, `guest_list.guests` has names you recognize.
7. **Restart the server / reboot the machine. Repeat steps 2-5 without re-running login.** Session must persist.
8. Wait until session naturally expires (or delete `Cookies` from the profile). `enrich` exits 2 with the login hint. Run `login`. `enrich` works again.

If steps 1-8 all pass, the service works.

## 16. Security and privacy

- The persistent profile contains the user's full Luma session. **Treat it like a password.** Document this loudly in the README.
- File permissions on the profile dir: `0700`. The tool must verify and fix this on every run.
- Never log cookies, session keys, or full event payloads at default log level.
- `--verbose` may log payloads BUT must redact `email`, `phone_number`, and any key matching `/cookie|token|session/i`.
- No telemetry, no analytics, no calling home. The tool only contacts: the configured ICS URL host, `api.lu.ma`, `luma.com` (for login).
- Output JSON contains attendee names, avatars, and sometimes social handles — Rami should understand he's responsible for how he stores and shares this file. Add a one-line privacy note to the JSON: `"_notice": "This file contains attendee data from Luma. Treat as confidential."`
- If Luma's ToS explicitly prohibits this kind of scraping, surface that in the README. (As of writing, Luma's ToS prohibits "automated means" but the tool is for the user's own data, single-user, low-volume. Not legal advice; the user runs at their own risk.)

## 17. Future considerations (out of scope for v1)

These shape v1 just enough that v2 doesn't require rewrites:

- **Web frontend.** The JSON output is the contract. The frontend reads JSON, doesn't talk to Luma directly. Implementer should expose the library (`src/index.ts`) cleanly so a Next.js app can import `enrich(icsUrl, sessionDir)` directly.
- **Incremental sync.** v1 always fetches fresh. v2 can cache by `event_api_id + Last-Modified` and skip unchanged events. Design the output to include `authenticated.fetched_at_utc` to enable this.
- **Multi-profile.** v2: `--profile foo` selects between `~/.luma-enricher/profiles/foo/`, `~/.luma-enricher/profiles/bar/`.
- **Diff mode.** `luma-enricher enrich --diff-against /tmp/prev.json` outputs only the events whose `authenticated` block changed.
- **Webhook on RSVP change.** Watch a calendar, fire a webhook when someone moves from waitlist to going.

## 18. Acceptance criteria for v1

The PR/delivery is accepted when:

1. All commands in §9 work and produce the documented exit codes.
2. `luma-enricher doctor` reports PASS on all five checks against a real authenticated session.
3. All unit tests pass; all integration tests pass; the e2e smoke (opt-in) passes against Rami's test calendar.
4. Rami's manual checklist (§15) passes end-to-end.
5. Output JSON validates against the Zod schema for both Rami's full personal feed AND a minimal 1-event feed.
6. The persistent profile genuinely persists across at least one reboot (verified manually).
7. README explains: install, first-time login, daily use, troubleshooting (especially "session expired"), profile dir security.
8. `scripts/verify-endpoints.ts` exists and was used to confirm or correct the §8 endpoint reference. The actual endpoints used are documented in the README.

---

## Appendix A — Sample command session

```
$ npm i -g luma-enricher
$ luma-enricher login
A browser window has opened. Sign in to Luma, then return to this terminal.
Press Enter once you see your Luma home page.
[Enter]
Session captured. Signed in as Rami Maalouf <rami@example.com>.
Profile saved to /Users/rami/.luma-enricher/profile.

$ luma-enricher doctor
[PASS] profile      /Users/rami/.luma-enricher/profile (0700)
[PASS] auth         Rami Maalouf <rami@example.com>           (398ms)
[PASS] network      api.lu.ma, luma.com, api2.luma.com all reachable
[PASS] endpoints    /event/get OK, /event/get-guests OK
[PASS] ics          33 events, 2026-05-25 → 2026-05-30
All checks passed.

$ luma-enricher enrich \
    --ics 'http://api2.luma.com/ics/get?entity=user&id=icssk-ghqCqiQpNNWIRQ3' \
    --from 2026-05-25 --to 2026-06-01 \
    --out ~/ttw-enriched.json
Fetching ICS... 33 events found.
Auth OK as Rami Maalouf.
Enriching 33 events (concurrency=3, rate=400ms/worker)...
  [30/33] Toronto Open Source Meetup — going (guests: 247)
  [33/33] UMMAHCON — interested (no RSVP)
Done in 18s. 33 enriched, 0 errors, 14 guest lists fetched, 19 hidden by host.
Wrote /Users/rami/ttw-enriched.json (412 KB).

$ luma-enricher whoami
Rami Maalouf <rami@example.com>
Profile: /Users/rami/.luma-enricher/profile
Last auth verified: 2026-05-23T18:34:30Z
```

## Appendix B — Glossary

| Term | Meaning |
|---|---|
| **ICS** | iCalendar (RFC 5545), the `text/calendar` format Luma exports |
| **`event_api_id`** | Luma's internal event identifier, format `evt-XXXXX...` |
| **`calendar_pk`** | A short hash on Luma URLs after `?pk=`, used to scope a personal view of an event |
| **`slug`** | The human-readable path segment in `luma.com/<slug>` |
| **Persistent context** | Playwright's `launchPersistentContext` — a browser with a user-data-dir on disk |
| **Guest list "hidden"** | Host has toggled "Show Guest List" off in event settings; the API returns 403 |
| **TRANSP:TRANSPARENT** | ICS property meaning "this event doesn't block my time" — in Luma's case, the user marked Interested rather than RSVPing |
