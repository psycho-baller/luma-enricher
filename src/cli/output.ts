export type CheckStatus = "PASS" | "WARN" | "FAIL";

export type CheckResult = {
  status: CheckStatus;
  name: string;
  message: string;
  durationMs: number;
};

export function printCheck(result: CheckResult): void {
  const label = `[${result.status}]`.padEnd(7);
  const name = result.name.padEnd(12);
  console.log(`${label} ${name} ${result.message} (${result.durationMs}ms)`);
}

export async function timedCheck(
  name: string,
  fn: () => Promise<Omit<CheckResult, "name" | "durationMs">>,
): Promise<CheckResult> {
  const start = Date.now();
  try {
    const result = await fn();
    return {
      ...result,
      name,
      durationMs: Date.now() - start,
    };
  } catch (error) {
    return {
      status: "FAIL",
      name,
      message: error instanceof Error ? error.message : String(error),
      durationMs: Date.now() - start,
    };
  }
}
