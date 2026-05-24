import { describe, expect, it } from "vitest";
import { mapApprovalToRsvp } from "../../src/luma/api.js";

describe("mapApprovalToRsvp", () => {
  it.each([
    [null, "TRANSPARENT", "interested"],
    [null, "OPAQUE", "unknown"],
    [{ approval_status: "approved" }, "OPAQUE", "going"],
    [{ approval_status: "pending_approval" }, "OPAQUE", "pending_approval"],
    [{ approval_status: "waitlist" }, "OPAQUE", "waitlisted"],
    [{ approval_status: "declined" }, "OPAQUE", "declined"],
    [{ approval_status: "invited" }, "OPAQUE", "not_going"],
    [{ approval_status: "new_value" }, "OPAQUE", "unknown"],
  ])("maps %#", (guestData, transparency, expected) => {
    expect(mapApprovalToRsvp(guestData, transparency)).toBe(expected);
  });
});
