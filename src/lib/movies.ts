import { normalizeRatings } from "./ratings";
import type { Movie } from "./types";

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);
const strArray = (v: unknown): string[] => (Array.isArray(v) ? v.filter((x): x is string => typeof x === "string") : []);

// A movie can be written by hand via REST, so nothing here can be assumed to exist or have the right type.
// Every field gets a safe default rather than letting a malformed doc crash rendering, sorting or filtering.
export function normalizeMovie(id: string, data: Record<string, unknown>, source: "movies" | "restricted"): Movie {
  const groupId = str(data.group_id);
  return {
    shared_with: source === "movies" ? "all" : groupId ? `group:${groupId}` : "me",
    owner: source === "movies" ? null : str(data.owner),
    id,
    tmdb_id: num(data.tmdb_id),
    imdb_id: str(data.imdb_id),
    title: str(data.title) || "Untitled",
    year: num(data.year),
    runtime: num(data.runtime),
    genres: strArray(data.genres),
    rating: num(data.rating),
    vote_count: num(data.vote_count),
    poster_path: str(data.poster_path),
    overview: str(data.overview),
    note: str(data.note),
    added_by: str(data.added_by),
    watched: data.watched === true,
    watched_at: str(data.watched_at),
    created_at: str(data.created_at) ?? new Date(0).toISOString(),
    tags: strArray(data.tags),
    ratings: normalizeRatings(data.ratings),
  };
}
