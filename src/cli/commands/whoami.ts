import { LumaApiClient } from "../../luma/api.js";
import { defaultProfileDir, LumaSession } from "../../luma/session.js";
import type { LumaCurrentUser } from "../../luma/types.js";

export type WhoamiOptions = {
  profileDir?: string | undefined;
};

export async function getCurrentUser(options: WhoamiOptions = {}): Promise<LumaCurrentUser> {
  const session = new LumaSession(options.profileDir ?? defaultProfileDir());
  try {
    const api = new LumaApiClient(session);
    return await api.getCurrentUser();
  } finally {
    await session.close();
  }
}

export async function runWhoami(options: WhoamiOptions = {}): Promise<void> {
  const profileDir = options.profileDir ?? defaultProfileDir();
  const user = await getCurrentUser({ profileDir });
  console.log(`${user.name ?? "Unknown"} <${user.email ?? "no email"}>`);
  console.log(`Profile: ${profileDir}`);
}
