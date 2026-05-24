#!/usr/bin/env node
import { Command } from "commander";
import { AuthExpiredError, NetworkError, RateLimitedError } from "../luma/errors.js";
import { defaultProfileDir } from "../luma/session.js";
import { ExitCode } from "../util/exit-codes.js";
import { runDoctor } from "./commands/doctor.js";
import { runEnrich } from "./commands/enrich.js";
import { runLogin } from "./commands/login.js";
import { runLogout } from "./commands/logout.js";
import { runWhoami } from "./commands/whoami.js";

const program = new Command();

program
  .name("luma-enricher")
  .description("Enrich a personal Luma ICS feed with authenticated Luma data.")
  .version("0.1.0")
  .option("--profile-dir <path>", "persistent browser profile directory", defaultProfileDir())
  .option("--verbose, -v", "debug logging")
  .option("--quiet, -q", "errors only")
  .option("--json-logs", "write logs as JSON lines to stderr");

program
  .command("login")
  .description("Open a browser to sign in to Luma.")
  .action((_options: unknown, command: Command) =>
    runAction(() => runLogin(globalOptions(command))),
  );

program
  .command("whoami")
  .description("Print the currently authenticated Luma user.")
  .action((_options: unknown, command: Command) =>
    runAction(() => runWhoami(globalOptions(command))),
  );

program
  .command("enrich")
  .description("Run the full ICS-to-enriched-JSON pipeline.")
  .requiredOption("--ics <url-or-file>", "Luma ICS URL or local .ics path")
  .requiredOption("--out <path>", "output JSON path")
  .option("--from <iso-date>", "include events with start_at >= this date")
  .option("--to <iso-date>", "include events with start_at < this date")
  .option("--include-past", "include past events when no --from is set")
  .option("--max-concurrency <number>", "event API calls in flight", parseInteger, 3)
  .option("--rate-limit-ms <number>", "delay between API calls per worker", parseInteger, 400)
  .option("--skip-guest-list", "skip guest-list fetching")
  .option("--dry-run", "parse ICS and build output without calling Luma API")
  .action((options: Record<string, unknown>, command: Command) =>
    runAction(() =>
      runEnrich({
        ...globalOptions(command),
        ics: String(options.ics),
        out: String(options.out),
        from: optionalString(options.from),
        to: optionalString(options.to),
        includePast: Boolean(options.includePast),
        maxConcurrency: Number(options.maxConcurrency),
        rateLimitMs: Number(options.rateLimitMs),
        skipGuestList: Boolean(options.skipGuestList),
        dryRun: Boolean(options.dryRun),
      }),
    ),
  );

program
  .command("doctor")
  .description("Run diagnostic checks.")
  .option("--check <name>", "run one check: profile, auth, network, endpoints, ics")
  .option("--ics <url-or-file>", "ICS feed to validate")
  .action((options: Record<string, unknown>, command: Command) =>
    runAction(() =>
      runDoctor({
        ...globalOptions(command),
        check: optionalString(options.check),
        ics: optionalString(options.ics),
      }),
    ),
  );

program
  .command("logout")
  .description("Delete the persistent Luma profile.")
  .option("--yes", "skip confirmation prompt")
  .action((options: Record<string, unknown>, command: Command) =>
    runAction(() =>
      runLogout({
        ...globalOptions(command),
        yes: Boolean(options.yes),
      }),
    ),
  );

await program.parseAsync(process.argv);

function globalOptions(command: Command): {
  profileDir: string;
  verbose?: boolean | undefined;
  quiet?: boolean | undefined;
  jsonLogs?: boolean | undefined;
} {
  const opts = command.optsWithGlobals() as Record<string, unknown>;
  return {
    profileDir: String(opts.profileDir),
    verbose: Boolean(opts.verbose),
    quiet: Boolean(opts.quiet),
    jsonLogs: Boolean(opts.jsonLogs),
  };
}

async function runAction(fn: () => Promise<void>): Promise<void> {
  try {
    await fn();
  } catch (error) {
    if (error instanceof AuthExpiredError) {
      console.error(error.message);
      process.exitCode = ExitCode.authRequired;
      return;
    }
    if (error instanceof RateLimitedError) {
      console.error(error.message);
      process.exitCode = ExitCode.rateLimited;
      return;
    }
    if (error instanceof NetworkError) {
      console.error(error.message);
      process.exitCode = ExitCode.networkFailure;
      return;
    }
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = ExitCode.generic;
  }
}

function parseInteger(value: string): number {
  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 0) {
    throw new Error(`expected a non-negative integer, got ${value}`);
  }
  return parsed;
}

function optionalString(value: unknown): string | undefined {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}
