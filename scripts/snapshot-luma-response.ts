import { writeFile } from "node:fs/promises";
import { defaultProfileDir, LumaSession } from "../src/luma/session.js";

const eventId = process.env.LUMA_TEST_EVENT_ID;
const out = process.env.LUMA_SNAPSHOT_OUT ?? "/tmp/luma-event-response.json";

if (!eventId) {
  console.error("set LUMA_TEST_EVENT_ID");
  process.exit(1);
}

const session = new LumaSession(process.env.LUMA_PROFILE_DIR ?? defaultProfileDir());

try {
  const raw = await session.getJson(`https://api.lu.ma/event/get?event_api_id=${eventId}`);
  await writeFile(out, `${JSON.stringify(raw, null, 2)}\n`, "utf8");
  console.log(`wrote ${out}`);
} finally {
  await session.close();
}
