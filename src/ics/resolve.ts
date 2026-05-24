export type ResolvedEventIds = {
  event_api_id: string | null;
  slug: string | null;
  calendar_pk: string | null;
  url: string | null;
};

export function resolveEventIds(uid: string | null, description: string | null): ResolvedEventIds {
  const event_api_id = uid?.replace(/@events\.lu\.ma$/i, "") ?? null;
  const url = extractLumaEventUrl(description);
  const parsed = url ? parseLumaEventUrl(url) : { slug: null, calendar_pk: null };

  return {
    event_api_id,
    slug: parsed.slug,
    calendar_pk: parsed.calendar_pk,
    url: parsed.slug ? `https://luma.com/${parsed.slug}` : url,
  };
}

export function extractLumaEventUrl(text: string | null): string | null {
  if (!text) return null;
  const match = text.match(/https:\/\/luma\.com\/(?!join\/|event\/manage\/)[^\s\\]+/i);
  return match?.[0]?.replace(/[),.]+$/, "") ?? null;
}

export function parseLumaEventUrl(url: string): {
  slug: string | null;
  calendar_pk: string | null;
} {
  try {
    const parsed = new URL(url);
    const slug = parsed.pathname.split("/").filter(Boolean)[0] ?? null;
    return {
      slug,
      calendar_pk: parsed.searchParams.get("pk"),
    };
  } catch {
    return { slug: null, calendar_pk: null };
  }
}
