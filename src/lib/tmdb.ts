import type { NewMovie } from "./types";

const API = "https://api.themoviedb.org/3";
const token = import.meta.env.VITE_TMDB_TOKEN as string | undefined;

export const tmdbConfigured = Boolean(token);

export interface SearchResult {
  id: number;
  title: string;
  year: number | null;
  poster_path: string | null;
  rating: number | null;
}

async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
  const qs = new URLSearchParams({ language: "en-US", ...params });
  const res = await fetch(`${API}${path}?${qs}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/json" },
  });
  if (!res.ok) throw new Error(`TMDB request failed (${res.status})`);
  return res.json() as Promise<T>;
}

function yearOf(date: string | undefined): number | null {
  const y = date ? parseInt(date.slice(0, 4), 10) : NaN;
  return Number.isFinite(y) ? y : null;
}

export async function searchMovies(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (signal?.aborted) return [];
  const data = await get<{ results: Array<{ id: number; title: string; release_date?: string; poster_path: string | null; vote_average?: number; vote_count?: number }> }>(
    "/search/movie",
    { query, include_adult: "false" },
  );
  return data.results.slice(0, 8).map((r) => ({
    id: r.id,
    title: r.title,
    year: yearOf(r.release_date),
    poster_path: r.poster_path,
    rating: r.vote_count ? Math.round((r.vote_average ?? 0) * 10) / 10 : null,
  }));
}

export async function movieDetails(id: number): Promise<Omit<NewMovie, "note" | "added_by" | "tags">> {
  const d = await get<{
    id: number; imdb_id: string | null; title: string; release_date?: string; runtime: number | null;
    genres: { name: string }[]; vote_average: number; vote_count: number; poster_path: string | null; overview: string;
  }>(`/movie/${id}`);
  return {
    tmdb_id: d.id,
    imdb_id: d.imdb_id || null,
    title: d.title,
    year: yearOf(d.release_date),
    runtime: d.runtime || null,
    genres: d.genres.map((g) => (g.name === "Science Fiction" ? "Sci-Fi" : g.name)),
    rating: d.vote_count ? Math.round(d.vote_average * 10) / 10 : null,
    vote_count: d.vote_count || null,
    poster_path: d.poster_path,
    overview: d.overview || null,
  };
}

export const posterUrl = (path: string | null, size: "w92" | "w185" | "w342" = "w185") =>
  path ? `https://image.tmdb.org/t/p/${size}${path}` : null;

export const letterboxdUrl = (tmdbId: number) => `https://letterboxd.com/tmdb/${tmdbId}/`;
export const tmdbUrl = (tmdbId: number) => `https://www.themoviedb.org/movie/${tmdbId}`;
export const imdbUrl = (imdbId: string) => `https://www.imdb.com/title/${imdbId}/`;
