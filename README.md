# Luma Enricher

Bun-managed TypeScript CLI for enriching a personal Luma ICS feed with authenticated Luma event data.

## Setup

```bash
bun install
bun run build
```

The install step runs `bunx playwright install chromium` so the persistent browser profile uses a reproducible Chromium build.

## Commands

```bash
bun run src/cli/index.ts login
bun run src/cli/index.ts whoami
bun run src/cli/index.ts doctor --ics /Users/rami/Downloads/Luma.ics
bun run src/cli/index.ts enrich --ics /Users/rami/Downloads/Luma.ics --out /tmp/luma-enriched.json
```

After `bun run build`, the compiled CLI entrypoint is `dist/src/cli/index.js`.

## Authentication

`login` opens a visible Chromium window and persists the session to `~/.luma-enricher/profile` by default. Override that path with `--profile-dir`.

That profile directory contains a live Luma session and should be treated like a password. The tool creates and repairs it with `0700` permissions and never logs cookies, tokens, or session keys.

## Endpoint Verification

Before relying on live Luma enrichment, run:

```bash
LUMA_TEST_EVENT_ID=evt-your-event-id bun run scripts/verify-endpoints.ts
```

The current implementation uses these endpoints:

- `GET https://api.lu.ma/user/get-current-user`
- `GET https://api.lu.ma/event/get?event_api_id=<event_api_id>`
- `GET https://api.lu.ma/event/get-guests?event_api_id=<event_api_id>&pagination_limit=50`

If Luma changes response shapes, update `src/luma/api.ts` transformers and the tests before changing the output contract.

## Testing

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

Generated JSON contains event attendee data returned by Luma, including names, avatars, and social handles when available. Treat output files as confidential.
