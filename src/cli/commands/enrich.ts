import { type EnrichOptions, enrich } from "../../enricher/index.js";
import { writeOutput } from "../../output/writer.js";
import { ExitCode } from "../../util/exit-codes.js";
import { createLogger, type LogLevelMode } from "../../util/logger.js";

export type EnrichCommandOptions = LogLevelMode &
  Omit<EnrichOptions, "logger"> & {
    out: string;
  };

export async function runEnrich(options: EnrichCommandOptions): Promise<void> {
  const logger = createLogger(options);
  const output = await enrich({ ...options, logger });
  const result = await writeOutput(options.out, output);

  console.log(
    `Done. ${output.summary.total_events} events, ${output.run_diagnostics.errors.length} errors, ` +
      `${output.summary.guest_lists_retrieved} guest lists fetched.`,
  );
  console.log(`Wrote ${options.out}.`);

  if (!result.valid) {
    for (const error of result.errors) console.error(error);
    process.exitCode = ExitCode.schemaInvalid;
  }
}
