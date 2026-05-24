import { stdin as input, stdout as output } from "node:process";
import { createInterface } from "node:readline/promises";
import { LumaApiClient } from "../../luma/api.js";
import { defaultProfileDir, LumaSession } from "../../luma/session.js";

export type LoginOptions = {
  profileDir?: string | undefined;
};

export async function runLogin(options: LoginOptions = {}): Promise<void> {
  const profileDir = options.profileDir ?? defaultProfileDir();
  const session = new LumaSession(profileDir);

  try {
    const context = await session.open({ headless: false });
    const page = context.pages()[0] ?? (await context.newPage());
    await page.goto("https://luma.com/signin", { waitUntil: "domcontentloaded" });

    console.log("A browser window has opened. Sign in to Luma, then return to this terminal.");
    const rl = createInterface({ input, output });
    const enter = rl.question("Press Enter once you see your Luma home page.");
    const navigation = page
      .waitForURL(
        (url) => url.hostname.endsWith("luma.com") && /\/(home|dashboard)/.test(url.pathname),
        { timeout: 300_000 },
      )
      .catch(() => undefined);

    await Promise.race([enter, navigation]);
    rl.close();

    const api = new LumaApiClient(session);
    const user = await api.getCurrentUser();
    console.log(
      `Session captured. Signed in as ${user.name ?? "Unknown"} <${user.email ?? "no email"}>.`,
    );
    console.log(`Profile saved to ${profileDir}.`);
  } finally {
    await session.close();
  }
}
