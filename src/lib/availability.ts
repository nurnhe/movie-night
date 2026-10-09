import { titleKey } from "./media";
import type { Movie } from "./types";

// Where the friends watch from. TMDB's watch-provider data (supplied by JustWatch) is per country.
export const REGION = "RS";

export type Service = "netflix" | "hbo";
export const SERVICE_LABELS: Record<Service, string> = { netflix: "Netflix", hbo: "HBO Max" };
export const SERVICES: Service[] = ["netflix", "hbo"];

// TMDB names HBO's service "Max" or "HBO Max" depending on the region and date, so match by name.
export function serviceOf(providerName: string): Service | null {
  const n = providerName.trim().toLowerCase();
  if (n.includes("channel")) return null; // resold inside another app, e.g. "HBO Max Amazon Channel"
  if (n.startsWith("netflix")) return "netflix";
  if (/^(hbo\s+)?max\b/.test(n)) return "hbo";
  return null;
}

export interface Availability {
  services: Service[]; // subscription services in REGION that include the title
  link: string | null; // TMDB's "where to watch" page for the title
}

interface RawProviders {
  results?: Record<string, { link?: string; flatrate?: { provider_name: string }[] } | undefined>;
}

// Only subscription ("flatrate") counts: renting or buying isn't "on Netflix".
export function parseAvailability(raw: RawProviders): Availability {
  const region = raw.results?.[REGION];
  const found = new Set<Service>();
  for (const p of region?.flatrate ?? []) {
    const s = serviceOf(p.provider_name ?? "");
    if (s) found.add(s);
  }
  return { services: SERVICES.filter((s) => found.has(s)), link: region?.link ?? null };
}

export const availabilityKey = (m: Pick<Movie, "media_type" | "tmdb_id">) =>
  m.tmdb_id == null ? null : titleKey(m.media_type, m.tmdb_id);

// Availability changes often, so it's kept for a day only (and never written to the shared database).
export const AVAILABILITY_TTL_MS = 24 * 60 * 60 * 1000;

export interface CachedAvailability extends Availability { at: number }
export type AvailabilityCache = Record<string, CachedAvailability>;

export const isFresh = (c: CachedAvailability | undefined, now: number): c is CachedAvailability =>
  !!c && now - c.at < AVAILABILITY_TTL_MS && now >= c.at;

// Titles worth checking: not watched yet, TMDB-backed, and not looked up in the last day.
export function titlesToCheck(movies: Movie[], cache: AvailabilityCache, now: number): Movie[] {
  const seen = new Set<string>();
  return movies.filter((m) => {
    const key = availabilityKey(m);
    if (!key || m.watched || seen.has(key) || isFresh(cache[key], now)) return false;
    seen.add(key);
    return true;
  });
}

export type StreamingFilter = "" | Service | "any";

export function matchesStreaming(filter: StreamingFilter, services: Service[] | undefined): boolean {
  if (!filter) return true;
  if (!services?.length) return false;
  return filter === "any" || services.includes(filter);
}
