import type { Movie } from "./types";

export interface Filters {
  search: string;
  tags: string[];        // genres or custom tags; match any
  maxRuntime: number | null;
  minRating: number | null;
  scope: string; // "" everything, or a shared_with value: "all", "me", "group:<id>"
}

export const emptyFilters: Filters = { search: "", tags: [], maxRuntime: null, minRating: null, scope: "" };

export function matchesFilters(m: Movie, f: Filters): boolean {
  const q = f.search.trim().toLowerCase();
  if (q && !m.title.toLowerCase().includes(q) && !(m.note ?? "").toLowerCase().includes(q) && !m.tags.some((t) => t.includes(q))) return false;
  if (f.tags.length && ![...m.genres, ...m.tags].some((t) => f.tags.includes(t))) return false;
  if (f.maxRuntime != null && (m.runtime == null || m.runtime > f.maxRuntime)) return false;
  if (f.minRating != null && (m.rating == null || m.rating < f.minRating)) return false;
  if (f.scope && m.shared_with !== f.scope) return false;
  return true;
}

export const MAX_TAG_LENGTH = 30;
export const MAX_TAGS = 12;

export function normalizeTag(text: string): string | null {
  const tag = text.trim().replace(/^#+/, "").replace(/\s+/g, " ").trim().toLowerCase().slice(0, MAX_TAG_LENGTH).trim();
  return tag || null;
}

export function parseTags(text: string): string[] {
  return [...new Set(text.split(",").map(normalizeTag).filter((t): t is string => t !== null))].slice(0, MAX_TAGS);
}

export function allTags(movies: Pick<Movie, "genres" | "tags">[]): string[] {
  return [...new Set(movies.flatMap((m) => [...m.genres, ...m.tags]))].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
}

export function pickRandom<T extends { id: string }>(pool: T[], avoidId: string | null, rand = Math.random): T | null {
  if (!pool.length) return null;
  const choices = pool.length > 1 && avoidId ? pool.filter((m) => m.id !== avoidId) : pool;
  return choices[Math.floor(rand() * choices.length)] ?? null;
}

export function formatRuntime(min: number | null): string {
  if (!min) return "";
  const h = Math.floor(min / 60);
  const m = min % 60;
  return h ? `${h}h ${String(m).padStart(2, "0")}m` : `${m}m`;
}

export type SortKey = "added" | "title" | "runtime" | "rating" | "year";

export function sortMovies(list: Movie[], key: SortKey): Movie[] {
  const out = [...list];
  const num = (v: number | null, missing: number) => (v == null ? missing : v);
  switch (key) {
    case "title": return out.sort((a, b) => a.title.localeCompare(b.title));
    case "runtime": return out.sort((a, b) => num(a.runtime, Infinity) - num(b.runtime, Infinity));
    case "rating": return out.sort((a, b) => num(b.rating, -1) - num(a.rating, -1));
    case "year": return out.sort((a, b) => num(b.year, -1) - num(a.year, -1));
    default: return out.sort((a, b) => (a.watched ? (b.watched_at ?? "").localeCompare(a.watched_at ?? "") : b.created_at.localeCompare(a.created_at)));
  }
}
