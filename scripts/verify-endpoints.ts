import { LumaApiClient } from "../src/luma/api.js";
import { defaultProfileDir, LumaSession } from "../src/luma/session.js";

const profileDir = process.env.LUMA_PROFILE_DIR ?? defaultProfileDir();
const eventId = process.env.LUMA_TEST_EVENT_ID;
const session = new LumaSession(profileDir);
const api = new LumaApiClient(session);

try {
  const user = await api.getCurrentUser();
  console.log(
    `[PASS] /user/get-current-user: ${user.name ?? "Unknown"} <${user.email ?? "no email"}>`,
  );

  if (!eventId) {
    console.log("[WARN] set LUMA_TEST_EVENT_ID to verify /event/get and /event/get-guests");
    process.exit(0);
  }

  const event = await api.getEvent(eventId);
  console.log(`[PASS] /event/get: keys=${Object.keys(event.event).sort().join(",")}`);

  try {
    const guests = await api.getGuests(eventId);
    console.log(`[PASS] /event/get-guests: guests=${guests.guests.length}`);
  } catch (error) {
    const status =
      typeof error === "object" && error !== null
        ? (error as { status?: number }).status
        : undefined;
    if (status === 403) {
      console.log("[WARN] /event/get-guests returned 403. The test event likely hides guests.");
    } else {
      throw error;
    }
  }
} finally {
  await session.close();
}
