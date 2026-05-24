import { resolve as dnsResolve } from "node:dns/promises";
import { constants } from "node:fs";
import { access, stat } from "node:fs/promises";
import tls from "node:tls";
import { fetchIcs } from "../../ics/fetcher.js";
import { parseIcsCalendar } from "../../ics/parser.js";
import { LumaApiClient } from "../../luma/api.js";
import { defaultProfileDir, LumaSession } from "../../luma/session.js";
import { type CheckResult, printCheck, timedCheck } from "../output.js";

export type DoctorOptions = {
  profileDir?: string | undefined;
  check?: string | undefined;
  ics?: string | undefined;
};

const CHECKS = ["profile", "auth", "network", "endpoints", "ics"] as const;

export async function runDoctor(options: DoctorOptions = {}): Promise<void> {
  const selected = options.check ? [options.check] : [...CHECKS];
  const profileDir = options.profileDir ?? defaultProfileDir();
  const session = new LumaSession(profileDir);
  const api = new LumaApiClient(session);
  const results: CheckResult[] = [];

  try {
    for (const check of selected) {
      switch (check) {
        case "profile":
          results.push(await checkProfile(profileDir));
          break;
        case "auth":
          results.push(await checkAuth(api));
          break;
        case "network":
          results.push(await checkNetwork());
          break;
        case "endpoints":
          results.push(await checkEndpoints(api));
          break;
        case "ics":
          results.push(await checkIcs(options.ics));
          break;
        default:
          results.push({
            status: "FAIL",
            name: check,
            message: `unknown check. expected one of ${CHECKS.join(", ")}`,
            durationMs: 0,
          });
      }
    }
  } finally {
    await session.close();
  }

  for (const result of results) printCheck(result);
  if (results.some((result) => result.status === "FAIL")) {
    process.exitCode = 1;
  }
}

function checkProfile(profileDir: string): Promise<CheckResult> {
  return timedCheck("profile", async () => {
    const stats = await stat(profileDir);
    if (!stats.isDirectory())
      return { status: "FAIL", message: `${profileDir} is not a directory` };
    await access(profileDir, constants.R_OK | constants.W_OK);
    const mode = stats.mode & 0o777;
    if (mode !== 0o700) {
      return { status: "WARN", message: `${profileDir} exists but mode is ${mode.toString(8)}` };
    }
    return { status: "PASS", message: `${profileDir} (0700)` };
  });
}

function checkAuth(api: LumaApiClient): Promise<CheckResult> {
  return timedCheck("auth", async () => {
    const user = await api.getCurrentUser();
    return {
      status: "PASS",
      message: `${user.name ?? "Unknown"} <${user.email ?? "no email"}>`,
    };
  });
}

function checkNetwork(): Promise<CheckResult> {
  return timedCheck("network", async () => {
    const hosts = ["api.lu.ma", "luma.com", "api2.luma.com"];
    for (const host of hosts) {
      await dnsResolve(host);
      await tlsProbe(host);
    }
    return { status: "PASS", message: `${hosts.join(", ")} all reachable` };
  });
}

function checkEndpoints(api: LumaApiClient): Promise<CheckResult> {
  return timedCheck("endpoints", async () => {
    const eventId = process.env.LUMA_TEST_EVENT_ID;
    if (!eventId) {
      return { status: "WARN", message: "set LUMA_TEST_EVENT_ID to probe event endpoints" };
    }
    await api.getEvent(eventId);
    try {
      await api.getGuests(eventId);
      return { status: "PASS", message: "/event/get and /event/get-guests OK" };
    } catch (error) {
      const status =
        typeof error === "object" && error !== null
          ? (error as { status?: number }).status
          : undefined;
      if (status === 403) {
        return { status: "WARN", message: "/event/get OK; guests hidden for test event" };
      }
      throw error;
    }
  });
}

function checkIcs(source: string | undefined): Promise<CheckResult> {
  return timedCheck("ics", async () => {
    if (!source) return { status: "WARN", message: "pass --ics to check a calendar feed" };
    const fetched = await fetchIcs(source);
    const parsed = parseIcsCalendar(fetched.body);
    const dates = parsed.events.map((event) => event.time.start_utc).sort();
    const first = dates[0] ?? "n/a";
    const last = dates.at(-1) ?? "n/a";
    return { status: "PASS", message: `${parsed.events.length} events, ${first} to ${last}` };
  });
}

function tlsProbe(host: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const socket = tls.connect({ host, port: 443, servername: host, timeout: 10_000 }, () => {
      socket.end();
      resolve();
    });
    socket.once("error", reject);
    socket.once("timeout", () => {
      socket.destroy();
      reject(new Error(`TLS timeout for ${host}`));
    });
  });
}
