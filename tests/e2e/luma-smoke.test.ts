import { describe, expect, it } from "vitest";
import { getCurrentUser } from "../../src/cli/commands/whoami.js";
import { enrich } from "../../src/enricher/index.js";

const run = process.env.LUMA_E2E === "1";

describe.skipIf(!run)("real Luma smoke", () => {
  it("verifies auth and enriches the configured ICS feed", async () => {
    const ics = process.env.LUMA_E2E_ICS;
    expect(ics).toBeTruthy();

    const user = await getCurrentUser();
    expect(user.api_id).toMatch(/^usr-/);

    const output = await enrich({
      ics: ics as string,
      from: process.env.LUMA_E2E_FROM,
      to: process.env.LUMA_E2E_TO,
      includePast: Boolean(process.env.LUMA_E2E_INCLUDE_PAST),
      maxConcurrency: 1,
      rateLimitMs: 500,
    });

    expect(output.user?.api_id).toBe(user.api_id);
    expect(output.events.length).toBeGreaterThan(0);
    expect(output.events.some((event) => Boolean(event.authenticated))).toBe(true);
  });
});
