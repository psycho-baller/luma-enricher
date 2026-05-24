import { mkdtemp } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { enrich } from "../../src/enricher/index.js";
import { AuthExpiredError, LumaApiError, RateLimitedError } from "../../src/luma/errors.js";
import type { LumaRequester } from "../../src/luma/requester.js";
import eventFixture from "../fixtures/luma-get-event.json" with { type: "json" };
import guestsPageOne from "../fixtures/luma-get-guests-p1.json" with { type: "json" };
import guestsPageTwo from "../fixtures/luma-get-guests-p2.json" with { type: "json" };

class MockRequester implements LumaRequester {
  calls: string[] = [];
  failAuth = false;
  failFirstEventWithRateLimit = false;
  private rateLimitThrown = false;

  async getJson<T>(url: string): Promise<T> {
    this.calls.push(url);
    const parsed = new URL(url);

    if (parsed.pathname === "/event/get") {
      const eventId = parsed.searchParams.get("event_api_id");
      if (this.failFirstEventWithRateLimit && !this.rateLimitThrown) {
        this.rateLimitThrown = true;
        throw new RateLimitedError({ message: "slow down", retryAfterMs: 1 });
      }
      if (eventId === "evt-testGoing") return eventFixture as T;
      if (eventId === "evt-testInterested") {
        return {
          event: { api_id: eventId, show_guest_list: false },
          ticket_info: { is_free: true },
          guest_data: null,
          role: null,
          hosts: [],
          featured_guests: [],
        } as T;
      }
      if (eventId === "evt-testHidden") {
        return {
          event: { api_id: eventId, show_guest_list: true },
          ticket_info: { is_free: true },
          guest_data: { approval_status: "pending_approval" },
          role: "host",
          hosts: [],
          featured_guests: [],
        } as T;
      }
    }

    if (parsed.pathname === "/event/get-guests" || parsed.pathname === "/event/get-guest-list") {
      const eventId = parsed.searchParams.get("event_api_id");
      if (eventId === "evt-testHidden") {
        throw new LumaApiError({ status: 403, message: "hidden" });
      }
      return (parsed.searchParams.has("pagination_cursor") ? guestsPageTwo : guestsPageOne) as T;
    }

    throw new Error(`unexpected URL ${url}`);
  }

  async postJson<T>(url: string, body?: unknown): Promise<T> {
    this.calls.push(url);
    const parsed = new URL(url);

    if (parsed.pathname === "/ping") {
      if (this.failAuth) throw new AuthExpiredError();
      return {
        user: {
          api_id: "usr-rami",
          name: "Rami Maalouf",
          email: "rami@example.com",
          username: "rami",
        },
      } as T;
    }

    throw new Error(`unexpected POST URL ${url}`);
  }
}

describe("enrich with mocked Luma", () => {
  it("builds enriched output with guest pagination and hidden guest lists", async () => {
    const requester = new MockRequester();
    const output = await enrich({
      ics: fixturePath(),
      includePast: true,
      profileDir: await tempProfile(),
      requester,
      apiOptions: { baseUrl: "https://api.test" },
      rateLimitMs: 0,
    });

    expect(output.user?.api_id).toBe("usr-rami");
    expect(output.summary.total_events).toBe(3);
    expect(output.summary.guest_lists_retrieved).toBe(1);
    expect(output.summary.guest_lists_hidden_by_host).toBe(2);
    expect(output.summary.events_user_is_hosting).toBe(1);

    const going = output.events.find((event) => event.luma_event_id === "evt-testGoing");
    expect(going?.authenticated?.rsvp.status).toBe("going");
    expect(going?.authenticated?.guest_list.guests).toHaveLength(2);

    const interested = output.events.find((event) => event.luma_event_id === "evt-testInterested");
    expect(interested?.authenticated?.rsvp.status).toBe("interested");

    const hidden = output.events.find((event) => event.luma_event_id === "evt-testHidden");
    expect(hidden?.authenticated?.guest_list.hidden_reason).toBe("host_disabled");
  });

  it("aborts when auth is expired before enrichment", async () => {
    const requester = new MockRequester();
    requester.failAuth = true;

    await expect(
      enrich({
        ics: fixturePath(),
        includePast: true,
        profileDir: await tempProfile(),
        requester,
        apiOptions: { baseUrl: "https://api.test" },
      }),
    ).rejects.toBeInstanceOf(AuthExpiredError);
  });

  it("marks guest pagination as truncated when the cap is hit", async () => {
    const output = await enrich({
      ics: fixturePath(),
      includePast: true,
      profileDir: await tempProfile(),
      requester: new MockRequester(),
      apiOptions: { baseUrl: "https://api.test", maxGuestPages: 1, paginationLimit: 1 },
      rateLimitMs: 0,
    });

    const going = output.events.find((event) => event.luma_event_id === "evt-testGoing");
    expect(going?.authenticated?.guest_list.guests_truncated).toBe(true);
    expect(going?.authenticated?.guest_list.pagination_cap).toBe(1);
  });

  it("retries a rate-limited event detail call", async () => {
    const requester = new MockRequester();
    requester.failFirstEventWithRateLimit = true;

    const output = await enrich({
      ics: fixturePath(),
      includePast: true,
      profileDir: await tempProfile(),
      requester,
      apiOptions: { baseUrl: "https://api.test" },
      rateLimitMs: 0,
    });

    expect(output.summary.total_events).toBe(3);
    expect(requester.calls.filter((url) => url.includes("/event/get?")).length).toBeGreaterThan(3);
  });
});

function fixturePath(): string {
  return new URL("../fixtures/sample.ics", import.meta.url).pathname;
}

async function tempProfile(): Promise<string> {
  return mkdtemp(join(tmpdir(), "luma-enricher-test-"));
}
