/**
 * Replaces real names, avatars, and profile URLs in dashboard.json with deterministic demo data.
 * Run from serendipity-landing: bun run src/data/anonymize-dashboard-data.ts
 *
 * Reads dashboard.source.json when present (real export); otherwise reads dashboard.json.
 * Writes anonymized output to dashboard.json.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const DATA_DIR = import.meta.dir;
const SOURCE_PATH = resolve(DATA_DIR, "dashboard.source.json");
const OUT_PATH = resolve(DATA_DIR, "dashboard.json");

const DEMO_USER_NAME = "Jordan Lee";
const DEMO_USER_SLUG = "jordan-lee-demo";

const FIRST_NAMES = [
  "Alex", "Jordan", "Sam", "Taylor", "Morgan", "Riley", "Casey", "Quinn", "Avery", "Jamie",
  "Drew", "Blake", "Cameron", "Skyler", "Reese", "Noah", "Maya", "Priya", "Leo", "Nina",
  "Elena", "Marcus", "Sofia", "Ethan", "Hana", "Omar", "Zoe", "Kai", "Amira", "Felix",
];

const LAST_NAMES = [
  "Chen", "Patel", "Nguyen", "Kim", "Santos", "Reed", "Brooks", "Hayes", "Foster", "Bryant",
  "Coleman", "Murphy", "Sullivan", "Parker", "Rivera", "Shah", "Okafor", "Andersson", "Morales", "Wright",
  "Bennett", "Diaz", "Nakamura", "Kowalski", "Ali", "Fischer", "Romero", "Singh", "Torres", "Walsh",
];

const ORG_PREFIXES = ["Northbridge", "Harbor", "Summit", "Catalyst", "Forge", "Beacon", "Atlas", "Vertex", "Lumen", "Gridline"];
const ORG_SUFFIXES = ["Labs", "Collective", "Studio", "Network", "Works", "Guild", "Forum", "Initiative", "Co.", "Group"];

function hashString(input: string): number {
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function pick<T>(items: T[], seed: number): T {
  const idx = ((seed % items.length) + items.length) % items.length;
  return items[idx]!;
}

function looksLikeOrgName(name: string): boolean {
  const lower = name.toLowerCase();
  return (
    lower.includes("week") ||
    lower.includes("labs") ||
    lower.includes("inc") ||
    lower.includes("studio") ||
    lower.includes("collective") ||
    lower.includes("innovate") ||
    lower.includes("foundation") ||
    lower.includes("network") ||
    lower.includes("community") ||
    name.split(/\s+/).length >= 3
  );
}

function demoName(apiId: string, originalName: string): string {
  const seed = hashString(apiId);
  const altSeed = hashString(`${apiId}:suffix`);
  if (looksLikeOrgName(originalName)) {
    return `${pick(ORG_PREFIXES, seed)} ${pick(ORG_SUFFIXES, altSeed)}`;
  }
  return `${pick(FIRST_NAMES, seed)} ${pick(LAST_NAMES, altSeed)}`;
}

function demoSlug(apiId: string): string {
  const token = hashString(apiId).toString(36).slice(0, 10);
  return `demo-${token}`;
}

function demoAvatar(apiId: string): string {
  return `https://api.dicebear.com/9.x/personas/png?seed=${encodeURIComponent(apiId)}&size=128`;
}

function scrubBio(bio: string | null, handleSeed: string): string | null {
  if (!bio) return bio;
  const handle = `demo_${hashString(handleSeed).toString(36).slice(0, 6)}`;
  return bio
    .replace(/@[\w.]+/g, `@${handle}`)
    .replace(/https?:\/\/(www\.)?linkedin\.com\/in\/[^\s)]+/gi, "https://linkedin.com/in/demo-profile")
    .replace(/https?:\/\/(www\.)?twitter\.com\/[^\s)]+/gi, "https://twitter.com/demo")
    .replace(/https?:\/\/[^\s)]+/g, "https://example.com");
}

interface PersonLike {
  api_id: string;
  name: string;
  bio?: string | null;
  avatar_url?: string | null;
  linkedin_slug?: string | null;
  linkedin_url?: string | null;
  twitter?: string | null;
  instagram?: string | null;
  website?: string | null;
  [key: string]: unknown;
}

function anonymizePerson(person: PersonLike, isDemoUser: boolean): void {
  const slug = isDemoUser ? DEMO_USER_SLUG : demoSlug(person.api_id);
  const name = isDemoUser ? DEMO_USER_NAME : demoName(person.api_id, person.name);

  person.name = name;
  person.avatar_url = demoAvatar(person.api_id);
  person.linkedin_slug = slug;
  person.linkedin_url = `https://www.linkedin.com/in/${slug}`;
  person.twitter = person.twitter ? `demo_${slug}` : null;
  person.instagram = person.instagram ? `demo_${slug}` : null;
  person.website = person.website ? `https://example.com/${slug}` : null;
  person.bio = scrubBio(person.bio ?? null, person.api_id);
}

function walkAndAnonymize(node: unknown, demoUserApiId: string): void {
  if (Array.isArray(node)) {
    for (const item of node) walkAndAnonymize(item, demoUserApiId);
    return;
  }
  if (!node || typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  if (typeof record.api_id === "string" && typeof record.name === "string") {
    anonymizePerson(record as PersonLike, record.api_id === demoUserApiId);
  }

  for (const value of Object.values(record)) {
    walkAndAnonymize(value, demoUserApiId);
  }
}

function main() {
  const inputPath = existsSync(SOURCE_PATH) ? SOURCE_PATH : OUT_PATH;
  if (!existsSync(inputPath)) {
    console.error("No dashboard.source.json or dashboard.json found.");
    process.exit(1);
  }

  const raw = readFileSync(inputPath, "utf-8");
  const data = JSON.parse(raw) as {
    user: { name: string; api_id: string };
    people: Record<string, PersonLike>;
    [key: string]: unknown;
  };

  if (inputPath === OUT_PATH && !existsSync(SOURCE_PATH)) {
    writeFileSync(SOURCE_PATH, raw);
    console.log(`Backed up current data to ${SOURCE_PATH}`);
  }

  const demoUserApiId = data.user.api_id;
  data.user.name = DEMO_USER_NAME;

  for (const person of Object.values(data.people)) {
    anonymizePerson(person, person.api_id === demoUserApiId);
  }

  // embedded host/guest copies in events are separate objects from people index
  walkAndAnonymize(data.days, demoUserApiId);

  data.generated_at = new Date().toISOString();
  writeFileSync(OUT_PATH, JSON.stringify(data, null, 2));

  console.log(`Wrote anonymized demo data to ${OUT_PATH}`);
  console.log(`  Source: ${inputPath}`);
  console.log(`  People: ${Object.keys(data.people).length}`);
}

main();
