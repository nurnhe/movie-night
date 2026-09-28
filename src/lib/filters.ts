import type { Movie } from "./types";

export interface Filters {
  search: string;
  genres: string[];      // match any
  maxRuntime: number | null;
  minRating: number | null;
  scope: string; // "" everyone, "mine", or "group:<id>"
}

export const emptyFilters: Filters = { search: "", genres: [], maxRuntime: null, minRating: null, scope: "" };

export function matchesFilters(m: Movie, f: Filters, adders: string[] | null = null): boolean {
  const q = f.search.trim().toLowerCase();
  if (q && !m.title.toLowerCase().includes(q) && !(m.note ?? "").toLowerCase().includes(q)) return false;
  if (f.genres.length && !m.genres.some((g) => f.genres.includes(g))) return false;
  if (f.maxRuntime != null && (m.runtime == null || m.runtime > f.maxRuntime)) return false;
  if (f.minRating != null && (m.rating == null || m.rating < f.minRating)) return false;
  if (adders && !adders.includes((m.added_by ?? "").toLowerCase())) return false;
  return true;
}

export function scopeAdders(scope: string, me: string, groups: { id: string; members: string[] }[]): string[] | null {
  if (scope === "mine") return [me];
  if (scope.startsWith("group:")) return groups.find((g) => `group:${g.id}` === scope)?.members ?? null;
  return null;
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
