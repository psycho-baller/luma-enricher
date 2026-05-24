# Luma Enricher

TypeScript CLI for enriching your personal Luma ICS feed with authenticated event data, plus a React dashboard to explore the results.

## End-to-end quickstart

This is the shortest full run from fresh clone to seeing your own data in the dashboard.

```bash
# 1) install CLI deps
cd luma-enricher
bun install

# 2) login once (opens browser)
bun run src/cli/index.ts login

# 3) confirm session + connectivity
bun run src/cli/index.ts doctor --ics "https://api2.luma.com/ics/get?entity=user&id=icssk-..."

# 4) generate enriched output
bun run src/cli/index.ts enrich \
  --ics "https://api2.luma.com/ics/get?entity=user&id=icssk-..." \
  --out /tmp/luma-enriched.json

# 5) install dashboard deps
cd dashboard
bun install

# 6) build dashboard data from your enriched output
bun run build:data \
  --enriched /tmp/luma-enriched.json \
  --connections ../../linkedin-data-export/Connections.csv \
  --messages ../../linkedin-data-export/messages.csv \
  --out ./src/data/dashboard.json

# 7) run dashboard
bun run dev
```

Open the local URL printed by Vite (usually `http://localhost:5173`).

## Prerequisites

- macOS/Linux terminal access
- Bun 1.0+ (`bun --version`)
- Node.js 20+ (`node --version`)
- A personal Luma ICS URL or local `.ics` file
- LinkedIn export files:
  - `linkedin-data-export/Connections.csv` (required)
  - `linkedin-data-export/messages.csv` (required)
  - `custom-data/connection_locations.csv` (optional)

## CLI setup and usage

From `luma-enricher/`:

```bash
bun install
bun run build
```

The install step runs `bunx playwright install chromium` so the persistent browser profile uses a reproducible Chromium build.

### Core commands

```bash
bun run src/cli/index.ts login
bun run src/cli/index.ts whoami
bun run src/cli/index.ts doctor --ics /absolute/path/to/Luma.ics
bun run src/cli/index.ts enrich --ics /absolute/path/to/Luma.ics --out /tmp/luma-enriched.json
```

After `bun run build`, the compiled entrypoint is `dist/src/cli/index.js`.

## Dashboard data build flow

From `luma-enricher/dashboard/`:

```bash
bun run build:data --help
```

Supported options:
- `--enriched <path>`: output from `luma-enricher enrich`
- `--connections <path>`: LinkedIn `Connections.csv`
- `--messages <path>`: LinkedIn `messages.csv`
- `--locations <path>`: optional location mapping CSV
- `--out <path>`: output JSON (default: `src/data/dashboard.json`)

Env var fallbacks are also supported:
- `LUMA_ENRICHED_JSON`
- `LINKEDIN_CONNECTIONS_CSV`
- `LINKEDIN_MESSAGES_CSV`
- `CONNECTION_LOCATIONS_CSV`
- `DASHBOARD_DATA_OUT`

`--locations` is optional. If that file is missing, build continues without location enrichment.

## Authentication details

`login` opens a visible Chromium window and persists the session to `~/.luma-enricher/profile` by default. Override with `--profile-dir`.

That profile directory contains a live Luma session and should be treated like a password. The tool creates and repairs it with `0700` permissions and never logs cookies, tokens, or session keys.

## Endpoint verification

Before relying on enrichment in production, run:

```bash
LUMA_TEST_EVENT_ID=evt-your-event-id bun run scripts/verify-endpoints.ts
```

The CLI currently relies on:
- `GET https://api.lu.ma/user/get-current-user`
- `GET https://api.lu.ma/event/get?event_api_id=<event_api_id>`
- `GET https://api.lu.ma/event/get-guests?event_api_id=<event_api_id>&pagination_limit=50`

If Luma changes response shapes, update `src/luma/api.ts` transformers and tests before changing the output contract.

## Testing

From `luma-enricher/`:

```bash
bun run typecheck
bun run test
bun run lint
```

Real Luma smoke tests are manual and opt-in:

```bash
LUMA_E2E=1 LUMA_E2E_ICS='https://api2.luma.com/ics/get?...' bun run test tests/e2e
```

## Privacy

Generated JSON includes attendee data (names, avatars, social handles). Treat all output files as confidential.
