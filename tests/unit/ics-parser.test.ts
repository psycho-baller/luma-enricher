import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";
import { parseIcsCalendar, unfoldLines } from "../../src/ics/parser.js";

describe("parseIcsCalendar", () => {
  it("parses folded Luma events and resolves identifiers", async () => {
    const input = await readFile(new URL("../fixtures/sample.ics", import.meta.url), "utf8");
    const parsed = parseIcsCalendar(input);

    expect(parsed.calendar_name).toBe("Luma");
    expect(parsed.events).toHaveLength(3);
    expect(parsed.events[0]).toMatchObject({
      luma_event_id: "evt-testGoing",
      slug: "education-ai",
      calendar_pk: "g-testCalendar",
      organizer: {
        name: "Land to Innovate",
        luma_email: "calendar-invite@lu.ma",
      },
      location: {
        city: "North York, ON",
        geo_lat: 43.7615,
        geo_lon: -79.3491,
      },
    });
  });

  it("unfolds continuation lines before parsing values", async () => {
    const input = await readFile(new URL("../fixtures/sample.ics", import.meta.url), "utf8");
    const unfolded = unfoldLines(input);

    expect(unfolded.some((line) => line.includes("foldedcontinuation"))).toBe(true);
  });
});
