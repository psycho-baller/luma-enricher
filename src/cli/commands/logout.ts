import { rm } from "node:fs/promises";
import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { defaultProfileDir } from "../../luma/session.js";

export type LogoutOptions = {
  profileDir?: string | undefined;
  yes?: boolean | undefined;
};

export async function runLogout(options: LogoutOptions = {}): Promise<void> {
  const profileDir = options.profileDir ?? defaultProfileDir();
  if (!options.yes) {
    const rl = createInterface({ input, output });
    const answer = await rl.question(
      `Delete Luma profile at ${profileDir}? Type "yes" to confirm: `,
    );
    rl.close();
    if (answer !== "yes") {
      console.log("Logout cancelled.");
      return;
    }
  }

  await rm(profileDir, { recursive: true, force: true });
  console.log(`Deleted ${profileDir}.`);
}
