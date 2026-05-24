import { readFile } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import { toIsoUtc } from "../util/time.js";
import type { IcsFetchResult } from "./types.js";

export type FetchIcsOptions = {
  timeoutMs?: number;
  userAgent?: string;
};

export async function fetchIcs(
  source: string,
  options: FetchIcsOptions = {},
): Promise<IcsFetchResult> {
  if (isHttpUrl(source)) {
    return fetchIcsUrl(source, options);
  }

  const path = isAbsolute(source) ? source : resolve(process.cwd(), source);
  return {
    body: await readFile(path, "utf8"),
    source: path,
    fetched_at_utc: toIsoUtc(),
    is_local_file: true,
  };
}

function isHttpUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

async function fetchIcsUrl(source: string, options: FetchIcsOptions): Promise<IcsFetchResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.timeoutMs ?? 30_000);

  try {
    const response = await fetch(source, {
      signal: controller.signal,
      redirect: "follow",
      headers: {
        Accept: "text/calendar, text/plain;q=0.9, */*;q=0.8",
        "User-Agent": options.userAgent ?? "luma-enricher/1.0",
      },
    });

    if (!response.ok) {
      throw new Error(`failed to fetch ICS: ${response.status} ${response.statusText}`);
    }

    const etag = response.headers.get("etag") ?? undefined;
    return {
      body: await response.text(),
      source,
      etag,
      fetched_at_utc: toIsoUtc(),
      is_local_file: false,
    };
  } finally {
    clearTimeout(timeout);
  }
}
