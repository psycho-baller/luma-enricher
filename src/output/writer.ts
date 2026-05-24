import { writeFile } from "node:fs/promises";
import { ensureParentDirectory } from "../util/fs.js";
import { type EnrichedOutput, OutputSchema } from "./schema.js";

export type WriteOutputResult = {
  valid: boolean;
  errors: string[];
};

export async function writeOutput(
  path: string,
  output: EnrichedOutput,
): Promise<WriteOutputResult> {
  await ensureParentDirectory(path);
  const parsed = OutputSchema.safeParse(output);
  if (parsed.success) {
    await writeFile(path, `${JSON.stringify(output, null, 2)}\n`, "utf8");
    return { valid: true, errors: [] };
  }

  const invalidOutput = {
    ...output,
    schema_version: "1.0-INVALID",
    run_diagnostics: {
      ...output.run_diagnostics,
      errors: [
        ...output.run_diagnostics.errors,
        {
          message: `output schema validation failed: ${parsed.error.message}`,
        },
      ],
    },
  };
  await writeFile(path, `${JSON.stringify(invalidOutput, null, 2)}\n`, "utf8");

  return {
    valid: false,
    errors: parsed.error.issues.map((issue) => `${issue.path.join(".")}: ${issue.message}`),
  };
}
